-- =====================================================================
-- NEON ROYALE, Schritt 9: Mystery Box (2.500 NC) und zweiter einmaliger Bonus (15.000 NC)
-- Nach schema8.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- Wahrscheinlichkeiten: Häufig 55 %, Selten 28 %, Episch 11 %, Legendär 5 %, Mythisch 1 %.
-- Toxic-Items sind nicht in der Box. Ist eine Stufe komplett im Besitz, gibt es 30 % des Preises zurück.
-- =====================================================================
insert into public.items (id, type, val, name, rarity, price, bonus, is_default, collection)
values ('bonus-15k', 'bonus', 'bonus', 'Bonus', null, 0, 15000, false, null)
on conflict (id) do update set price = excluded.price, bonus = excluded.bonus;

create or replace function public.open_mystery_box() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; r int; rar text; it items; dup boolean := false; refund bigint := 0; cost constant int := 2500; new_coins bigint;
begin
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < cost then raise exception 'Zu wenig Coins'; end if;
  r := rnd_int(100);
  rar := case when r < 55 then 'common' when r < 83 then 'rare' when r < 94 then 'epic' when r < 99 then 'legendary' else 'mythic' end;
  select * into it from items i
   where i.rarity = rar and not i.is_default and i.collection is null and i.type <> 'bonus'
     and not exists (select 1 from inventory v where v.user_id = u and v.item_id = i.id)
   order by ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint limit 1;
  if it.id is null then
    select * into it from items i
     where i.rarity = rar and not i.is_default and i.collection is null and i.type <> 'bonus'
     order by ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint limit 1;
    dup := true; refund := it.price * 3 / 10;
  else
    insert into inventory (user_id, item_id) values (u, it.id);
  end if;
  update profiles set coins = coins - cost + refund where id = u returning coins into new_coins;
  return jsonb_build_object('item', it.id, 'rarity', rar, 'duplicate', dup, 'refund', refund, 'coins', new_coins);
end $$;
revoke all on function public.open_mystery_box() from public, anon;
grant execute on function public.open_mystery_box() to authenticated;
