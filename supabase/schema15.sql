-- =====================================================================
-- ROYALE, Schritt 15: Freundesliste (eigene Freundes-ID), Geld senden, Einladungen in Multiplayer-Räume
-- Nach schema14.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- =====================================================================
alter table public.profiles add column if not exists friend_code text;
create unique index if not exists profiles_friend_code_idx on public.profiles (friend_code);

create or replace function public.gen_friend_code() returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd_int(32) + 1, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from profiles where friend_code = c);
  end loop;
  return c;
end $$;
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;

create or replace function public.set_friend_code() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.friend_code is null then new.friend_code := gen_friend_code(); end if;
  return new;
end $$;
drop trigger if exists trg_friend_code on public.profiles;
create trigger trg_friend_code before insert on public.profiles for each row execute function public.set_friend_code();

create table if not exists public.friendships (
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', created_at timestamptz not null default now(),
  primary key (requester, addressee), check (requester <> addressee));
create table if not exists public.transfers (
  id bigserial primary key, from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade, amount bigint not null check (amount > 0), created_at timestamptz not null default now());
create table if not exists public.room_invites (
  code text not null references public.rooms(code) on delete cascade, to_id uuid not null references auth.users(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (code, to_id));
alter table public.friendships enable row level security;
alter table public.transfers enable row level security;
alter table public.room_invites enable row level security;
drop policy if exists "eigene Freundschaften" on public.friendships;
drop policy if exists "eigene Überweisungen" on public.transfers;
drop policy if exists "eigene Einladungen" on public.room_invites;
create policy "eigene Freundschaften" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "eigene Überweisungen" on public.transfers for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "eigene Einladungen" on public.room_invites for select to authenticated using (to_id = auth.uid());

create or replace function public.friend_link(u uuid, t uuid) returns void language plpgsql security definer set search_path = public as $$
declare ex friendships;
begin
  if t is null then raise exception 'Spieler nicht gefunden'; end if;
  if t = u then raise exception 'Das bist du selbst'; end if;
  select * into ex from friendships where (requester = u and addressee = t) or (requester = t and addressee = u);
  if found then
    if ex.status = 'accepted' then raise exception 'Ihr seid schon befreundet'; end if;
    if ex.requester = u then raise exception 'Deine Anfrage wartet noch auf eine Antwort'; end if;
    update friendships set status = 'accepted' where requester = t and addressee = u;
    return;
  end if;
  insert into friendships (requester, addressee) values (u, t);
end $$;

create or replace function public.friend_add(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select id into t from profiles where friend_code = upper(trim(coalesce(p_code, '')));
  if t is null then raise exception 'Diese Freundes-ID gibt es nicht'; end if;
  perform friend_link(auth.uid(), t);
end $$;

create or replace function public.friend_add_by_id(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform friend_link(auth.uid(), p_id); end $$;

create or replace function public.friend_respond(p_id uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if p_accept then
    update friendships set status = 'accepted' where requester = p_id and addressee = u and status = 'pending';
  else
    delete from friendships where requester = p_id and addressee = u and status = 'pending';
  end if;
  if not found then raise exception 'Keine offene Anfrage'; end if;
end $$;

create or replace function public.friend_remove(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  delete from friendships where (requester = u and addressee = p_id) or (requester = p_id and addressee = u);
end $$;

create or replace function public.send_money(p_id uuid, p_amount bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pr profiles; new_coins bigint;
begin
  if p_amount is null or p_amount < 1 then raise exception 'Ungültiger Betrag'; end if;
  if not exists (select 1 from friendships where status = 'accepted' and ((requester = u and addressee = p_id) or (requester = p_id and addressee = u))) then
    raise exception 'Ihr seid nicht befreundet';
  end if;
  select * into pr from profiles where id = u for update;
  if pr.coins < p_amount then raise exception 'Zu wenig Coins'; end if;
  update profiles set coins = coins - p_amount where id = u returning coins into new_coins;
  update profiles set coins = coins + p_amount where id = p_id;
  insert into transfers (from_id, to_id, amount) values (u, p_id, p_amount);
  return jsonb_build_object('coins', new_coins);
end $$;

create or replace function public.invite_friend(p_code text, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); c text := upper(trim(coalesce(p_code, '')));
begin
  if not is_member(c) then raise exception 'Du bist nicht in diesem Raum'; end if;
  if not exists (select 1 from friendships where status = 'accepted' and ((requester = u and addressee = p_id) or (requester = p_id and addressee = u))) then
    raise exception 'Ihr seid nicht befreundet';
  end if;
  insert into room_invites (code, to_id, from_id) values (c, p_id, u)
    on conflict (code, to_id) do update set from_id = u, created_at = now();
end $$;

create or replace function public.invite_dismiss(p_code text) returns void language plpgsql security definer set search_path = public as $$
begin delete from room_invites where code = upper(trim(coalesce(p_code, ''))) and to_id = auth.uid(); end $$;

create or replace function public.social_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'eq', p.eq) order by p.name)
        from friendships f join profiles p on p.id = case when f.requester = u then f.addressee else f.requester end
       where f.status = 'accepted' and u in (f.requester, f.addressee)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'eq', p.eq))
        from friendships f join profiles p on p.id = f.requester where f.status = 'pending' and f.addressee = u), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'eq', p.eq))
        from friendships f join profiles p on p.id = f.addressee where f.status = 'pending' and f.requester = u), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('code', i.code, 'game', r.game, 'mode', r.mode, 'from', (select name from profiles where id = i.from_id)) order by i.created_at desc)
        from room_invites i join rooms r on r.code = i.code
       where i.to_id = u and not exists (select 1 from room_members m where m.code = i.code and m.user_id = u)), '[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(to_jsonb(t)) from (
        select tr.amount, tr.created_at, (tr.from_id = u) as sent, p2.name as other
          from transfers tr join profiles p2 on p2.id = case when tr.from_id = u then tr.to_id else tr.from_id end
         where u in (tr.from_id, tr.to_id) order by tr.created_at desc limit 10) t), '[]'::jsonb));
end $$;

-- ---------- Rechte ----------
revoke all on function public.gen_friend_code(), public.set_friend_code(), public.friend_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_add(text), public.friend_add_by_id(uuid), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.send_money(uuid, bigint), public.invite_friend(text, uuid), public.invite_dismiss(text), public.social_state() from public, anon;
grant execute on function public.friend_add(text), public.friend_add_by_id(uuid), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.send_money(uuid, bigint), public.invite_friend(text, uuid), public.invite_dismiss(text), public.social_state() to authenticated;
