-- =====================================================================
-- NEON ROYALE, Schritt 4: Texas Hold'em (bis zu 9 Spieler, echte Blinds, Erhöhen, All-in, Nebenpötte)
-- Reihenfolge: schema.sql, schema2.sql, schema3.sql, danach diese Datei.
-- Mehrfaches Ausführen ist unschädlich.
-- =====================================================================
alter table public.rooms add column if not exists bb bigint not null default 20;
alter table public.rooms add column if not exists board jsonb not null default '[]';
alter table public.rooms add column if not exists street text;
alter table public.rooms add column if not exists cur uuid;
alter table public.rooms add column if not exists cbet bigint not null default 0;
alter table public.rooms add column if not exists minraise bigint not null default 0;
alter table public.rooms add column if not exists btn int not null default 0;
alter table public.rooms add column if not exists log jsonb not null default '[]';

create table if not exists public.holdem_seats (
  code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, seat int not null, stack bigint not null check (stack >= 0),
  bet bigint not null default 0, total bigint not null default 0,
  folded boolean not null default false, allin boolean not null default false,
  acted boolean not null default false, in_hand boolean not null default false,
  leaving boolean not null default false, hrank bigint,
  primary key (code, user_id));
alter table public.holdem_seats enable row level security;
drop policy if exists "Sitze lesen" on public.holdem_seats;
create policy "Sitze lesen" on public.holdem_seats for select to authenticated using (is_member(code));
do $$ begin
  begin alter publication supabase_realtime add table public.holdem_seats; exception when others then null; end;
end $$;

-- ---------- Hilfsfunktionen ----------
create or replace function public.h_next(c text, from_seat int, need text) returns int language sql stable set search_path = public as $$
  select seat from holdem_seats where code = c and (
      (need = 'any' and stack > 0) or
      (need = 'dealt' and in_hand and not folded) or
      (need = 'actor' and in_hand and not folded and not allin))
  order by (case when seat > from_seat then 0 else 1 end), seat limit 1
$$;

create or replace function public.h_post(c text, sn int, amt bigint) returns void language plpgsql set search_path = public as $$
begin
  update holdem_seats set bet = bet + least(amt, stack), total = total + least(amt, stack),
         allin = (stack - least(amt, stack) = 0), stack = stack - least(amt, stack)
   where code = c and seat = sn;
end $$;

create or replace function public.h_log(c text, msg text) returns void language plpgsql set search_path = public as $$
begin
  update rooms set log = (select coalesce(jsonb_agg(t order by o), '[]'::jsonb)
                            from jsonb_array_elements_text(rooms.log || to_jsonb(msg)) with ordinality x(t, o)
                           where o > jsonb_array_length(rooms.log || to_jsonb(msg)) - 8)
   where code = c;
end $$;

-- Beste 5 aus 7 Karten
create or replace function public.holdem_best(cards jsonb) returns bigint language plpgsql set search_path = public as $$
declare i int; j int; best bigint := -1; r bigint; n int := jsonb_array_length(cards);
begin
  for i in 1..n - 1 loop
    for j in i + 1..n loop
      r := poker_rank((select jsonb_agg(c order by o) from jsonb_array_elements(cards) with ordinality t(c, o) where o <> i and o <> j));
      if r > best then best := r; end if;
    end loop;
  end loop;
  return best;
end $$;

-- ---------- Hand beenden: Nebenpötte, Showdown, Auszahlung ----------
create or replace function public.holdem_finish(c text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare rm rooms; alive int; showdown boolean; lvl bigint; prev bigint := 0; layer bigint; best bigint; nw int;
  share bigint; extra bigint; pay bigint; first_w boolean; w record; s record;
  won jsonb := '{}'::jsonb; outp jsonb := '[]'::jsonb; hole jsonb; wamt bigint;
begin
  select * into rm from rooms where code = c for update;
  select count(*) into alive from holdem_seats where code = c and in_hand and not folded;
  showdown := alive > 1;
  if showdown then
    update holdem_seats s2 set hrank = holdem_best((select hand from poker_hands h where h.code = c and h.round = rm.round and h.user_id = s2.user_id) || rm.board)
     where s2.code = c and s2.in_hand and not s2.folded;
  end if;
  for lvl in select distinct total from holdem_seats where code = c and total > 0 order by total loop
    layer := (select coalesce(sum(least(total, lvl) - least(total, prev)), 0) from holdem_seats where code = c);
    select max(hrank) into best from holdem_seats where code = c and in_hand and not folded and total >= lvl;
    select count(*) into nw from holdem_seats where code = c and in_hand and not folded and total >= lvl and hrank is not distinct from best;
    if nw = 0 then
      update holdem_seats set stack = stack + layer
       where code = c and user_id = (select user_id from holdem_seats where code = c and in_hand and not folded order by total desc limit 1);
      prev := lvl; continue;
    end if;
    share := layer / nw; extra := layer - share * nw; first_w := true;
    for w in select user_id from holdem_seats where code = c and in_hand and not folded and total >= lvl and hrank is not distinct from best order by seat loop
      pay := share + (case when first_w then extra else 0 end); first_w := false;
      update holdem_seats set stack = stack + pay where code = c and user_id = w.user_id;
      won := jsonb_set(won, array[w.user_id::text], to_jsonb(coalesce((won ->> w.user_id::text)::bigint, 0) + pay), true);
    end loop;
    prev := lvl;
  end loop;
  for s in select * from holdem_seats where code = c and in_hand order by seat loop
    wamt := coalesce((won ->> s.user_id::text)::bigint, 0);
    select hand into hole from poker_hands where code = c and round = rm.round and user_id = s.user_id;
    outp := outp || jsonb_build_object('user_id', s.user_id, 'name', s.name, 'stake', s.total, 'won', wamt, 'folded', s.folded,
      'hole', case when showdown and not s.folded then hole else null end,
      'cat', case when showdown and not s.folded then (s.hrank / 759375)::int else null end);
    perform bump_stat(s.user_id, 'holdem', s.total, wamt);
    if wamt > s.total then perform h_log(c, s.name || ' gewinnt ' || (wamt - s.total) || ' NC'); end if;
  end loop;
  for s in select * from holdem_seats where code = c and leaving loop
    update profiles set coins = coins + s.stack where id = s.user_id;
    delete from holdem_seats where code = c and user_id = s.user_id;
  end loop;
  update rooms set phase = 'showdown', cur = null, payouts = outp where code = c;
  delete from poker_decks where code = c;
end $$;

-- ---------- Spielfluss: wer ist dran, nächste Straße, Showdown ----------
create or replace function public.holdem_advance(c text, force_from int default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare rm rooms; alive int; actors int; pending int; cs int; nu uuid; nxt text; ncards int; dk jsonb; newc jsonb; guard int := 0; ff int := force_from;
begin
  loop
    guard := guard + 1; if guard > 8 then return; end if;
    select * into rm from rooms where code = c;
    select count(*) into alive from holdem_seats where code = c and in_hand and not folded;
    if alive <= 1 then perform holdem_finish(c); return; end if;
    select count(*) into actors from holdem_seats where code = c and in_hand and not folded and not allin;
    select count(*) into pending from holdem_seats
     where code = c and in_hand and not folded and not allin and (bet < rm.cbet or (not acted and actors > 1));
    if pending > 0 then
      if ff is null and rm.cur is not null and exists (select 1 from holdem_seats where code = c and user_id = rm.cur and in_hand and not folded and not allin
           and (bet < rm.cbet or (not acted and actors > 1))) then return; end if;
      cs := coalesce(ff, (select seat from holdem_seats where code = c and user_id = rm.cur), rm.btn);
      select user_id into nu from holdem_seats
       where code = c and in_hand and not folded and not allin and (bet < rm.cbet or (not acted and actors > 1))
       order by (case when seat > cs then 0 else 1 end), seat limit 1;
      update rooms set cur = nu where code = c;
      return;
    end if;
    if rm.street = 'river' then perform holdem_finish(c); return; end if;
    ncards := case rm.street when 'preflop' then 3 else 1 end;
    nxt := case rm.street when 'preflop' then 'flop' when 'flop' then 'turn' else 'river' end;
    select deck into dk from poker_decks where code = c;
    newc := (select jsonb_agg(dk -> i order by i) from generate_series(0, ncards - 1) i);
    update poker_decks set deck = (select coalesce(jsonb_agg(dk -> i order by i), '[]'::jsonb) from generate_series(ncards, jsonb_array_length(dk) - 1) i) where code = c;
    update holdem_seats set bet = 0, acted = false where code = c;
    update rooms set street = nxt, board = board || newc, cbet = 0, minraise = bb, cur = null where code = c;
    ff := rm.btn;
  end loop;
end $$;

-- ---------- Tisch: Blinds, Hinsetzen, Aufstehen ----------
create or replace function public.holdem_blinds(p_code text, p_bb bigint) returns void language plpgsql security definer set search_path = public as $$
declare rm rooms;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Das ist kein Hold''em-Raum'; end if;
  if rm.host <> auth.uid() then raise exception 'Nur der Gastgeber darf die Blinds ändern'; end if;
  if rm.phase <> 'lobby' or exists (select 1 from holdem_seats where code = rm.code) then raise exception 'Blinds lassen sich nur ändern, solange noch niemand sitzt'; end if;
  if p_bb not in (10, 20, 50, 100, 200, 500, 1000) then raise exception 'Ungültige Blinds'; end if;
  update rooms set bb = p_bb where code = rm.code;
end $$;

create or replace function public.holdem_sit(p_code text, p_buyin bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); rm rooms; pr profiles; s holdem_seats; sn int;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Das ist kein Hold''em-Raum'; end if;
  if not is_member(rm.code) then raise exception 'Du bist nicht in diesem Raum'; end if;
  if rm.phase not in ('lobby', 'showdown') then raise exception 'Setz dich zwischen zwei Händen hin'; end if;
  if p_buyin < rm.bb * 20 or p_buyin > rm.bb * 200 then raise exception 'Buy-in muss zwischen % und % NC liegen', rm.bb * 20, rm.bb * 200; end if;
  select * into pr from profiles where id = u for update;
  if pr.coins < p_buyin then raise exception 'Zu wenig Coins'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  if s.user_id is not null then
    if s.stack + p_buyin > rm.bb * 200 then raise exception 'Dein Stack darf höchstens % NC groß sein', rm.bb * 200; end if;
    update holdem_seats set stack = stack + p_buyin where code = rm.code and user_id = u;
  else
    select min(g) into sn from generate_series(1, 9) g where not exists (select 1 from holdem_seats where code = rm.code and seat = g);
    if sn is null then raise exception 'Der Tisch ist voll'; end if;
    insert into holdem_seats (code, user_id, name, seat, stack) values (rm.code, u, pr.name, sn, p_buyin);
  end if;
  update profiles set coins = coins - p_buyin where id = u;
end $$;

create or replace function public.holdem_standup(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); rm rooms; s holdem_seats;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.phase not in ('lobby', 'showdown') then raise exception 'Du kannst erst nach der Hand aufstehen'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  if s.user_id is null then raise exception 'Du sitzt nicht am Tisch'; end if;
  update profiles set coins = coins + s.stack where id = u;
  delete from holdem_seats where code = rm.code and user_id = u;
end $$;

-- ---------- Hand austeilen (Gastgeber) ----------
create or replace function public.holdem_deal(p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; c text := upper(trim(coalesce(p_code, ''))); n int; deck jsonb; idx int := 0;
  btn_seat int; sb_seat int; bb_seat int; s record; hand jsonb;
begin
  select * into rm from rooms where code = c for update;
  if not found or rm.game <> 'holdem' then raise exception 'Das ist kein Hold''em-Raum'; end if;
  if rm.host <> u then raise exception 'Nur der Gastgeber darf austeilen'; end if;
  if rm.phase not in ('lobby', 'showdown') then raise exception 'Die Hand läuft schon'; end if;
  delete from holdem_seats where code = c and stack <= 0;
  select count(*) into n from holdem_seats where code = c;
  if n < 2 then raise exception 'Es braucht mindestens 2 Spieler am Tisch'; end if;
  btn_seat := h_next(c, rm.btn, 'any');
  update holdem_seats set bet = 0, total = 0, folded = false, allin = false, acted = false, in_hand = true, hrank = null where code = c;
  delete from poker_hands where code = c;
  deck := new_deck(1);
  for s in select user_id from holdem_seats where code = c order by (case when seat > btn_seat then 0 else 1 end), seat loop
    hand := jsonb_build_array(deck -> idx, deck -> (idx + 1)); idx := idx + 2;
    insert into poker_hands (code, round, user_id, hand) values (c, rm.round + 1, s.user_id, hand);
  end loop;
  insert into poker_decks (code, deck) values (c, (select jsonb_agg(deck -> i order by i) from generate_series(idx, 51) i))
    on conflict (code) do update set deck = excluded.deck;
  if n = 2 then sb_seat := btn_seat; else sb_seat := h_next(c, btn_seat, 'dealt'); end if;
  bb_seat := h_next(c, sb_seat, 'dealt');
  perform h_post(c, sb_seat, rm.bb / 2);
  perform h_post(c, bb_seat, rm.bb);
  update rooms set phase = 'hand', round = round + 1, btn = btn_seat, street = 'preflop', board = '[]'::jsonb,
         cbet = rm.bb, minraise = rm.bb, cur = null, payouts = '[]'::jsonb, log = '["Neue Hand"]'::jsonb,
         pot = (select coalesce(sum(total), 0) from holdem_seats where code = c)
   where code = c;
  perform holdem_advance(c, bb_seat);
end $$;

-- ---------- Aktion: Passen, Checken, Mitgehen, Erhöhen, All-in ----------
create or replace function public.holdem_act(p_code text, p_action text, p_amount bigint default 0) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; s holdem_seats; to_call bigint; pay bigint; x bigint; maxx bigint; rsz bigint; lg text;
  new_cbet bigint; new_min bigint; reopen boolean := false;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.game <> 'holdem' or rm.phase <> 'hand' then raise exception 'Gerade läuft keine Hand'; end if;
  if rm.cur is distinct from u then raise exception 'Du bist nicht dran'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  to_call := rm.cbet - s.bet; new_cbet := rm.cbet; new_min := rm.minraise;
  if p_action = 'fold' then
    update holdem_seats set folded = true, acted = true where code = rm.code and user_id = u;
    lg := s.name || ' wirft die Karten weg';
  elsif p_action = 'check' then
    if to_call > 0 then raise exception 'Du musst mitgehen oder passen'; end if;
    update holdem_seats set acted = true where code = rm.code and user_id = u;
    lg := s.name || ' checkt';
  elsif p_action = 'call' then
    if to_call <= 0 then raise exception 'Es gibt nichts mitzugehen'; end if;
    pay := least(to_call, s.stack);
    update holdem_seats set stack = stack - pay, bet = bet + pay, total = total + pay, allin = (stack - pay = 0), acted = true
     where code = rm.code and user_id = u;
    lg := s.name || ' geht mit (' || pay || ')';
  elsif p_action in ('raise', 'allin') then
    maxx := s.bet + s.stack;
    x := case when p_action = 'allin' then maxx else p_amount end;
    if x > maxx then raise exception 'Du hast nicht so viele Chips'; end if;
    if x <= rm.cbet then
      if p_action <> 'allin' then raise exception 'Die Erhöhung muss über dem aktuellen Einsatz liegen'; end if;
      pay := s.stack;
      update holdem_seats set stack = 0, bet = bet + pay, total = total + pay, allin = true, acted = true where code = rm.code and user_id = u;
      lg := s.name || ' geht mit All-in (' || pay || ')';
    else
      if x < rm.cbet + rm.minraise and x < maxx then raise exception 'Mindestens auf % erhöhen', rm.cbet + rm.minraise; end if;
      pay := x - s.bet;
      update holdem_seats set stack = stack - pay, bet = x, total = total + pay, allin = (stack - pay = 0), acted = true
       where code = rm.code and user_id = u;
      rsz := x - rm.cbet;
      if rsz >= rm.minraise then new_min := rsz; reopen := true; end if;
      new_cbet := x;
      lg := s.name || (case when x >= maxx then ' geht All-in auf ' else ' erhöht auf ' end) || x;
    end if;
  else
    raise exception 'Unbekannte Aktion';
  end if;
  if reopen then
    update holdem_seats set acted = false where code = rm.code and user_id <> u and in_hand and not folded and not allin;
  end if;
  update rooms set cbet = new_cbet, minraise = new_min,
         pot = (select coalesce(sum(total), 0) from holdem_seats where code = rm.code) where code = rm.code;
  perform h_log(rm.code, lg);
  perform holdem_advance(rm.code);
end $$;

-- Gastgeber: hängt jemand, wird für ihn gecheckt oder gepasst
create or replace function public.holdem_skip(p_code text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare rm rooms; s holdem_seats;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Raum nicht gefunden'; end if;
  if rm.host <> auth.uid() then raise exception 'Nur der Gastgeber darf das'; end if;
  if rm.phase <> 'hand' or rm.cur is null then raise exception 'Gerade ist niemand dran'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = rm.cur;
  if rm.cbet - s.bet <= 0 then
    update holdem_seats set acted = true where code = rm.code and user_id = rm.cur;
    perform h_log(rm.code, s.name || ' wurde übersprungen (checkt)');
  else
    update holdem_seats set folded = true, acted = true where code = rm.code and user_id = rm.cur;
    perform h_log(rm.code, s.name || ' wurde übersprungen (passt)');
  end if;
  perform holdem_advance(rm.code);
end $$;

-- ---------- Räume: erstellen, beitreten, verlassen, Zustand ----------
create or replace function public.create_room(p_game text default 'roulette') returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; c text; tries int := 0;
begin
  if p_game not in ('roulette', 'poker', 'holdem') then raise exception 'Unbekanntes Spiel'; end if;
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  delete from rooms where created_at < now() - interval '1 day';
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd_int(32) + 1, 1), '') from generate_series(1, 5));
    begin
      insert into rooms (code, host, game, phase) values (c, u, p_game, case when p_game in ('poker', 'holdem') then 'lobby' else 'betting' end);
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 5 then raise exception 'Kein freier Raumcode, bitte nochmal'; end if;
    end;
  end loop;
  insert into room_members (code, user_id, name) values (c, u, pr.name);
  return c;
end $$;

create or replace function public.join_room(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pr profiles; rm rooms; c text := upper(trim(coalesce(p_code, '')));
begin
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  select * into rm from rooms where code = c;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if not is_member(c) and (select count(*) from room_members where code = c) >= (case rm.game when 'poker' then 5 when 'holdem' then 9 else 8 end) then
    raise exception 'Der Raum ist voll'; end if;
  insert into room_members (code, user_id, name) values (c, u, pr.name)
    on conflict (code, user_id) do update set name = excluded.name;
  return c;
end $$;

-- Verlassen: Chips kommen zurück. Der Gastgeber schließt den Raum, alle bekommen ihre Chips erstattet.
create or replace function public.leave_room(p_code text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); c text := upper(trim(coalesce(p_code, ''))); rm rooms; s holdem_seats;
begin
  select * into rm from rooms where code = c for update;
  if not found then return; end if;
  if rm.host = u then
    update profiles p set coins = p.coins + x.amt
      from (select user_id, sum(stack + total) as amt from holdem_seats where code = c group by user_id) x
     where p.id = x.user_id;
    delete from rooms where code = c;
    return;
  end if;
  if rm.game = 'holdem' then
    select * into s from holdem_seats where code = c and user_id = u for update;
    if s.user_id is not null then
      if rm.phase = 'hand' and s.in_hand then
        update holdem_seats set folded = true, acted = true, leaving = true where code = c and user_id = u;
        delete from room_members where code = c and user_id = u;
        perform holdem_advance(c);
        return;
      end if;
      update profiles set coins = coins + s.stack where id = u;
      delete from holdem_seats where code = c and user_id = u;
    end if;
  end if;
  delete from room_members where code = c and user_id = u;
end $$;

create or replace function public.get_room(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_code, ''))); rm rooms; mh jsonb;
begin
  if not is_member(c) then raise exception 'Du bist in diesem Raum nicht mehr dabei'; end if;
  select * into rm from rooms where code = c;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  select jsonb_build_object('hand', hand, 'done', done) into mh from poker_hands
   where code = c and round = rm.round and user_id = auth.uid();
  return jsonb_build_object('code', rm.code, 'host', rm.host, 'game', rm.game, 'phase', rm.phase, 'round', rm.round,
    'result', rm.result, 'payouts', rm.payouts, 'ante', rm.ante, 'pot', rm.pot, 'seats', rm.seats, 'my_hand', mh,
    'bb', rm.bb, 'board', rm.board, 'street', rm.street, 'cur', rm.cur, 'cbet', rm.cbet, 'minraise', rm.minraise, 'btn', rm.btn, 'log', rm.log,
    'hseats', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'seat', seat, 'stack', stack, 'bet', bet,
                'total', total, 'folded', folded, 'allin', allin, 'in_hand', in_hand) order by seat) from holdem_seats where code = c), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name) order by joined_at) from room_members where code = c), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'stake', stake)) from room_bets where code = c and round = rm.round), '[]'::jsonb));
end $$;

-- ---------- Rechte (alle Funktionen aus Schritt 1 bis 4) ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text), public.get_state(), public.claim_daily(), public.claim_rescue(),
  public.buy_item(text), public.equip_item(text, text), public.rename_profile(text),
  public.play_slots(int), public.play_roulette(jsonb),
  public.poker_deal(int), public.poker_draw(boolean[]),
  public.bj_deal(int), public.bj_hit(), public.bj_stand(), public.bj_double(),
  public.get_leaderboard(text), public.is_member(text),
  public.create_room(text), public.join_room(text), public.leave_room(text), public.get_room(text),
  public.room_bet(text, jsonb), public.room_spin(text), public.room_next(text),
  public.poker_start(text, int), public.poker_exchange(text, boolean[]), public.poker_force(text), public.poker_next(text),
  public.holdem_blinds(text, bigint), public.holdem_sit(text, bigint), public.holdem_standup(text),
  public.holdem_deal(text), public.holdem_act(text, text, bigint), public.holdem_skip(text)
to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
