-- =====================================================================
-- NEON ROYALE, Schritt 1: Konten, Guthaben, Shop, Slots, Roulette
-- Supabase-Dashboard > SQL Editor > New query > alles einfügen > Run.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabellen ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 16),
  coins bigint not null default 50 check (coins >= 0),
  last_daily date,
  last_rescue date,
  eq jsonb not null default '{"frame":"none","avatar":"default","skin":"chrome"}',
  codes text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  primary key (user_id, item_id)
);
create table if not exists public.stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  rounds int not null default 0,
  wins int not null default 0,
  best bigint not null default 0,
  primary key (user_id, game)
);
create table if not exists public.items (
  id text primary key, type text not null, val text not null, price int not null, bonus int not null default 0
);
insert into public.items (id, type, val, price, bonus) values
 ('starter3','bonus','starter',0,10000),
 ('frame-pink','frame','pink',300,0),('frame-violet','frame','violet',300,0),('frame-gold','frame','gold',800,0),('frame-rainbow','frame','rainbow',2500,0),
 ('av-fox','avatar','fox',200,0),('av-joker','avatar','joker',400,0),('av-dragon','avatar','dragon',600,0),
 ('av-unicorn','avatar','unicorn',800,0),('av-rocket','avatar','rocket',1000,0),('av-crown','avatar','crown',1500,0),
 ('skin-night','skin','night',1000,0),('skin-gold','skin','gold',1500,0),('skin-neon','skin','neon',2500,0)
on conflict (id) do nothing;

-- ---------- Zugriffsregeln: lesen nur die eigenen Daten, schreiben nur über Funktionen ----------
alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.stats enable row level security;
alter table public.items enable row level security;
drop policy if exists "eigenes Profil" on public.profiles;
drop policy if exists "eigenes Inventar" on public.inventory;
drop policy if exists "eigene Stats" on public.stats;
drop policy if exists "Items lesbar" on public.items;
create policy "eigenes Profil" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "eigenes Inventar" on public.inventory for select to authenticated using (auth.uid() = user_id);
create policy "eigene Stats" on public.stats for select to authenticated using (auth.uid() = user_id);
create policy "Items lesbar" on public.items for select to authenticated using (true);

-- ---------- Hilfsfunktionen ----------
-- Zufallszahl 0..n-1 aus kryptografischen Zufallsbytes
create or replace function public.rnd_int(n int) returns int language sql volatile
set search_path = public, extensions as $$
  select (('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % n)::int
$$;

create or replace function public.bump_stat(u uuid, g text, stake bigint, pay bigint) returns void
language sql set search_path = public as $$
  insert into stats (user_id, game, rounds, wins, best)
  values (u, g, 1, (pay > stake)::int, greatest(pay - stake, 0))
  on conflict (user_id, game) do update set
    rounds = stats.rounds + 1,
    wins = stats.wins + (pay > stake)::int,
    best = greatest(stats.best, pay - stake)
$$;

-- ---------- Konto ----------
create or replace function public.ensure_profile(p_name text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 16);
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if char_length(v) < 2 then raise exception 'Der Name braucht mindestens 2 Zeichen'; end if;
  insert into profiles (id, name) values (auth.uid(), v) on conflict (id) do nothing;
end $$;

create or replace function public.get_state() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles;
begin
  select * into pr from profiles where id = u;
  if not found then return jsonb_build_object('profile', null); end if;
  return jsonb_build_object(
    'profile', to_jsonb(pr),
    'inventory', coalesce((select jsonb_agg(item_id) from inventory where user_id = u), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s where user_id = u), '[]'::jsonb));
end $$;

create or replace function public.claim_daily() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set coins = coins + 1000, last_daily = current_date
   where id = auth.uid() and (last_daily is null or last_daily < current_date);
  if not found then raise exception 'Tagesbonus heute schon abgeholt'; end if;
end $$;

create or replace function public.claim_rescue() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set coins = coins + 10, last_rescue = current_date
   where id = auth.uid() and coins < 2 and (last_rescue is null or last_rescue < current_date);
  if not found then raise exception 'Nachschub gerade nicht möglich'; end if;
end $$;

create or replace function public.buy_item(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); it items; pr profiles;
begin
  select * into it from items where id = p_id;
  if not found then raise exception 'Dieses Item gibt es nicht'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if exists (select 1 from inventory where user_id = u and item_id = p_id) then raise exception 'Schon gekauft'; end if;
  if pr.coins < it.price then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - it.price + it.bonus where id = u;
  insert into inventory (user_id, item_id) values (u, p_id);
end $$;

create or replace function public.equip_item(p_type text, p_val text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if p_type not in ('frame', 'avatar', 'skin') then raise exception 'Ungültiger Typ'; end if;
  if not ((p_type, p_val) in (('frame','none'), ('avatar','default'), ('skin','chrome'))
          or exists (select 1 from items i join inventory v on v.item_id = i.id and v.user_id = u
                      where i.type = p_type and i.val = p_val)) then
    raise exception 'Das Item ist nicht in deinem Inventar';
  end if;
  update profiles set eq = jsonb_set(eq, array[p_type], to_jsonb(p_val)) where id = u;
end $$;

-- Umbenennen; der geheime Name gibt einmalig 20.000 NC (nur beim Umbenennen)
create or replace function public.rename_profile(p_name text) returns bigint
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pr profiles; b bigint := 0; k text;
  v text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 16);
begin
  if char_length(v) < 2 then raise exception 'Der Name braucht mindestens 2 Zeichen'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.name = v then return 0; end if;
  k := lower(v);
  if k = 'skippity alpha' and not (k = any(pr.codes)) then b := 20000; end if;
  update profiles set name = v, coins = coins + b,
         codes = case when b > 0 then array_append(codes, k) else codes end
   where id = u;
  return b;
end $$;

-- ---------- Slot Machine (Zufall und Auszahlung auf dem Server) ----------
create or replace function public.play_slots(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid := auth.uid(); pr profiles;
  syms text[] := array['cherry','lemon','bell','bar','seven','diamond'];
  w int[] := array[30,26,18,12,8,5];
  pays jsonb := '{"cherry":[2,4,10],"lemon":[2,5,14],"bell":[3,9,24],"bar":[5,16,46],"seven":[12,38,130],"diamond":[20,64,240]}';
  lns int[] := array[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1]];
  g text[]; r int; acc int; i int; j int; k int; li int; s text; n int;
  pay bigint; total bigint := 0; wins jsonb := '[]'::jsonb;
begin
  if p_bet not in (2,5,10,20,50) then raise exception 'Ungültiger Einsatz'; end if;
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
      wins := wins || jsonb_build_object('line', li - 1, 'symbol', s, 'count', n, 'pay', pay);
    end if;
  end loop;
  update profiles set coins = coins - p_bet + total where id = u;
  perform bump_stat(u, 'slots', p_bet, total);
  return jsonb_build_object('grid', to_jsonb(g), 'wins', wins, 'total', total, 'coins', pr.coins - p_bet + total);
end $$;

-- ---------- Roulette (europäisch, eine Null) ----------
create or replace function public.play_roulette(p_bets jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid := auth.uid(); pr profiles; e record; k text; amt bigint; m int; n int;
  stake bigint := 0; pay bigint := 0;
  red int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if p_bets is null or jsonb_typeof(p_bets) <> 'object' then raise exception 'Ungültige Wetten'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  n := rnd_int(37);
  for e in select key, value from jsonb_each_text(p_bets) loop
    k := e.key; amt := e.value::bigint;
    if amt <= 0 then raise exception 'Ungültiger Einsatz'; end if;
    stake := stake + amt;
    m := case
      when k ~ '^n([0-9]|[12][0-9]|3[0-6])$' then (case when substr(k, 2)::int = n then 36 else 0 end)
      when k = 'red'   then (case when n = any(red) then 2 else 0 end)
      when k = 'black' then (case when n > 0 and not (n = any(red)) then 2 else 0 end)
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
      else null end;
    if m is null then raise exception 'Ungültige Wette: %', k; end if;
    pay := pay + m * amt;
  end loop;
  if stake = 0 then raise exception 'Keine Wetten gesetzt'; end if;
  if stake > pr.coins then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - stake + pay where id = u;
  perform bump_stat(u, 'roulette', stake, pay);
  return jsonb_build_object('n', n, 'pay', pay, 'stake', stake, 'coins', pr.coins - stake + pay);
end $$;

-- ---------- Rechte: nur angemeldete Spieler dürfen die Spiel-Funktionen aufrufen ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text), public.get_state(), public.claim_daily(), public.claim_rescue(),
  public.buy_item(text), public.equip_item(text, text), public.rename_profile(text),
  public.play_slots(int), public.play_roulette(jsonb)
to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
