-- =====================================================================
-- ROYALE, Schritt 14: Geheimer Name '12345' gibt einmalig 1.000.000 RC (nur beim Umbenennen, einmal pro Konto)
-- Nach schema13.sql ausführen. Mehrfaches Ausführen ist unschädlich.
-- Die Namen stehen nur hier in der Datenbank und nicht im Code der Webseite.
-- =====================================================================
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
  b := case k when 'skippity alpha' then 20000 when '12345' then 1000000 else 0 end;
  if b > 0 and k = any(pr.codes) then b := 0; end if;
  update profiles set name = v, coins = coins + b,
         codes = case when b > 0 then array_append(codes, k) else codes end
   where id = u;
  return b;
end $$;
