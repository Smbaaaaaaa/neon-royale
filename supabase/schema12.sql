-- =====================================================================
-- ROYALE, Schritt 12: Bonusse gibt es jeden Tag neu, dazu der Willkommensbonus (25.000 RC)
-- Reihenfolge: nach schema11.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- Der Tag wechselt nach UTC (nachts um 1 oder 2 Uhr deutscher Zeit).
-- =====================================================================
create table if not exists public.bonus_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null, last_date date not null, primary key (user_id, item_id));
alter table public.bonus_claims enable row level security;
drop policy if exists "eigene Boni" on public.bonus_claims;
create policy "eigene Boni" on public.bonus_claims for select to authenticated using (user_id = auth.uid());

insert into public.items (id, type, val, name, rarity, price, bonus, is_default, collection)
values ('bonus-25k', 'bonus', 'bonus', 'Willkommensbonus', null, 0, 25000, false, null)
on conflict (id) do update set name = excluded.name, bonus = excluded.bonus;

create or replace function public.claim_bonus(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); it items;
begin
  select * into it from items where id = p_id and type = 'bonus';
  if not found then raise exception 'Diesen Bonus gibt es nicht'; end if;
  insert into bonus_claims (user_id, item_id, last_date) values (u, p_id, current_date)
    on conflict (user_id, item_id) do update set last_date = current_date where bonus_claims.last_date < current_date;
  if not found then raise exception 'Heute schon abgeholt'; end if;
  update profiles set coins = coins + it.bonus where id = u;
  if not found then raise exception 'Kein Profil'; end if;
end $$;
revoke all on function public.claim_bonus(text) from public, anon;
grant execute on function public.claim_bonus(text) to authenticated;

-- Zustand mit den Abhol-Tagen der Bonusse
create or replace function public.get_state() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid := auth.uid(); pr profiles;
begin
  select * into pr from profiles where id = u;
  if not found then return jsonb_build_object('profile', null); end if;
  return jsonb_build_object(
    'profile', to_jsonb(pr),
    'inventory', coalesce((select jsonb_agg(item_id) from inventory where user_id = u), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s where user_id = u), '[]'::jsonb),
    'claims', coalesce((select jsonb_object_agg(item_id, to_jsonb(last_date)) from bonus_claims where user_id = u), '{}'::jsonb));
end $$;
