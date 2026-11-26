-- =====================================================================
-- ROYALE, Schritt 17: Quests (täglich, wöchentlich, monatlich) und neue Spiele
-- (Royal Plinko, Glücksrad, Münzwurf, Würfeltisch). Nach schema16.sql ausführen.
-- Mehrfaches Ausführen ist unschädlich.
-- =====================================================================

-- ---------- Quests ----------
create table if not exists public.quest_defs (
  id text primary key, period text not null, diff text not null, title text not null, metric text not null, target bigint not null, reward bigint not null);
create table if not exists public.quest_progress (
  user_id uuid not null references auth.users(id) on delete cascade, quest_id text not null, period_key text not null,
  value bigint not null default 0, claimed boolean not null default false, primary key (user_id, quest_id, period_key));
alter table public.quest_defs enable row level security;
alter table public.quest_progress enable row level security;
drop policy if exists "Quests lesbar" on public.quest_defs;
drop policy if exists "eigener Fortschritt" on public.quest_progress;
create policy "Quests lesbar" on public.quest_defs for select to authenticated using (true);
create policy "eigener Fortschritt" on public.quest_progress for select to authenticated using (user_id = auth.uid());
insert into public.quest_defs (id, period, diff, title, metric, target, reward) values
('d_e1', 'daily', 'easy', 'Spiele 5 Runden', 'rounds', 5, 2000),
('d_e2', 'daily', 'easy', 'Dreh 5-mal an der Slot Machine', 'game:slots', 5, 2000),
('d_e3', 'daily', 'easy', 'Rubble 3 Lose frei', 'game:scratch', 3, 2000),
('d_e4', 'daily', 'easy', 'Hol dir den Tagesbonus', 'daily_claim', 1, 2000),
('d_m1', 'daily', 'medium', 'Gewinne 3 Runden', 'wins', 3, 6000),
('d_m2', 'daily', 'medium', 'Spiele 3 Runden Blackjack', 'game:blackjack', 3, 6000),
('d_m3', 'daily', 'medium', 'Wirf 5 Kugeln bei Royal Plinko', 'game:plinko', 5, 6000),
('d_m4', 'daily', 'medium', 'Öffne eine Mystery Box', 'box', 1, 6000),
('d_h1', 'daily', 'hard', 'Gewinne 6 Runden', 'wins', 6, 15000),
('d_h2', 'daily', 'hard', 'Gewinne insgesamt 10.000 RC', 'won', 10000, 15000),
('d_h3', 'daily', 'hard', 'Ein einzelner Gewinn von mindestens 5.000 RC', 'maxwin', 5000, 15000),
('d_h4', 'daily', 'hard', 'Gewinne 2 Runden am Würfeltisch', 'win:dice', 2, 15000),
('w_e1', 'weekly', 'easy', 'Spiele 40 Runden', 'rounds', 40, 15000),
('w_e2', 'weekly', 'easy', 'Dreh 25-mal an der Slot Machine', 'game:slots', 25, 15000),
('w_e3', 'weekly', 'easy', 'Drehe das Glücksrad 10-mal', 'game:wheel', 10, 15000),
('w_e4', 'weekly', 'easy', 'Öffne 2 Mystery Boxen', 'box', 2, 15000),
('w_m1', 'weekly', 'medium', 'Gewinne 25 Runden', 'wins', 25, 40000),
('w_m2', 'weekly', 'medium', 'Gewinne 5 Runden Roulette', 'win:roulette', 5, 40000),
('w_m3', 'weekly', 'medium', 'Spiele 6 Hold''em-Hände', 'game:holdem', 6, 40000),
('w_m4', 'weekly', 'medium', 'Wirf 15-mal die Münze', 'game:coinflip', 15, 40000),
('w_h1', 'weekly', 'hard', 'Gewinne insgesamt 100.000 RC', 'won', 100000, 100000),
('w_h2', 'weekly', 'hard', 'Ein einzelner Gewinn von mindestens 50.000 RC', 'maxwin', 50000, 100000),
('w_h3', 'weekly', 'hard', 'Gewinne 60 Runden', 'wins', 60, 100000),
('w_h4', 'weekly', 'hard', 'Gewinne 10 Runden Blackjack', 'win:blackjack', 10, 100000),
('m_e1', 'monthly', 'easy', 'Spiele 250 Runden', 'rounds', 250, 50000),
('m_e2', 'monthly', 'easy', 'Gewinne 100 Runden', 'wins', 100, 50000),
('m_e3', 'monthly', 'easy', 'Öffne 6 Mystery Boxen', 'box', 6, 50000),
('m_e4', 'monthly', 'easy', 'Hol dir 20-mal den Tagesbonus', 'daily_claim', 20, 50000),
('m_m1', 'monthly', 'medium', 'Gewinne 200 Runden', 'wins', 200, 150000),
('m_m2', 'monthly', 'medium', 'Gewinne insgesamt 300.000 RC', 'won', 300000, 150000),
('m_m3', 'monthly', 'medium', 'Rubble 60 Lose frei', 'game:scratch', 60, 150000),
('m_m4', 'monthly', 'medium', 'Gewinne 15 Runden Poker', 'win:poker', 15, 150000),
('m_h1', 'monthly', 'hard', 'Gewinne insgesamt 1.000.000 RC', 'won', 1000000, 500000),
('m_h2', 'monthly', 'hard', 'Ein einzelner Gewinn von mindestens 250.000 RC', 'maxwin', 250000, 500000),
('m_h3', 'monthly', 'hard', 'Gewinne 500 Runden', 'wins', 500, 500000),
('m_h4', 'monthly', 'hard', 'Gewinne 30 Hold''em-Hände', 'win:holdem', 30, 500000)
on conflict (id) do update set period = excluded.period, diff = excluded.diff, title = excluded.title, metric = excluded.metric, target = excluded.target, reward = excluded.reward;

-- Pro Zeitraum und Schwierigkeit ist immer genau eine Quest aktiv, die Auswahl wechselt mit dem Zeitraum
create or replace function public.quest_active() returns table (id text, period text, pkey text, diff text, title text, metric text, target bigint, reward bigint)
language sql stable security definer set search_path = public as $$
  select d.id, d.period, k.pkey, d.diff, d.title, d.metric, d.target, d.reward
  from (select 'daily'::text as period, current_date::text as pkey
        union all select 'weekly', date_trunc('week', current_date)::date::text
        union all select 'monthly', date_trunc('month', current_date)::date::text) k
  join (select *, row_number() over (partition by period, diff order by id) as rn, count(*) over (partition by period, diff) as cnt from quest_defs) d on d.period = k.period
  where d.rn = 1 + ((hashtext(k.pkey || d.diff)::bigint & 2147483647) % d.cnt)
$$;

create or replace function public.quest_track(u uuid, m text, amt bigint, as_max boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q record;
begin
  for q in select id, pkey from quest_active() where metric = m loop
    insert into quest_progress (user_id, quest_id, period_key, value) values (u, q.id, q.pkey, amt)
    on conflict (user_id, quest_id, period_key) do update
      set value = case when as_max then greatest(quest_progress.value, amt) else quest_progress.value + amt end
      where not quest_progress.claimed;
  end loop;
end $$;

-- Jede gespielte Runde zählt automatisch für die Quests
create or replace function public.bump_stat(u uuid, g text, stake bigint, pay bigint) returns void language plpgsql set search_path = public as $$
begin
  insert into stats (user_id, game, rounds, wins, best, won)
  values (u, g, 1, (pay > stake)::int, greatest(pay - stake, 0), greatest(pay - stake, 0))
  on conflict (user_id, game) do update set
    rounds = stats.rounds + 1, wins = stats.wins + (pay > stake)::int,
    best = greatest(stats.best, pay - stake), won = stats.won + greatest(pay - stake, 0);
  perform quest_track(u, 'rounds', 1);
  perform quest_track(u, 'game:' || g, 1);
  if pay > stake then
    perform quest_track(u, 'wins', 1);
    perform quest_track(u, 'win:' || g, 1);
    perform quest_track(u, 'won', pay - stake);
    perform quest_track(u, 'maxwin', pay - stake, true);
  end if;
end $$;

create or replace function public.quest_list() returns jsonb language plpgsql security definer stable set search_path = public as $$
declare u uuid := auth.uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'period', a.period, 'pkey', a.pkey, 'diff', a.diff, 'title', a.title,
      'target', a.target, 'reward', a.reward, 'value', coalesce(qp.value, 0), 'claimed', coalesce(qp.claimed, false))
      order by (case a.period when 'daily' then 1 when 'weekly' then 2 else 3 end), (case a.diff when 'easy' then 1 when 'medium' then 2 else 3 end))
    from quest_active() a left join quest_progress qp on qp.user_id = u and qp.quest_id = a.id and qp.period_key = a.pkey), '[]'::jsonb);
end $$;

create or replace function public.quest_claim(p_id text) returns bigint language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); a record; qp quest_progress;
begin
  select * into a from quest_active() where id = p_id;
  if not found then raise exception 'Diese Quest ist gerade nicht aktiv'; end if;
  select * into qp from quest_progress where user_id = u and quest_id = a.id and period_key = a.pkey for update;
  if not found or qp.value < a.target then raise exception 'Die Quest ist noch nicht geschafft'; end if;
  if qp.claimed then raise exception 'Die Belohnung ist schon abgeholt'; end if;
  update quest_progress set claimed = true where user_id = u and quest_id = a.id and period_key = a.pkey;
  update profiles set coins = coins + a.reward where id = u;
  return a.reward;
end $$;

-- Mystery Box und Tagesbonus zählen für Quests
create or replace function public.box_roll(u uuid, tox boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r int; rar text; it items; dup boolean := false; refund bigint := 0;
begin
  r := rnd_int(100);
  if tox then
    rar := case when r < 60 then 'epic' when r < 88 then 'legendary' else 'mythic' end;
  else
    rar := case when r < 55 then 'common' when r < 83 then 'rare' when r < 94 then 'epic' when r < 99 then 'legendary' else 'mythic' end;
  end if;
  select * into it from items i
   where i.rarity = rar and not i.is_default and i.type <> 'bonus'
     and (case when tox then i.collection = 'toxic' else i.collection is null end)
     and not exists (select 1 from inventory v where v.user_id = u and v.item_id = i.id)
   order by ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint limit 1;
  if it.id is null then
    select * into it from items i
     where i.rarity = rar and not i.is_default and i.type <> 'bonus'
       and (case when tox then i.collection = 'toxic' else i.collection is null end)
     order by ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint limit 1;
    dup := true; refund := it.price * 3 / 10;
  else
    insert into inventory (user_id, item_id) values (u, it.id);
  end if;
  if refund > 0 then update profiles set coins = coins + refund where id = u; end if;
  perform quest_track(u, 'box', 1);
  return jsonb_build_object('item', it.id, 'rarity', rar, 'duplicate', dup, 'refund', refund);
end $$;

create or replace function public.claim_daily() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set coins = coins + 1000, last_daily = current_date
   where id = auth.uid() and (last_daily is null or last_daily < current_date);
  if not found then raise exception 'Tagesbonus heute schon abgeholt'; end if;
  perform quest_track(auth.uid(), 'daily_claim', 1);
end $$;

-- ---------- Royal Plinko: 10 Reihen, Kugel fällt zufällig links oder rechts ----------
create or replace function public.play_plinko(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; path int[] := array[]::int[]; i int; b int; slot int := 0;
  mults int[] := array[2400,600,220,130,55,30,55,130,220,600,2400]; pay bigint;
begin
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  for i in 1..10 loop b := rnd_int(2); path := path || b; slot := slot + b; end loop;
  pay := (p_bet::bigint * mults[slot + 1]) / 100;
  update profiles set coins = coins - p_bet + pay where id = u;
  perform bump_stat(u, 'plinko', p_bet, pay);
  return jsonb_build_object('path', to_jsonb(path), 'slot', slot, 'mult', mults[slot + 1], 'pay', pay, 'coins', pr.coins - p_bet + pay);
end $$;

-- ---------- Glücksrad: 12 gleich große Felder ----------
create or replace function public.play_wheel(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; seg int; mults int[] := array[0,50,0,100,50,0,150,100,0,250,50,400]; pay bigint;
begin
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  seg := rnd_int(12);
  pay := (p_bet::bigint * mults[seg + 1]) / 100;
  update profiles set coins = coins - p_bet + pay where id = u;
  perform bump_stat(u, 'wheel', p_bet, pay);
  return jsonb_build_object('seg', seg, 'mult', mults[seg + 1], 'pay', pay, 'coins', pr.coins - p_bet + pay);
end $$;

-- ---------- Münzwurf: Kopf oder Zahl, Gewinn 1,94-fach ----------
create or replace function public.play_coin(p_bet int, p_side text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; res text; pay bigint := 0;
begin
  if p_side not in ('heads', 'tails') then raise exception 'Wähle Kopf oder Zahl'; end if;
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  res := case when rnd_int(2) = 0 then 'heads' else 'tails' end;
  if res = p_side then pay := (p_bet::bigint * 194) / 100; end if;
  update profiles set coins = coins - p_bet + pay where id = u;
  perform bump_stat(u, 'coinflip', p_bet, pay);
  return jsonb_build_object('result', res, 'pay', pay, 'coins', pr.coins - p_bet + pay);
end $$;

-- ---------- Würfeltisch: zwei Würfel, Wetten wie beim Roulette ----------
create or replace function public.play_dice(p_bets jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; e record; amt bigint; stake bigint := 0; pay bigint := 0; d1 int; d2 int; t int; m int;
begin
  if p_bets is null or jsonb_typeof(p_bets) <> 'object' then raise exception 'Ungültige Wetten'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  d1 := rnd_int(6) + 1; d2 := rnd_int(6) + 1; t := d1 + d2;
  for e in select key, value from jsonb_each_text(p_bets) loop
    amt := e.value::bigint;
    if amt <= 0 then raise exception 'Ungültiger Einsatz'; end if;
    m := case e.key
      when 'low' then (case when t <= 6 then 230 else 0 end)
      when 'high' then (case when t >= 8 then 230 else 0 end)
      when 'seven' then (case when t = 7 then 580 else 0 end)
      when 'double' then (case when d1 = d2 then 580 else 0 end)
      when 'even' then (case when t % 2 = 0 then 192 else 0 end)
      when 'odd' then (case when t % 2 = 1 then 192 else 0 end)
      else null end;
    if m is null then raise exception 'Ungültige Wette: %', e.key; end if;
    stake := stake + amt; pay := pay + (amt * m) / 100;
  end loop;
  if stake < 2 then raise exception 'Setze mindestens 2 RC'; end if;
  if stake > pr.coins then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - stake + pay where id = u;
  perform bump_stat(u, 'dice', stake, pay);
  return jsonb_build_object('d1', d1, 'd2', d2, 'pay', pay, 'stake', stake, 'coins', pr.coins - stake + pay);
end $$;

-- ---------- Rechte ----------
revoke all on function public.quest_active(), public.quest_track(uuid, text, bigint, boolean), public.bump_stat(uuid, text, bigint, bigint), public.box_roll(uuid, boolean) from public, anon, authenticated;
revoke all on function public.quest_list(), public.quest_claim(text), public.play_plinko(int), public.play_wheel(int), public.play_coin(int, text), public.play_dice(jsonb) from public, anon;
grant execute on function public.quest_list(), public.quest_claim(text), public.play_plinko(int), public.play_wheel(int), public.play_coin(int, text), public.play_dice(jsonb) to authenticated;
