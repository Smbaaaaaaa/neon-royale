-- =====================================================================
-- ROYALE, Schritt 13: Rangliste (3 Tabellen), öffentliche Profile, Slot-Gewinne von beiden Seiten,
-- Ranked-Turniere (Sieger bekommt alles) und Verdienst-Anzeige im Multiplayer
-- Reihenfolge: nach schema11_und_12.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- =====================================================================

-- ---------- Rangliste: Höchstes Guthaben und insgesamt Gewonnenes ----------
alter table public.profiles add column if not exists peak bigint not null default 50;
update public.profiles set peak = greatest(peak, coins);
alter table public.stats add column if not exists won bigint not null default 0;

create or replace function public.track_peak() returns trigger language plpgsql as $$
begin
  new.peak := greatest(old.peak, new.coins);
  return new;
end $$;
drop trigger if exists trg_peak on public.profiles;
create trigger trg_peak before update of coins on public.profiles for each row execute function public.track_peak();

create or replace function public.bump_stat(u uuid, g text, stake bigint, pay bigint) returns void
language sql set search_path = public as $$
  insert into stats (user_id, game, rounds, wins, best, won)
  values (u, g, 1, (pay > stake)::int, greatest(pay - stake, 0), greatest(pay - stake, 0))
  on conflict (user_id, game) do update set
    rounds = stats.rounds + 1,
    wins = stats.wins + (pay > stake)::int,
    best = greatest(stats.best, pay - stake),
    won = stats.won + greatest(pay - stake, 0)
$$;

create or replace function public.get_leaderboard(p_game text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
begin
  if p_game = 'peak' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, eq, peak as value from profiles order by peak desc, name limit 20) t), '[]'::jsonb);
  elsif p_game = 'won' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from (
      select pr.id, pr.name, pr.eq, sum(s.won)::bigint as value from stats s join profiles pr on pr.id = s.user_id
      group by pr.id having sum(s.won) > 0 order by sum(s.won) desc, pr.name limit 20) t), '[]'::jsonb);
  elsif p_game = 'ranked' then
    return coalesce((select jsonb_agg(to_jsonb(t)) from (
      select pr.id, pr.name, pr.eq, s.wins as value, s.rounds from stats s join profiles pr on pr.id = s.user_id
      where s.game = 'ranked' order by s.wins desc, s.rounds desc, pr.name limit 20) t), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(to_jsonb(t)) from (
    select pr.id, pr.name, pr.eq, sum(s.rounds)::int as value from stats s join profiles pr on pr.id = s.user_id
    where p_game = 'all' or s.game = p_game group by pr.id order by sum(s.rounds) desc, pr.name limit 20) t), '[]'::jsonb);
end $$;

-- ---------- Öffentliches Profil (ohne aktuelles Guthaben) ----------
create or replace function public.get_public_profile(p_id uuid) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare pr profiles;
begin
  select * into pr from profiles where id = p_id;
  if not found then raise exception 'Profil nicht gefunden'; end if;
  return jsonb_build_object('id', pr.id, 'name', pr.name, 'eq', pr.eq, 'peak', pr.peak,
    'inventory', coalesce((select jsonb_agg(item_id) from inventory where user_id = p_id), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s where user_id = p_id), '[]'::jsonb));
end $$;

-- ---------- Slot Machine: Gewinne zählen von links UND von rechts ----------
create or replace function public.play_slots(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid := auth.uid(); pr profiles;
  syms text[] := array['cherry','lemon','bell','bar','seven','diamond'];
  w int[] := array[30,26,18,12,8,5];
  pays jsonb := '{"cherry":[1,2,6],"lemon":[1,3,9],"bell":[2,5,15],"bar":[3,10,30],"seven":[8,24,85],"diamond":[13,40,150]}';
  lns int[] := array[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1]];
  g text[]; r int; acc int; i int; j int; k int; li int; s text; n int; m int;
  pay bigint; total bigint := 0; wins jsonb := '[]'::jsonb;
begin
  if p_bet not in (2,5,10,20,50,100,500,1000) then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  g := array_fill(''::text, array[5,3]);
  for i in 1..5 loop
    for j in 1..3 loop
      r := rnd_int(99); acc := 0;
      for k in 1..6 loop
        acc := acc + w[k];
        if r < acc then g[i][j] := syms[k]; exit; end if;
      end loop;
    end loop;
  end loop;
  for li in 1..9 loop
    s := g[1][lns[li][1] + 1]; n := 1;
    while n < 5 and g[n + 1][lns[li][n + 1] + 1] = s loop n := n + 1; end loop;
    if n >= 3 then
      pay := round(((pays -> s -> (n - 3))::text)::numeric * p_bet / 2.0);
      total := total + pay;
      wins := wins || jsonb_build_object('line', li - 1, 'symbol', s, 'count', n, 'dir', 1, 'pay', pay);
    end if;
    if n < 5 then
      s := g[5][lns[li][5] + 1]; m := 1;
      while m < 5 and g[5 - m][lns[li][5 - m] + 1] = s loop m := m + 1; end loop;
      if m >= 3 then
        pay := round(((pays -> s -> (m - 3))::text)::numeric * p_bet / 2.0);
        total := total + pay;
        wins := wins || jsonb_build_object('line', li - 1, 'symbol', s, 'count', m, 'dir', -1, 'pay', pay);
      end if;
    end if;
  end loop;
  update profiles set coins = coins - p_bet + total where id = u;
  perform bump_stat(u, 'slots', p_bet, total);
  return jsonb_build_object('grid', to_jsonb(g), 'wins', wins, 'total', total, 'coins', pr.coins - p_bet + total);
end $$;

-- ---------- Multiplayer: Friendly und Ranked, Verdienst pro Spieler ----------
alter table public.rooms add column if not exists mode text not null default 'friendly';
alter table public.rooms add column if not exists pool bigint not null default 0;
alter table public.rooms add column if not exists started boolean not null default false;
alter table public.rooms add column if not exists players jsonb not null default '[]';
alter table public.room_members add column if not exists net bigint not null default 0;

drop function if exists public.create_room(text);
create or replace function public.create_room(p_game text default 'roulette', p_mode text default 'friendly') returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; c text; tries int := 0;
begin
  if p_game not in ('roulette', 'poker', 'holdem') then raise exception 'Unbekanntes Spiel'; end if;
  if p_mode not in ('friendly', 'ranked') then raise exception 'Unbekannter Modus'; end if;
  if p_mode = 'ranked' and p_game <> 'holdem' then raise exception 'Ranked gibt es nur bei Texas Hold''em'; end if;
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  delete from rooms where created_at < now() - interval '1 day';
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd_int(32) + 1, 1), '') from generate_series(1, 5));
    begin
      insert into rooms (code, host, game, phase, mode)
        values (c, u, p_game, case when p_game in ('poker', 'holdem') then 'lobby' else 'betting' end, p_mode);
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 5 then raise exception 'Kein freier Raumcode, bitte nochmal'; end if;
    end;
  end loop;
  insert into room_members (code, user_id, name) values (c, u, pr.name);
  return c;
end $$;

-- Ranked: Turnier-Einsatz = 50 Big Blinds, Sieger bekommt den ganzen Preispool
create or replace function public.holdem_sit(p_code text, p_buyin bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); rm rooms; pr profiles; s holdem_seats; sn int; amt bigint;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Das ist kein Hold''em-Raum'; end if;
  if not is_member(rm.code) then raise exception 'Du bist nicht in diesem Raum'; end if;
  select * into pr from profiles where id = u for update;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  if rm.mode = 'ranked' then
    if rm.started or rm.phase <> 'lobby' then raise exception 'Das Ranked-Turnier läuft schon'; end if;
    if s.user_id is not null then raise exception 'Du sitzt schon am Tisch'; end if;
    amt := rm.bb * 50;
  else
    if rm.phase not in ('lobby', 'showdown') then raise exception 'Setz dich zwischen zwei Händen hin'; end if;
    if p_buyin < rm.bb * 20 or p_buyin > rm.bb * 200 then raise exception 'Buy-in muss zwischen % und % RC liegen', rm.bb * 20, rm.bb * 200; end if;
    amt := p_buyin;
  end if;
  if pr.coins < amt then raise exception 'Zu wenig Coins'; end if;
  if s.user_id is not null then
    if s.stack + amt > rm.bb * 200 then raise exception 'Dein Stack darf höchstens % RC groß sein', rm.bb * 200; end if;
    update holdem_seats set stack = stack + amt where code = rm.code and user_id = u;
  else
    select min(g) into sn from generate_series(1, 9) g where not exists (select 1 from holdem_seats where code = rm.code and seat = g);
    if sn is null then raise exception 'Der Tisch ist voll'; end if;
    insert into holdem_seats (code, user_id, name, seat, stack) values (rm.code, u, pr.name, sn, amt);
  end if;
  update profiles set coins = coins - amt where id = u;
  if rm.mode = 'ranked' then
    update rooms set pool = pool + amt, players = players || jsonb_build_object('user_id', u, 'name', pr.name) where code = rm.code;
  end if;
end $$;

create or replace function public.holdem_standup(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); rm rooms; s holdem_seats;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  if s.user_id is null then raise exception 'Du sitzt nicht am Tisch'; end if;
  if rm.mode = 'ranked' then
    if rm.started or rm.phase <> 'lobby' then raise exception 'Im laufenden Ranked-Turnier kannst du nicht aufstehen'; end if;
    update rooms set pool = pool - s.stack,
      players = coalesce((select jsonb_agg(x) from jsonb_array_elements(players) x where x->>'user_id' <> u::text), '[]'::jsonb) where code = rm.code;
  elsif rm.phase not in ('lobby', 'showdown') then
    raise exception 'Du kannst erst nach der Hand aufstehen';
  end if;
  update profiles set coins = coins + s.stack where id = u;
  delete from holdem_seats where code = rm.code and user_id = u;
end $$;

-- Turnier-Ende: Wenn nur noch einer Chips hat, bekommt er den ganzen Preispool
create or replace function public.holdem_end_check(c text) returns void language plpgsql security definer set search_path = public as $$
declare rm rooms; n_alive int; w_id uuid; pl jsonb; buyin bigint;
begin
  select * into rm from rooms where code = c for update;
  if not found or rm.mode <> 'ranked' or not rm.started or rm.phase = 'finished' then return; end if;
  select count(*) into n_alive from holdem_seats where code = c and stack > 0;
  if n_alive > 1 then return; end if;
  select user_id into w_id from holdem_seats where code = c and stack > 0 limit 1;
  buyin := rm.bb * 50;
  if w_id is not null then update profiles set coins = coins + rm.pool where id = w_id; end if;
  for pl in select * from jsonb_array_elements(rm.players) loop
    perform bump_stat((pl->>'user_id')::uuid, 'ranked', buyin, case when (pl->>'user_id')::uuid = w_id then rm.pool else 0 end);
    update room_members set net = case when (pl->>'user_id')::uuid = w_id then rm.pool - buyin else 0 - buyin end
     where code = c and user_id = (pl->>'user_id')::uuid;
  end loop;
  update holdem_seats set stack = 0 where code = c;
  update rooms set phase = 'finished' where code = c;
  perform h_log(c, coalesce((select name from room_members where code = c and user_id = w_id), 'Jemand') || ' gewinnt das Turnier und ' || rm.pool || ' RC');
end $$;

create or replace function public.holdem_reset(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare rm rooms;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Raum nicht gefunden'; end if;
  if rm.host <> auth.uid() then raise exception 'Nur der Gastgeber darf das'; end if;
  if rm.phase <> 'finished' then raise exception 'Das Turnier läuft noch'; end if;
  delete from holdem_seats where code = rm.code;
  update rooms set phase = 'lobby', started = false, pool = 0, players = '[]'::jsonb, round = round + 1, board = '[]'::jsonb,
         cur = null, payouts = '[]'::jsonb, log = '[]'::jsonb, cbet = 0, minraise = 0, pot = 0 where code = rm.code;
  update room_members set net = 0 where code = rm.code;
end $$;

-- Verlassen: Gastgeber schließt den Raum (Chips zurück, bei Ranked anteilig am Preispool). Ranked-Einsatz verfällt nach dem Start.
create or replace function public.leave_room(p_code text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); c text := upper(trim(coalesce(p_code, ''))); rm rooms; s holdem_seats; sumchips numeric;
begin
  select * into rm from rooms where code = c for update;
  if not found then return; end if;
  if rm.host = u then
    if rm.mode = 'ranked' then
      select coalesce(sum(stack + total), 0) into sumchips from holdem_seats where code = c;
      if sumchips > 0 then
        update profiles p set coins = p.coins + floor(rm.pool * x.amt::numeric / sumchips)
          from (select user_id, sum(stack + total) as amt from holdem_seats where code = c group by user_id) x where p.id = x.user_id;
      end if;
    else
      update profiles p set coins = p.coins + x.amt
        from (select user_id, sum(stack + total) as amt from holdem_seats where code = c group by user_id) x where p.id = x.user_id;
    end if;
    delete from rooms where code = c;
    return;
  end if;
  if rm.game = 'holdem' then
    select * into s from holdem_seats where code = c and user_id = u for update;
    if s.user_id is not null then
      if rm.mode = 'ranked' then
        if not rm.started then
          update profiles set coins = coins + s.stack where id = u;
          update rooms set pool = pool - s.stack,
            players = coalesce((select jsonb_agg(x) from jsonb_array_elements(players) x where x->>'user_id' <> u::text), '[]'::jsonb) where code = c;
          delete from holdem_seats where code = c and user_id = u;
        elsif rm.phase = 'hand' and s.in_hand then
          update holdem_seats set folded = true, acted = true, leaving = true where code = c and user_id = u;
          delete from room_members where code = c and user_id = u;
          perform holdem_advance(c);
          return;
        else
          delete from holdem_seats where code = c and user_id = u;
          delete from room_members where code = c and user_id = u;
          perform holdem_end_check(c);
          return;
        end if;
      else
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
  end if;
  delete from room_members where code = c and user_id = u;
end $$;

-- ---------- angepasste Spiel-Funktionen (Verdienst pro Spieler, Ranked) ----------
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
    if rm.mode <> 'ranked' then perform bump_stat(s.user_id, 'holdem', s.total, wamt); end if;
    update room_members set net = net + (wamt - s.total) where code = c and user_id = s.user_id;
    if wamt > s.total then perform h_log(c, s.name || ' gewinnt ' || (wamt - s.total) || ' RC'); end if;
  end loop;
  for s in select * from holdem_seats where code = c and leaving loop
    if rm.mode <> 'ranked' then update profiles set coins = coins + s.stack where id = s.user_id; end if;
    delete from holdem_seats where code = c and user_id = s.user_id;
  end loop;
  update rooms set phase = 'showdown', cur = null, payouts = outp where code = c;
  perform holdem_end_check(c);
  delete from poker_decks where code = c;
end $$;

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
  if rm.mode = 'ranked' and not rm.started then update rooms set started = true where code = c; end if;
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

create or replace function public.room_spin(p_code text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; n int; b record; e record; pay bigint; outp jsonb := '[]'::jsonb; cnt int := 0;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.host <> u then raise exception 'Nur der Gastgeber darf drehen'; end if;
  if rm.phase <> 'betting' then raise exception 'Gerade läuft keine Wettrunde'; end if;
  n := rnd_int(37);
  for b in select * from room_bets where code = rm.code and round = rm.round loop
    pay := 0;
    for e in select key, value from jsonb_each_text(b.bets) loop
      pay := pay + coalesce(roulette_mult(e.key, n), 0) * e.value::bigint;
    end loop;
    update profiles set coins = coins + pay where id = b.user_id;
    perform bump_stat(b.user_id, 'roulette', b.stake, pay);
    update room_members set net = net + (pay - b.stake) where code = rm.code and user_id = b.user_id;
    outp := outp || jsonb_build_object('user_id', b.user_id, 'name', b.name, 'stake', b.stake, 'pay', pay);
    cnt := cnt + 1;
  end loop;
  if cnt = 0 then raise exception 'Noch niemand hat gesetzt'; end if;
  update rooms set phase = 'result', result = n, payouts = outp where code = rm.code;
  return n;
end $$;

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
    update room_members set net = net + (pay - rm.ante) where code = c and user_id = ph.user_id;
    outp := outp || jsonb_build_object('user_id', ph.user_id, 'name', ph.nm, 'hand', ph.hand, 'cat', ph.sc / 759375,
                                       'stake', rm.ante, 'pay', pay, 'win', ph.sc = best);
  end loop;
  update rooms set phase = 'showdown', payouts = outp where code = c;
  delete from poker_decks where code = c;
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
    'bb', rm.bb, 'mode', rm.mode, 'pool', rm.pool, 'started', rm.started, 'board', rm.board, 'street', rm.street, 'cur', rm.cur, 'cbet', rm.cbet, 'minraise', rm.minraise, 'btn', rm.btn, 'log', rm.log,
    'hseats', coalesce((select jsonb_agg(jsonb_build_object('user_id', hs.user_id, 'name', hs.name, 'seat', hs.seat, 'stack', hs.stack, 'bet', hs.bet,
                'total', hs.total, 'folded', hs.folded, 'allin', hs.allin, 'in_hand', hs.in_hand,
                'eq', (select pr2.eq from profiles pr2 where pr2.id = hs.user_id)) order by hs.seat) from holdem_seats hs where hs.code = c), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.name,
                'eq', (select pr3.eq from profiles pr3 where pr3.id = m.user_id), 'net', m.net) order by m.joined_at) from room_members m where m.code = c), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'stake', stake)) from room_bets where code = c and round = rm.round), '[]'::jsonb));
end $$;

-- ---------- Rechte: alle Funktionen neu setzen ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text), public.get_state(), public.claim_daily(), public.claim_rescue(),
  public.buy_item(text), public.equip_item(text, text), public.rename_profile(text),
  public.play_slots(int), public.play_roulette(jsonb),
  public.poker_deal(int), public.poker_draw(boolean[]),
  public.bj_deal(int), public.bj_hit(), public.bj_stand(), public.bj_double(),
  public.get_leaderboard(text), public.get_public_profile(uuid), public.is_member(text),
  public.create_room(text, text), public.join_room(text), public.leave_room(text), public.get_room(text),
  public.room_bet(text, jsonb), public.room_spin(text), public.room_next(text),
  public.poker_start(text, int), public.poker_exchange(text, boolean[]), public.poker_force(text), public.poker_next(text),
  public.holdem_blinds(text, bigint), public.holdem_sit(text, bigint), public.holdem_standup(text),
  public.holdem_deal(text), public.holdem_act(text, text, bigint), public.holdem_skip(text), public.holdem_reset(text),
  public.open_mystery_box(text), public.open_daily_box(),
  public.scratch_buy(int), public.scratch_reveal(uuid), public.scratch_list(), public.claim_bonus(text)
to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
