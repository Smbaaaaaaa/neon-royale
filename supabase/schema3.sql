-- =====================================================================
-- NEON ROYALE, Schritt 3: Poker-Räume (Five Card Draw für 2 bis 5 Spieler)
-- Reihenfolge: schema.sql, schema2.sql, danach diese Datei. Mehrfaches Ausführen ist unschädlich.
-- =====================================================================
alter table public.rooms add column if not exists game text not null default 'roulette';
alter table public.rooms add column if not exists ante int not null default 0;
alter table public.rooms add column if not exists pot bigint not null default 0;
alter table public.rooms add column if not exists seats jsonb not null default '[]';

create table if not exists public.poker_hands (
  code text not null references public.rooms(code) on delete cascade, round int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  hand jsonb not null, done boolean not null default false, primary key (code, round, user_id));
create table if not exists public.poker_decks (
  code text primary key references public.rooms(code) on delete cascade, deck jsonb not null);
alter table public.poker_hands enable row level security;
alter table public.poker_decks enable row level security;
drop policy if exists "eigene Hand" on public.poker_hands;
create policy "eigene Hand" on public.poker_hands for select to authenticated using (user_id = auth.uid());

-- Handwert zum Vergleichen: Kategorie (0 Hohe Karte ... 8 Straight Flush) und Kicker
create or replace function public.poker_rank(h jsonb) returns bigint language plpgsql set search_path = public as $$
declare ord int[]; cnts int[]; rs int[]; fl boolean; st boolean; cat int; sc bigint := 0; i int;
begin
  select array_agg(r order by cnt desc, r desc), array_agg(cnt order by cnt desc, r desc) into ord, cnts
    from (select (x->>'r')::int r, count(*)::int cnt from jsonb_array_elements(h) x group by (x->>'r')::int) t;
  select array_agg((x->>'r')::int order by (x->>'r')::int) into rs from jsonb_array_elements(h) x;
  fl := (select count(distinct x->>'s') from jsonb_array_elements(h) x) = 1;
  st := array_length(ord, 1) = 5 and (rs[5] - rs[1] = 4 or rs = array[2,3,4,5,14]);
  if st and rs = array[2,3,4,5,14] then ord := array[5,4,3,2,1]; end if;
  cat := case when st and fl then 8 when cnts[1] = 4 then 7 when cnts[1] = 3 and cnts[2] = 2 then 6 when fl then 5
              when st then 4 when cnts[1] = 3 then 3 when cnts[1] = 2 and cnts[2] = 2 then 2 when cnts[1] = 2 then 1 else 0 end;
  for i in 1..5 loop sc := sc * 15 + coalesce(ord[i], 0); end loop;
  return cat::bigint * 759375 + sc;
end $$;

-- Raum erstellen: jetzt mit Spielwahl
drop function if exists public.create_room();
create or replace function public.create_room(p_game text default 'roulette') returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; c text; tries int := 0;
begin
  if p_game not in ('roulette', 'poker') then raise exception 'Unbekanntes Spiel'; end if;
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  delete from rooms where created_at < now() - interval '1 day';
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd_int(32) + 1, 1), '') from generate_series(1, 5));
    begin
      insert into rooms (code, host, game, phase) values (c, u, p_game, case p_game when 'poker' then 'lobby' else 'betting' end);
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 5 then raise exception 'Kein freier Raumcode, bitte nochmal'; end if;
    end;
  end loop;
  insert into room_members (code, user_id, name) values (c, u, pr.name);
  return c;
end $$;

-- Beitreten: Poker maximal 5 Spieler (so reicht das Kartenspiel für alle Tauschkarten), Roulette 8
create or replace function public.join_room(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pr profiles; rm rooms; c text := upper(trim(coalesce(p_code, '')));
begin
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  select * into rm from rooms where code = c;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if not is_member(c) and (select count(*) from room_members where code = c) >= (case rm.game when 'poker' then 5 else 8 end) then
    raise exception 'Der Raum ist voll'; end if;
  insert into room_members (code, user_id, name) values (c, u, pr.name)
    on conflict (code, user_id) do update set name = excluded.name;
  return c;
end $$;

-- Raumzustand inklusive eigener Hand
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
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name) order by joined_at) from room_members where code = c), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'stake', stake)) from room_bets where code = c and round = rm.round), '[]'::jsonb));
end $$;

-- Runde starten (Gastgeber): jeder zahlt den Einsatz in den Pot, jeder bekommt 5 Karten
create or replace function public.poker_start(p_code text, p_ante int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; m record; pr profiles; deck jsonb; hand jsonb; idx int := 0;
  v_pot bigint := 0; v_seats jsonb := '[]'::jsonb;
begin
  if p_ante not in (2,5,10,20,50) then raise exception 'Ungültiger Einsatz'; end if;
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.game <> 'poker' then raise exception 'Das ist kein Poker-Raum'; end if;
  if rm.host <> u then raise exception 'Nur der Gastgeber darf starten'; end if;
  if rm.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  deck := new_deck(1);
  delete from poker_hands where code = rm.code and round = rm.round;
  for m in select user_id, name from room_members where code = rm.code order by joined_at loop
    select * into pr from profiles where id = m.user_id for update;
    if pr.coins >= p_ante then
      update profiles set coins = coins - p_ante where id = m.user_id;
      hand := (select jsonb_agg(deck -> i order by i) from generate_series(idx, idx + 4) i);
      idx := idx + 5; v_pot := v_pot + p_ante;
      insert into poker_hands (code, round, user_id, hand) values (rm.code, rm.round, m.user_id, hand);
      v_seats := v_seats || jsonb_build_object('user_id', m.user_id, 'name', m.name, 'done', false);
    end if;
  end loop;
  if jsonb_array_length(v_seats) < 2 then raise exception 'Es braucht mindestens 2 Spieler mit genug Coins'; end if;
  insert into poker_decks (code, deck) values (rm.code, (select jsonb_agg(deck -> i order by i) from generate_series(idx, 51) i))
    on conflict (code) do update set deck = excluded.deck;
  update rooms set phase = 'draw', ante = p_ante, pot = v_pot, seats = v_seats, result = null, payouts = '[]'::jsonb where code = rm.code;
end $$;

-- Showdown: bester Handwert gewinnt den Pot, bei Gleichstand wird geteilt
create or replace function public.poker_showdown(c text) returns void language plpgsql security definer set search_path = public as $$
declare rm rooms; ph record; best bigint; winners int; share bigint; extra bigint; pay bigint; first_w boolean := true; outp jsonb := '[]'::jsonb;
begin
  select * into rm from rooms where code = c for update;
  select max(poker_rank(hand)) into best from poker_hands where code = c and round = rm.round;
  select count(*) into winners from poker_hands where code = c and round = rm.round and poker_rank(hand) = best;
  share := rm.pot / winners; extra := rm.pot - share * winners;
  for ph in select h.user_id, h.hand, poker_rank(h.hand) as sc,
              coalesce((select name from room_members m where m.code = c and m.user_id = h.user_id), 'Spieler') as nm
            from poker_hands h where h.code = c and h.round = rm.round order by h.user_id loop
    pay := 0;
    if ph.sc = best then pay := share + (case when first_w then extra else 0 end); first_w := false; end if;
    if pay > 0 then update profiles set coins = coins + pay where id = ph.user_id; end if;
    perform bump_stat(ph.user_id, 'poker', rm.ante, pay);
    outp := outp || jsonb_build_object('user_id', ph.user_id, 'name', ph.nm, 'hand', ph.hand, 'cat', ph.sc / 759375,
                                       'stake', rm.ante, 'pay', pay, 'win', ph.sc = best);
  end loop;
  update rooms set phase = 'showdown', payouts = outp where code = c;
  delete from poker_decks where code = c;
end $$;

-- Karten tauschen (jeder genau einmal); wenn alle fertig sind, folgt automatisch der Showdown
create or replace function public.poker_exchange(p_code text, p_held boolean[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; ph poker_hands; dk jsonb; nh jsonb; i int; k int := 0;
begin
  if p_held is null or array_length(p_held, 1) <> 5 then raise exception 'Ungültige Auswahl'; end if;
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.game <> 'poker' or rm.phase <> 'draw' then raise exception 'Gerade läuft keine Tauschrunde'; end if;
  select * into ph from poker_hands where code = rm.code and round = rm.round and user_id = u for update;
  if not found then raise exception 'Du bist in dieser Runde nicht dabei'; end if;
  if ph.done then raise exception 'Du hast schon getauscht'; end if;
  select deck into dk from poker_decks where code = rm.code;
  nh := ph.hand;
  for i in 1..5 loop
    if not p_held[i] then nh := jsonb_set(nh, array[(i - 1)::text], dk -> k); k := k + 1; end if;
  end loop;
  update poker_decks set deck = (select coalesce(jsonb_agg(dk -> j order by j), '[]'::jsonb) from generate_series(k, jsonb_array_length(dk) - 1) j)
   where code = rm.code;
  update poker_hands set hand = nh, done = true where code = rm.code and round = rm.round and user_id = u;
  update rooms set seats = (select jsonb_agg(case when s->>'user_id' = u::text then jsonb_set(s, '{done}', 'true'::jsonb) else s end order by o)
                              from jsonb_array_elements(rm.seats) with ordinality t(s, o))
   where code = rm.code;
  if not exists (select 1 from poker_hands where code = rm.code and round = rm.round and not done) then
    perform poker_showdown(rm.code);
  end if;
end $$;

-- Gastgeber: Runde beenden, auch wenn jemand nicht tauscht (dessen Hand bleibt, wie sie ist)
create or replace function public.poker_force(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare rm rooms;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.host <> auth.uid() then raise exception 'Nur der Gastgeber darf das'; end if;
  if rm.game <> 'poker' or rm.phase <> 'draw' then raise exception 'Gerade läuft keine Tauschrunde'; end if;
  update poker_hands set done = true where code = rm.code and round = rm.round;
  perform poker_showdown(rm.code);
end $$;

create or replace function public.poker_next(p_code text) returns void language plpgsql security definer set search_path = public as $$
begin
  update rooms set phase = 'lobby', round = round + 1, result = null, payouts = '[]'::jsonb, seats = '[]'::jsonb, pot = 0
   where code = upper(trim(coalesce(p_code, ''))) and host = auth.uid() and game = 'poker' and phase = 'showdown';
  if not found then raise exception 'Nächste Runde nicht möglich'; end if;
end $$;

-- ---------- Rechte (alle Funktionen aus Schritt 1 bis 3) ----------
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
  public.poker_start(text, int), public.poker_exchange(text, boolean[]), public.poker_force(text), public.poker_next(text)
to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
