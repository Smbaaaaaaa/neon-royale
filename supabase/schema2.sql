-- =====================================================================
-- NEON ROYALE, Schritt 2: Blackjack, Video Poker, Rangliste, Mehrspieler-Räume
-- Supabase > SQL Editor > New snippet > alles einfügen > Run.
-- Vorher muss schema.sql (Schritt 1) einmal gelaufen sein. Mehrfaches Ausführen ist unschädlich.
-- =====================================================================

-- ---------- Spielstände der Kartenspiele (für Clients unsichtbar) ----------
create table if not exists public.sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null, data jsonb not null, primary key (user_id, game));
alter table public.sessions enable row level security;

-- ---------- Karten ----------
create or replace function public.new_deck(n int) returns jsonb language sql volatile
set search_path = public, extensions as $$
  select jsonb_agg(jsonb_build_object('r', r, 's', s) order by k) from (
    select r, s, (('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) as k
    from generate_series(1, n) d, generate_series(0, 3) s, generate_series(2, 14) r) t
$$;

create or replace function public.bj_value(h jsonb) returns int language plpgsql set search_path = public as $$
declare t int := 0; a int := 0; r int; x jsonb;
begin
  for x in select * from jsonb_array_elements(h) loop
    r := (x->>'r')::int;
    if r = 14 then a := a + 1; t := t + 11; else t := t + least(r, 10); end if;
  end loop;
  while t > 21 and a > 0 loop t := t - 10; a := a - 1; end loop;
  return t;
end $$;

-- ---------- Video Poker (Jacks or Better) ----------
create or replace function public.poker_eval(h jsonb) returns text language plpgsql set search_path = public as $$
declare rs int[]; c int[]; fl boolean; st boolean; pj boolean;
begin
  select array_agg((x->>'r')::int order by (x->>'r')::int) into rs from jsonb_array_elements(h) x;
  fl := (select count(distinct x->>'s') from jsonb_array_elements(h) x) = 1;
  st := (select count(distinct x->>'r') from jsonb_array_elements(h) x) = 5 and (rs[5] - rs[1] = 4 or rs = array[2,3,4,5,14]);
  select array_agg(n order by n desc) into c from (select count(*)::int n from jsonb_array_elements(h) x group by x->>'r') t;
  pj := exists (select 1 from jsonb_array_elements(h) x group by x->>'r' having count(*) = 2 and max((x->>'r')::int) >= 11);
  if st and fl then return case when rs[1] = 10 then 'royal' else 'sflush' end; end if;
  if c[1] = 4 then return 'quads'; end if;
  if c[1] = 3 and c[2] = 2 then return 'full'; end if;
  if fl then return 'flush'; end if;
  if st then return 'straight'; end if;
  if c[1] = 3 then return 'trips'; end if;
  if c[1] = 2 and c[2] = 2 then return 'twopair'; end if;
  if pj then return 'jacks'; end if;
  return null;
end $$;

create or replace function public.poker_deal(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; deck jsonb; hand jsonb; rest jsonb;
begin
  if p_bet not in (2,5,10,20,50) then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  deck := new_deck(1);
  hand := (select jsonb_agg(deck -> i order by i) from generate_series(0, 4) i);
  rest := (select jsonb_agg(deck -> i order by i) from generate_series(5, 51) i);
  update profiles set coins = coins - p_bet where id = u;
  insert into sessions (user_id, game, data) values (u, 'poker', jsonb_build_object('bet', p_bet, 'hand', hand, 'rest', rest))
    on conflict (user_id, game) do update set data = excluded.data;
  return jsonb_build_object('hand', hand, 'coins', pr.coins - p_bet);
end $$;

create or replace function public.poker_draw(p_held boolean[]) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); st jsonb; hand jsonb; rest jsonb; i int; k int := 0;
  bet bigint; win_key text; mult int; pay bigint; new_coins bigint;
begin
  if p_held is null or array_length(p_held, 1) <> 5 then raise exception 'Ungültige Auswahl'; end if;
  select data into st from sessions where user_id = u and game = 'poker' for update;
  if st is null then raise exception 'Keine laufende Runde'; end if;
  hand := st->'hand'; rest := st->'rest'; bet := (st->>'bet')::bigint;
  for i in 1..5 loop
    if not p_held[i] then hand := jsonb_set(hand, array[(i - 1)::text], rest -> k); k := k + 1; end if;
  end loop;
  win_key := poker_eval(hand);
  mult := case win_key when 'royal' then 800 when 'sflush' then 50 when 'quads' then 25 when 'full' then 9
          when 'flush' then 6 when 'straight' then 4 when 'trips' then 3 when 'twopair' then 2 when 'jacks' then 1 else 0 end;
  pay := mult * bet;
  update profiles set coins = coins + pay where id = u returning coins into new_coins;
  perform bump_stat(u, 'poker', bet, pay);
  delete from sessions where user_id = u and game = 'poker';
  return jsonb_build_object('hand', hand, 'win', win_key, 'pay', pay, 'bet', bet, 'coins', new_coins);
end $$;

-- ---------- Blackjack ----------
create or replace function public.bj_finish(u uuid, st jsonb) returns jsonb language plpgsql set search_path = public as $$
declare pl jsonb := st->'player'; de jsonb := st->'dealer'; bet bigint := (st->>'bet')::bigint;
  pv int := bj_value(st->'player'); dv int := bj_value(st->'dealer');
  bj boolean := jsonb_array_length(st->'player') = 2 and bj_value(st->'player') = 21;
  pay bigint := 0; msg text; new_coins bigint;
begin
  if pv > 21 then msg := 'Bust. Du hast über 21.';
  elsif bj and not (jsonb_array_length(de) = 2 and dv = 21) then pay := floor(bet * 2.5); msg := 'Blackjack! Auszahlung 3:2.';
  elsif dv > 21 then pay := bet * 2; msg := 'Dealer Bust. Du gewinnst!';
  elsif pv > dv then pay := bet * 2; msg := 'Du gewinnst!';
  elsif pv = dv then pay := bet; msg := 'Unentschieden, Einsatz zurück.';
  else msg := 'Dealer gewinnt.'; end if;
  update profiles set coins = coins + pay where id = u returning coins into new_coins;
  perform bump_stat(u, 'blackjack', bet, pay);
  delete from sessions where user_id = u and game = 'blackjack';
  return jsonb_build_object('done', true, 'player', pl, 'dealer', de, 'pay', pay, 'bet', bet, 'msg', msg, 'bj', bj, 'coins', new_coins);
end $$;

create or replace function public.bj_stand_core(u uuid, st jsonb) returns jsonb language plpgsql set search_path = public as $$
declare shoe jsonb := st->'shoe'; de jsonb := st->'dealer'; n int;
begin
  while bj_value(de) < 17 loop
    n := jsonb_array_length(shoe);
    de := de || jsonb_build_array(shoe -> (n - 1)); shoe := shoe - (n - 1);
  end loop;
  return bj_finish(u, jsonb_set(jsonb_set(st, '{dealer}', de), '{shoe}', shoe));
end $$;

create or replace function public.bj_deal(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; shoe jsonb; pl jsonb; de jsonb; st jsonb;
begin
  if p_bet not in (2,5,10,20,50) then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  shoe := new_deck(6);
  pl := jsonb_build_array(shoe -> 311, shoe -> 310);
  de := jsonb_build_array(shoe -> 309, shoe -> 308);
  shoe := shoe - 311 - 310 - 309 - 308;
  update profiles set coins = coins - p_bet where id = u;
  st := jsonb_build_object('bet', p_bet, 'player', pl, 'dealer', de, 'shoe', shoe);
  if bj_value(pl) = 21 then return bj_finish(u, st); end if;
  insert into sessions (user_id, game, data) values (u, 'blackjack', st)
    on conflict (user_id, game) do update set data = excluded.data;
  return jsonb_build_object('done', false, 'player', pl, 'dealer', jsonb_build_array(de -> 0, '{"r":2,"s":0}'::jsonb),
                            'bet', p_bet, 'coins', pr.coins - p_bet);
end $$;

create or replace function public.bj_hit() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); st jsonb; shoe jsonb; n int; v int;
begin
  select data into st from sessions where user_id = u and game = 'blackjack' for update;
  if st is null then raise exception 'Keine laufende Runde'; end if;
  shoe := st->'shoe'; n := jsonb_array_length(shoe);
  st := jsonb_set(st, '{player}', (st->'player') || jsonb_build_array(shoe -> (n - 1)));
  st := jsonb_set(st, '{shoe}', shoe - (n - 1));
  v := bj_value(st->'player');
  if v > 21 then return bj_finish(u, st); end if;
  if v = 21 then return bj_stand_core(u, st); end if;
  update sessions set data = st where user_id = u and game = 'blackjack';
  return jsonb_build_object('done', false, 'player', st->'player',
    'dealer', jsonb_build_array((st->'dealer') -> 0, '{"r":2,"s":0}'::jsonb), 'bet', st->'bet');
end $$;

create or replace function public.bj_stand() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); st jsonb;
begin
  select data into st from sessions where user_id = u and game = 'blackjack' for update;
  if st is null then raise exception 'Keine laufende Runde'; end if;
  return bj_stand_core(u, st);
end $$;

create or replace function public.bj_double() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); st jsonb; shoe jsonb; n int; bet bigint; pr profiles;
begin
  select data into st from sessions where user_id = u and game = 'blackjack' for update;
  if st is null then raise exception 'Keine laufende Runde'; end if;
  if jsonb_array_length(st->'player') <> 2 then raise exception 'Verdoppeln geht nur mit zwei Karten'; end if;
  bet := (st->>'bet')::bigint;
  select * into pr from profiles where id = u for update;
  if pr.coins < bet then raise exception 'Zu wenig Coins zum Verdoppeln'; end if;
  update profiles set coins = coins - bet where id = u;
  shoe := st->'shoe'; n := jsonb_array_length(shoe);
  st := jsonb_set(st, '{bet}', to_jsonb(bet * 2));
  st := jsonb_set(st, '{player}', (st->'player') || jsonb_build_array(shoe -> (n - 1)));
  st := jsonb_set(st, '{shoe}', shoe - (n - 1));
  if bj_value(st->'player') > 21 then return bj_finish(u, st); end if;
  return bj_stand_core(u, st);
end $$;

-- ---------- Rangliste: nach gespielten Runden, nicht nach Coins oder Gewinnen ----------
create or replace function public.get_leaderboard(p_game text) returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select pr.name, sum(s.rounds)::int as rounds
    from stats s join profiles pr on pr.id = s.user_id
    where p_game = 'all' or s.game = p_game
    group by pr.id, pr.name order by sum(s.rounds) desc, pr.name limit 20) t
$$;

-- ---------- Roulette-Auswertung (gemeinsam genutzt) ----------
create or replace function public.roulette_mult(k text, n int) returns int language sql immutable set search_path = public as $$
  select case
    when k ~ '^n([0-9]|[12][0-9]|3[0-6])$' then (case when substr(k, 2)::int = n then 36 else 0 end)
    when k = 'red'   then (case when n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]) then 2 else 0 end)
    when k = 'black' then (case when n > 0 and not (n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])) then 2 else 0 end)
    when k = 'even'  then (case when n > 0 and n % 2 = 0 then 2 else 0 end)
    when k = 'odd'   then (case when n % 2 = 1 then 2 else 0 end)
    when k = 'low'   then (case when n between 1 and 18 then 2 else 0 end)
    when k = 'high'  then (case when n >= 19 then 2 else 0 end)
    when k = 'd1'    then (case when n between 1 and 12 then 3 else 0 end)
    when k = 'd2'    then (case when n between 13 and 24 then 3 else 0 end)
    when k = 'd3'    then (case when n >= 25 then 3 else 0 end)
    when k = 'c1'    then (case when n > 0 and n % 3 = 1 then 3 else 0 end)
    when k = 'c2'    then (case when n > 0 and n % 3 = 2 then 3 else 0 end)
    when k = 'c3'    then (case when n > 0 and n % 3 = 0 then 3 else 0 end)
    else null end
$$;

-- ---------- Mehrspieler-Räume (gemeinsames Roulette) ----------
create table if not exists public.rooms (
  code text primary key, host uuid not null references auth.users(id) on delete cascade,
  phase text not null default 'betting', round int not null default 1,
  result int, payouts jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists public.room_members (
  code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, joined_at timestamptz not null default now(), primary key (code, user_id));
create table if not exists public.room_bets (
  code text not null references public.rooms(code) on delete cascade, round int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, bets jsonb not null, stake bigint not null, primary key (code, round, user_id));

create or replace function public.is_member(c text) returns boolean language sql stable security definer
set search_path = public as $$ select exists (select 1 from room_members where code = c and user_id = auth.uid()) $$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_bets enable row level security;
drop policy if exists "Raum lesen" on public.rooms;
drop policy if exists "Mitglieder lesen" on public.room_members;
drop policy if exists "Wetten lesen" on public.room_bets;
create policy "Raum lesen" on public.rooms for select to authenticated using (is_member(code));
create policy "Mitglieder lesen" on public.room_members for select to authenticated using (is_member(code));
create policy "Wetten lesen" on public.room_bets for select to authenticated using (is_member(code));

do $$ begin
  begin alter publication supabase_realtime add table public.rooms; exception when others then null; end;
  begin alter publication supabase_realtime add table public.room_members; exception when others then null; end;
  begin alter publication supabase_realtime add table public.room_bets; exception when others then null; end;
end $$;

create or replace function public.create_room() returns text language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; c text; tries int := 0;
begin
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  delete from rooms where created_at < now() - interval '1 day';
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd_int(32) + 1, 1), '') from generate_series(1, 5));
    begin
      insert into rooms (code, host) values (c, u); exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 5 then raise exception 'Kein freier Raumcode, bitte nochmal'; end if;
    end;
  end loop;
  insert into room_members (code, user_id, name) values (c, u, pr.name);
  return c;
end $$;

create or replace function public.join_room(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pr profiles; c text := upper(trim(coalesce(p_code, '')));
begin
  select * into pr from profiles where id = u;
  if not found then raise exception 'Kein Profil'; end if;
  if not exists (select 1 from rooms where code = c) then raise exception 'Raum nicht gefunden'; end if;
  if not is_member(c) and (select count(*) from room_members where code = c) >= 8 then raise exception 'Der Raum ist voll'; end if;
  insert into room_members (code, user_id, name) values (c, u, pr.name)
    on conflict (code, user_id) do update set name = excluded.name;
  return c;
end $$;

create or replace function public.leave_room(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); c text := upper(trim(coalesce(p_code, '')));
begin
  if exists (select 1 from rooms where code = c and host = u) then delete from rooms where code = c;
  else delete from room_members where code = c and user_id = u; end if;
end $$;

create or replace function public.get_room(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_code, ''))); rm rooms;
begin
  if not is_member(c) then raise exception 'Du bist in diesem Raum nicht mehr dabei'; end if;
  select * into rm from rooms where code = c;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  return jsonb_build_object('code', rm.code, 'host', rm.host, 'phase', rm.phase, 'round', rm.round,
    'result', rm.result, 'payouts', rm.payouts,
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name) order by joined_at) from room_members where code = c), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'stake', stake)) from room_bets where code = c and round = rm.round), '[]'::jsonb));
end $$;

create or replace function public.room_bet(p_code text, p_bets jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); c text := upper(trim(coalesce(p_code, ''))); rm rooms; pr profiles; e record; amt bigint; stake bigint := 0;
begin
  if not is_member(c) then raise exception 'Du bist nicht in diesem Raum'; end if;
  if p_bets is null or jsonb_typeof(p_bets) <> 'object' then raise exception 'Ungültige Wetten'; end if;
  select * into rm from rooms where code = c for update;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  if rm.phase <> 'betting' then raise exception 'Gerade läuft keine Wettrunde'; end if;
  if exists (select 1 from room_bets where code = c and round = rm.round and user_id = u) then raise exception 'Du hast in dieser Runde schon gesetzt'; end if;
  select * into pr from profiles where id = u for update;
  for e in select key, value from jsonb_each_text(p_bets) loop
    amt := e.value::bigint;
    if amt <= 0 then raise exception 'Ungültiger Einsatz'; end if;
    if roulette_mult(e.key, 0) is null then raise exception 'Ungültige Wette: %', e.key; end if;
    stake := stake + amt;
  end loop;
  if stake = 0 then raise exception 'Keine Wetten gesetzt'; end if;
  if pr.coins < stake then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - stake where id = u;
  insert into room_bets (code, round, user_id, name, bets, stake) values (c, rm.round, u, pr.name, p_bets, stake);
  return jsonb_build_object('coins', pr.coins - stake);
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
    outp := outp || jsonb_build_object('user_id', b.user_id, 'name', b.name, 'stake', b.stake, 'pay', pay);
    cnt := cnt + 1;
  end loop;
  if cnt = 0 then raise exception 'Noch niemand hat gesetzt'; end if;
  update rooms set phase = 'result', result = n, payouts = outp where code = rm.code;
  return n;
end $$;

create or replace function public.room_next(p_code text) returns void language plpgsql security definer set search_path = public as $$
begin
  update rooms set phase = 'betting', round = round + 1, result = null, payouts = '[]'::jsonb
   where code = upper(trim(coalesce(p_code, ''))) and host = auth.uid() and phase = 'result';
  if not found then raise exception 'Nächste Runde nicht möglich'; end if;
end $$;

-- ---------- Rechte (enthält auch alle Funktionen aus Schritt 1) ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text), public.get_state(), public.claim_daily(), public.claim_rescue(),
  public.buy_item(text), public.equip_item(text, text), public.rename_profile(text),
  public.play_slots(int), public.play_roulette(jsonb),
  public.poker_deal(int), public.poker_draw(boolean[]),
  public.bj_deal(int), public.bj_hit(), public.bj_stand(), public.bj_double(),
  public.get_leaderboard(text), public.is_member(text),
  public.create_room(), public.join_room(text), public.leave_room(text), public.get_room(text),
  public.room_bet(text, jsonb), public.room_spin(text), public.room_next(text)
to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
