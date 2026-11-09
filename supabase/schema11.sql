-- =====================================================================
-- ROYALE, Schritt 11: Royal Coins (RC), höhere Einsätze, tägliche Gratis-Box, Rubbellose
-- Reihenfolge: nach schema10.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- =====================================================================

-- ---------- Einsätze bis 1.000 RC (Slots, Video Poker, Blackjack, Poker-Raum) ----------
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
      wins := wins || jsonb_build_object('line', li - 1, 'symbol', s, 'count', n, 'pay', pay);
    end if;
  end loop;
  update profiles set coins = coins - p_bet + total where id = u;
  perform bump_stat(u, 'slots', p_bet, total);
  return jsonb_build_object('grid', to_jsonb(g), 'wins', wins, 'total', total, 'coins', pr.coins - p_bet + total);
end $$;

create or replace function public.poker_deal(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; deck jsonb; hand jsonb; rest jsonb;
begin
  if p_bet not in (2,5,10,20,50,100,500,1000) then raise exception 'Ungültiger Einsatz'; end if;
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

create or replace function public.bj_deal(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; shoe jsonb; pl jsonb; de jsonb; st jsonb;
begin
  if p_bet not in (2,5,10,20,50,100,500,1000) then raise exception 'Ungültiger Einsatz'; end if;
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

create or replace function public.poker_start(p_code text, p_ante int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); rm rooms; m record; pr profiles; deck jsonb; hand jsonb; idx int := 0;
  v_pot bigint := 0; v_seats jsonb := '[]'::jsonb;
begin
  if p_ante not in (2,5,10,20,50,100,500,1000) then raise exception 'Ungültiger Einsatz'; end if;
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

-- ---------- Meldungen mit Royal Coins ----------
create or replace function public.holdem_sit(p_code text, p_buyin bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); rm rooms; pr profiles; s holdem_seats; sn int;
begin
  select * into rm from rooms where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or rm.game <> 'holdem' then raise exception 'Das ist kein Hold''em-Raum'; end if;
  if not is_member(rm.code) then raise exception 'Du bist nicht in diesem Raum'; end if;
  if rm.phase not in ('lobby', 'showdown') then raise exception 'Setz dich zwischen zwei Händen hin'; end if;
  if p_buyin < rm.bb * 20 or p_buyin > rm.bb * 200 then raise exception 'Buy-in muss zwischen % und % RC liegen', rm.bb * 20, rm.bb * 200; end if;
  select * into pr from profiles where id = u for update;
  if pr.coins < p_buyin then raise exception 'Zu wenig Coins'; end if;
  select * into s from holdem_seats where code = rm.code and user_id = u for update;
  if s.user_id is not null then
    if s.stack + p_buyin > rm.bb * 200 then raise exception 'Dein Stack darf höchstens % RC groß sein', rm.bb * 200; end if;
    update holdem_seats set stack = stack + p_buyin where code = rm.code and user_id = u;
  else
    select min(g) into sn from generate_series(1, 9) g where not exists (select 1 from holdem_seats where code = rm.code and seat = g);
    if sn is null then raise exception 'Der Tisch ist voll'; end if;
    insert into holdem_seats (code, user_id, name, seat, stack) values (rm.code, u, pr.name, sn, p_buyin);
  end if;
  update profiles set coins = coins - p_buyin where id = u;
end $$;

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
    if wamt > s.total then perform h_log(c, s.name || ' gewinnt ' || (wamt - s.total) || ' RC'); end if;
  end loop;
  for s in select * from holdem_seats where code = c and leaving loop
    update profiles set coins = coins + s.stack where id = s.user_id;
    delete from holdem_seats where code = c and user_id = s.user_id;
  end loop;
  update rooms set phase = 'showdown', cur = null, payouts = outp where code = c;
  delete from poker_decks where code = c;
end $$;

-- ---------- Mystery Boxen: gemeinsame Ziehung, bezahlt oder täglich gratis ----------
alter table public.profiles add column if not exists last_box date;

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
  return jsonb_build_object('item', it.id, 'rarity', rar, 'duplicate', dup, 'refund', refund);
end $$;

create or replace function public.open_mystery_box(p_kind text default 'normal') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; cost int; res jsonb; new_coins bigint; tox boolean := (p_kind = 'toxic');
begin
  if p_kind not in ('normal', 'toxic') then raise exception 'Unbekannte Box'; end if;
  cost := case when tox then 20000 else 2500 end;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < cost then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - cost where id = u;
  res := box_roll(u, tox);
  select coins into new_coins from profiles where id = u;
  return res || jsonb_build_object('coins', new_coins);
end $$;

create or replace function public.open_daily_box() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); res jsonb; new_coins bigint;
begin
  update profiles set last_box = current_date where id = u and (last_box is null or last_box < current_date);
  if not found then raise exception 'Die Gratis-Box ist heute schon abgeholt'; end if;
  res := box_roll(u, false);
  select coins into new_coins from profiles where id = u;
  return res || jsonb_build_object('coins', new_coins, 'free', true);
end $$;
revoke all on function public.open_daily_box() from public, anon;
grant execute on function public.open_daily_box() to authenticated;

-- ---------- Rubbellose ----------
create table if not exists public.scratch_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  price bigint not null, grid jsonb not null, symbol text, mult int not null default 0, payout bigint not null default 0,
  revealed boolean not null default false, created_at timestamptz not null default now());
alter table public.scratch_tickets enable row level security;
drop policy if exists "eigene Lose" on public.scratch_tickets;
create policy "eigene Lose" on public.scratch_tickets for select to authenticated using (user_id = auth.uid());

-- Los kaufen: Das Ergebnis steht sofort auf dem Server fest. 3 gleiche Symbole gewinnen, Quote etwa 88 %.
create or replace function public.scratch_buy(p_price int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; r int; acc int := 0; win_k int := 0; k int; i int; n_open int; tid uuid;
  syms text[] := array['spade','chip','dice','heart','diamond','crown'];
  mults int[] := array[2,3,5,10,25,100]; ws int[] := array[1500,600,300,120,30,6];
  g text[] := array_fill(''::text, array[9]); cnt int[] := array[0,0,0,0,0,0]; perm int[]; pay bigint := 0; mult int := 0;
begin
  if p_price not in (2,5,10,20,50,100,500,1000) then raise exception 'Ungültiger Preis'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_price then raise exception 'Zu wenig Coins'; end if;
  select count(*) into n_open from scratch_tickets where user_id = u and not revealed;
  if n_open >= 12 then raise exception 'Rubbel erst ein paar Lose frei'; end if;
  r := rnd_int(10000);
  for k in 1..6 loop acc := acc + ws[k]; if r < acc then win_k := k; exit; end if; end loop;
  perm := (select array_agg(x order by ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) from generate_series(1, 9) x);
  if win_k > 0 then
    for i in 1..3 loop g[perm[i]] := syms[win_k]; end loop;
    cnt[win_k] := 3; mult := mults[win_k]; pay := p_price::bigint * mult;
    for i in 4..9 loop
      loop k := rnd_int(6) + 1; exit when k <> win_k and cnt[k] < 2; end loop;
      g[perm[i]] := syms[k]; cnt[k] := cnt[k] + 1;
    end loop;
  else
    for i in 1..9 loop
      loop k := rnd_int(6) + 1; exit when cnt[k] < 2; end loop;
      g[perm[i]] := syms[k]; cnt[k] := cnt[k] + 1;
    end loop;
  end if;
  update profiles set coins = coins - p_price where id = u;
  insert into scratch_tickets (user_id, price, grid, symbol, mult, payout)
    values (u, p_price, to_jsonb(g), case when win_k > 0 then syms[win_k] end, mult, pay) returning id into tid;
  return jsonb_build_object('id', tid, 'price', p_price, 'grid', to_jsonb(g), 'symbol', case when win_k > 0 then syms[win_k] end,
                            'mult', mult, 'payout', pay, 'coins', pr.coins - p_price);
end $$;

-- Los aufdecken: erst jetzt wird ein Gewinn gutgeschrieben
create or replace function public.scratch_reveal(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); t scratch_tickets; new_coins bigint;
begin
  select * into t from scratch_tickets where id = p_id and user_id = u for update;
  if not found then raise exception 'Los nicht gefunden'; end if;
  if t.revealed then
    select coins into new_coins from profiles where id = u;
    return jsonb_build_object('payout', t.payout, 'coins', new_coins, 'already', true);
  end if;
  update scratch_tickets set revealed = true where id = p_id;
  update profiles set coins = coins + t.payout where id = u returning coins into new_coins;
  perform bump_stat(u, 'scratch', t.price, t.payout);
  return jsonb_build_object('payout', t.payout, 'coins', new_coins);
end $$;

create or replace function public.scratch_list() returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'price', price, 'grid', grid, 'symbol', symbol, 'mult', mult, 'payout', payout) order by created_at), '[]'::jsonb)
  from scratch_tickets where user_id = auth.uid() and not revealed
$$;
revoke all on function public.scratch_buy(int), public.scratch_reveal(uuid), public.scratch_list() from public, anon;
grant execute on function public.scratch_buy(int), public.scratch_reveal(uuid), public.scratch_list() to authenticated;
