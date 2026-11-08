-- =====================================================================
-- NEON ROYALE, Schritt 5 (Etappe 1): neuer Item-Shop mit Seltenheiten
-- Profilbilder, Rahmen, Hintergründe, Akzentfarben. Reihenfolge: nach schema4.sql ausführen.
-- Mehrfaches Ausführen ist unschädlich.
-- =====================================================================
alter table public.items add column if not exists name text;
alter table public.items add column if not exists rarity text;
alter table public.items add column if not exists is_default boolean not null default false;

-- Alte Käufe erstatten (nur beim ersten Lauf, danach gibt es nichts mehr zu erstatten)
update public.profiles p set coins = p.coins + s.total
  from (select v.user_id, sum(i.price) as total from public.inventory v join public.items i on i.id = v.item_id
         where v.item_id in ('frame-pink','frame-violet','frame-gold','frame-rainbow','av-fox','av-joker','av-dragon','av-unicorn','av-rocket','av-crown','skin-night','skin-gold','skin-neon')
         group by v.user_id) s
 where p.id = s.user_id;
delete from public.inventory where item_id in ('frame-pink','frame-violet','frame-gold','frame-rainbow','av-fox','av-joker','av-dragon','av-unicorn','av-rocket','av-crown','skin-night','skin-gold','skin-neon');
delete from public.items where id in ('frame-none','frame-pink','frame-violet','frame-gold','frame-rainbow','av-default','av-fox','av-joker','av-dragon','av-unicorn','av-rocket','av-crown','skin-chrome','skin-night','skin-gold','skin-neon');

-- Neue Items
insert into public.items (id, type, val, name, rarity, price, bonus, is_default) values
('avatar-ace-of-spades', 'avatar', 'ace-of-spades', 'Ace of Spades', 'common', 0, 0, true),
('avatar-poker-chip', 'avatar', 'poker-chip', 'Poker Chip', 'common', 1000, 0, false),
('avatar-double-six', 'avatar', 'double-six', 'Double Six', 'common', 1000, 0, false),
('avatar-the-circle', 'avatar', 'the-circle', 'The Circle', 'common', 1000, 0, false),
('avatar-diamond', 'avatar', 'diamond', 'Diamond', 'common', 1000, 0, false),
('avatar-the-knight', 'avatar', 'the-knight', 'The Knight', 'rare', 5000, 0, false),
('avatar-broken-circle', 'avatar', 'broken-circle', 'Broken Circle', 'rare', 5000, 0, false),
('avatar-bloodline', 'avatar', 'bloodline', 'Bloodline', 'rare', 5000, 0, false),
('avatar-carbon', 'avatar', 'carbon', 'Carbon', 'rare', 5000, 0, false),
('avatar-lucky-vii', 'avatar', 'lucky-vii', 'Lucky VII', 'epic', 15000, 0, false),
('avatar-the-king', 'avatar', 'the-king', 'The King', 'epic', 15000, 0, false),
('avatar-obsidian-rose', 'avatar', 'obsidian-rose', 'Obsidian Rose', 'epic', 15000, 0, false),
('avatar-timeless', 'avatar', 'timeless', 'Timeless', 'epic', 15000, 0, false),
('avatar-the-jester', 'avatar', 'the-jester', 'The Jester', 'epic', 15000, 0, false),
('avatar-mockery', 'avatar', 'mockery', 'Mockery', 'epic', 15000, 0, false),
('avatar-black-mirror', 'avatar', 'black-mirror', 'Black Mirror', 'legendary', 25000, 0, false),
('avatar-sovereign', 'avatar', 'sovereign', 'Sovereign', 'legendary', 25000, 0, false),
('avatar-void-cube', 'avatar', 'void-cube', 'Void Cube', 'legendary', 25000, 0, false),
('avatar-the-emblem', 'avatar', 'the-emblem', 'The Emblem', 'legendary', 25000, 0, false),
('avatar-fools-crown', 'avatar', 'fools-crown', 'Fool''s Crown', 'legendary', 25000, 0, false),
('avatar-noir', 'avatar', 'noir', 'NOIR', 'mythic', 50000, 0, false),
('avatar-the-house', 'avatar', 'the-house', 'THE HOUSE', 'mythic', 50000, 0, false),
('avatar-the-last-love', 'avatar', 'the-last-love', 'The Last Love', 'mythic', 50000, 0, false),
('avatar-void', 'avatar', 'void', 'Void', 'mythic', 50000, 0, false),
('avatar-chrome-walker', 'avatar', 'chrome-walker', 'Chrome Walker', 'mythic', 50000, 0, false),
('frame-silverline', 'frame', 'silverline', 'Silverline', 'common', 0, 0, true),
('frame-shadow', 'frame', 'shadow', 'Shadow', 'common', 1000, 0, false),
('frame-outline', 'frame', 'outline', 'Outline', 'common', 1000, 0, false),
('frame-bordeaux', 'frame', 'bordeaux', 'Bordeaux', 'common', 1000, 0, false),
('frame-brushed-steel', 'frame', 'brushed-steel', 'Brushed Steel', 'rare', 5000, 0, false),
('frame-carbon-edge', 'frame', 'carbon-edge', 'Carbon Edge', 'rare', 5000, 0, false),
('frame-double-ring', 'frame', 'double-ring', 'Double Ring', 'rare', 5000, 0, false),
('frame-precision', 'frame', 'precision', 'Precision', 'rare', 5000, 0, false),
('frame-dark-chrome', 'frame', 'dark-chrome', 'Dark Chrome', 'epic', 15000, 0, false),
('frame-obsidian', 'frame', 'obsidian', 'Obsidian', 'epic', 15000, 0, false),
('frame-engraved', 'frame', 'engraved', 'Engraved', 'epic', 15000, 0, false),
('frame-crimson', 'frame', 'crimson', 'Crimson', 'epic', 15000, 0, false),
('frame-platinum', 'frame', 'platinum', 'Platinum', 'legendary', 25000, 0, false),
('frame-silver-agent', 'frame', 'silver-agent', 'Silver Agent', 'legendary', 25000, 0, false),
('frame-distortion', 'frame', 'distortion', 'Distortion', 'legendary', 25000, 0, false),
('frame-black-portal', 'frame', 'black-portal', 'Black Portal', 'mythic', 50000, 0, false),
('frame-eclipse', 'frame', 'eclipse', 'Eclipse', 'mythic', 50000, 0, false),
('bg-matte-black', 'bg', 'matte-black', 'Matte Black', 'common', 0, 0, true),
('bg-charcoal', 'bg', 'charcoal', 'Charcoal', 'common', 1000, 0, false),
('bg-midnight', 'bg', 'midnight', 'Midnight', 'common', 1000, 0, false),
('bg-burgundy', 'bg', 'burgundy', 'Burgundy', 'common', 1000, 0, false),
('bg-carbon', 'bg', 'carbon', 'Carbon', 'rare', 5000, 0, false),
('bg-brushed-steel', 'bg', 'brushed-steel', 'Brushed Steel', 'rare', 5000, 0, false),
('bg-dark-walnut', 'bg', 'dark-walnut', 'Dark Walnut', 'rare', 5000, 0, false),
('bg-slate', 'bg', 'slate', 'Slate', 'rare', 5000, 0, false),
('bg-black-marble', 'bg', 'black-marble', 'Black Marble', 'epic', 15000, 0, false),
('bg-black-velvet', 'bg', 'black-velvet', 'Black Velvet', 'epic', 15000, 0, false),
('bg-noir-architecture', 'bg', 'noir-architecture', 'Noir Architecture', 'epic', 15000, 0, false),
('bg-obsidian', 'bg', 'obsidian', 'Obsidian', 'legendary', 25000, 0, false),
('bg-black-platinum', 'bg', 'black-platinum', 'Black Platinum', 'legendary', 25000, 0, false),
('bg-liquid-void', 'bg', 'liquid-void', 'Liquid Void', 'mythic', 50000, 0, false),
('bg-eternal-eclipse', 'bg', 'eternal-eclipse', 'Eternal Eclipse', 'mythic', 50000, 0, false),
('accent-silver', 'accent', 'silver', 'Silver', 'common', 0, 0, true),
('accent-burgundy', 'accent', 'burgundy', 'Burgundy', 'common', 1000, 0, false),
('accent-midnight-blue', 'accent', 'midnight-blue', 'Midnight Blue', 'common', 1000, 0, false),
('accent-emerald', 'accent', 'emerald', 'Emerald', 'rare', 5000, 0, false),
('accent-champagne', 'accent', 'champagne', 'Champagne', 'rare', 5000, 0, false),
('accent-amethyst', 'accent', 'amethyst', 'Amethyst', 'rare', 5000, 0, false),
('accent-deep-teal', 'accent', 'deep-teal', 'Deep Teal', 'rare', 5000, 0, false),
('accent-copper', 'accent', 'copper', 'Copper', 'epic', 15000, 0, false),
('accent-crimson', 'accent', 'crimson', 'Crimson', 'epic', 15000, 0, false),
('accent-platinum', 'accent', 'platinum', 'Platinum', 'epic', 15000, 0, false),
('accent-royal-gold', 'accent', 'royal-gold', 'Royal Gold', 'legendary', 25000, 0, false),
('accent-frost', 'accent', 'frost', 'Frost', 'legendary', 25000, 0, false),
('accent-liquid-chrome', 'accent', 'liquid-chrome', 'Liquid Chrome', 'mythic', 50000, 0, false),
('accent-void-red', 'accent', 'void-red', 'Void Red', 'mythic', 50000, 0, false),
('accent-eternal', 'accent', 'eternal', 'Eternal', 'mythic', 50000, 0, false)
on conflict (id) do update set type = excluded.type, val = excluded.val, name = excluded.name,
  rarity = excluded.rarity, price = excluded.price, is_default = excluded.is_default;

-- Standard-Ausrüstung: jeweils das erste Häufig-Item jeder Kategorie
alter table public.profiles alter column eq set default '{"avatar": "ace-of-spades", "frame": "silverline", "cardback": "matte-black", "felt": "classic-green", "chip": "classic-black", "dice": "classic-black", "anim": "classic-flip", "bg": "matte-black", "namefx": "pure-white", "accent": "silver"}'::jsonb;
update public.profiles set eq = '{"avatar": "ace-of-spades", "frame": "silverline", "cardback": "matte-black", "felt": "classic-green", "chip": "classic-black", "dice": "classic-black", "anim": "classic-flip", "bg": "matte-black", "namefx": "pure-white", "accent": "silver"}'::jsonb where eq->'accent' is null;

create or replace function public.equip_item(p_type text, p_val text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if not exists (select 1 from items i where i.type = p_type and i.val = p_val and i.type <> 'bonus'
                   and (i.is_default or exists (select 1 from inventory v where v.user_id = u and v.item_id = i.id))) then
    raise exception 'Das Item ist nicht in deinem Inventar';
  end if;
  update profiles set eq = jsonb_set(eq, array[p_type], to_jsonb(p_val)) where id = u;
end $$;

-- Raumzustand: jetzt mit Ausrüstung der Spieler (Profilbild und Rahmen am Tisch)
create or replace function public.get_room(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_code, ''))); rm rooms; mh jsonb;
begin
  if not is_member(c) then raise exception 'Du bist in diesem Raum nicht mehr dabei'; end if;
  select * into rm from rooms where code = c;
  if not found then raise exception 'Raum nicht gefunden'; end if;
  select jsonb_build_object('hand', hand, 'done', done) into mh from poker_hands
   where code = c and round = rm.round and user_id = auth.uid();
  return jsonb_build_object('code', rm.code, 'host', rm.host, 'game', rm.game, 'phase', rm.phase, 'round', rm.round,
    'result', rm.result, 'payouts', rm.payouts, 'ante', rm.ante, 'pot', rm.pot, 'seats', rm.seats, 'my_hand', mh,
    'bb', rm.bb, 'board', rm.board, 'street', rm.street, 'cur', rm.cur, 'cbet', rm.cbet, 'minraise', rm.minraise, 'btn', rm.btn, 'log', rm.log,
    'hseats', coalesce((select jsonb_agg(jsonb_build_object('user_id', hs.user_id, 'name', hs.name, 'seat', hs.seat, 'stack', hs.stack, 'bet', hs.bet,
                'total', hs.total, 'folded', hs.folded, 'allin', hs.allin, 'in_hand', hs.in_hand,
                'eq', (select pr2.eq from profiles pr2 where pr2.id = hs.user_id)) order by hs.seat) from holdem_seats hs where hs.code = c), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.name,
                'eq', (select pr3.eq from profiles pr3 where pr3.id = m.user_id)) order by m.joined_at) from room_members m where m.code = c), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'stake', stake)) from room_bets where code = c and round = rm.round), '[]'::jsonb));
end $$;
