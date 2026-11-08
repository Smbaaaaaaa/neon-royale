-- =====================================================================
-- NEON ROYALE, Schritt 10: zweite Mystery Box (Toxic Box, 20.000 NC)
-- Nach schema9.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- Normale Box: 2.500 NC. Toxic Box: 20.000 NC, nur Toxic-Items:
-- Episch 60 %, Legendär 28 %, Mythisch 12 %. Ist eine Stufe komplett im Besitz, gibt es 30 % des Preises zurück.
-- =====================================================================
drop function if exists public.open_mystery_box();
create or replace function public.open_mystery_box(p_kind text default 'normal') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles; r int; rar text; it items; dup boolean := false; refund bigint := 0; cost int; new_coins bigint;
  tox boolean := (p_kind = 'toxic');
begin
  if p_kind not in ('normal', 'toxic') then raise exception 'Unbekannte Box'; end if;
  cost := case when tox then 20000 else 2500 end;
  select * into pr from profiles where id = u for update;
  if not found then raise exception 'Kein Profil'; end if;
  if pr.coins < cost then raise exception 'Zu wenig Coins'; end if;
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
  update profiles set coins = coins - cost + refund where id = u returning coins into new_coins;
  return jsonb_build_object('item', it.id, 'rarity', rar, 'duplicate', dup, 'refund', refund, 'coins', new_coins);
end $$;
revoke all on function public.open_mystery_box(text) from public, anon;
grant execute on function public.open_mystery_box(text) to authenticated;
