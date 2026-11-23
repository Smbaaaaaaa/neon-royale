-- =====================================================================
-- ROYALE, Schritt 16: beliebige Einsätze (All-in, 10.000), großzügigere Slot Machine
-- Nach schema15.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- Slots: Trefferquote ca. 63 %, Auszahlungen höher, Rückzahlung im Schnitt ca. 104 %.
-- Einsatz: jeder Betrag ab 2 RC bis zu deinem Guthaben (All-in).
-- =====================================================================
create or replace function public.play_slots(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid := auth.uid(); pr profiles;
  syms text[] := array['cherry','lemon','bell','bar','seven','diamond'];
  w int[] := array[33,28,17,11,7,4];
  pays jsonb := '{"cherry":[1,2,7],"lemon":[1,3,10],"bell":[2,6,17],"bar":[4,11,34],"seven":[9,27,95],"diamond":[15,45,170]}';
  lns int[] := array[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1]];
  g text[]; r int; acc int; i int; j int; k int; li int; s text; n int; m int;
  pay bigint; total bigint := 0; wins jsonb := '[]'::jsonb;
begin
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < p_bet then raise exception 'Zu wenig Coins'; end if;
  g := array_fill(''::text, array[5,3]);
  for i in 1..5 loop
    for j in 1..3 loop
      r := rnd_int(100); acc := 0;
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

create or replace function public.poker_deal(p_bet int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; deck jsonb; hand jsonb; rest jsonb;
begin
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
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
  if p_bet < 2 or p_bet > 1000000000000 then raise exception 'Ungültiger Einsatz'; end if;
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
  if p_ante not in (2,5,10,20,50,100,500,1000,10000) then raise exception 'Ungültiger Einsatz'; end if;
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

create or replace function public.scratch_buy(p_price int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; r int; acc int := 0; win_k int := 0; k int; i int; n_open int; tid uuid;
  syms text[] := array['spade','chip','dice','heart','diamond','crown'];
  mults int[] := array[2,3,5,10,25,100]; ws int[] := array[1500,600,300,120,30,6];
  g text[] := array_fill(''::text, array[9]); cnt int[] := array[0,0,0,0,0,0]; perm int[]; pay bigint := 0; mult int := 0;
begin
  if p_price < 2 or p_price > 1000000000000 then raise exception 'Ungültiger Preis'; end if;
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
