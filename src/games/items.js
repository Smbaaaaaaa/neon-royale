export const ITEMS = [
  { id: 'starter3', type: 'bonus', name: 'Starter-Bonus', desc: 'Einmalig 10.000 Neon Coins gratis', price: 0, bonus: 10000 },
  { id: 'frame-none', type: 'frame', val: 'none', name: 'Kein Rahmen', price: 0, default: true },
  { id: 'frame-pink', type: 'frame', val: 'pink', name: 'Neon-Pink', price: 300 },
  { id: 'frame-violet', type: 'frame', val: 'violet', name: 'Ultraviolett', price: 300 },
  { id: 'frame-gold', type: 'frame', val: 'gold', name: 'Goldrand', price: 800 },
  { id: 'frame-rainbow', type: 'frame', val: 'rainbow', name: 'Regenbogen', price: 2500 },
  { id: 'av-default', type: 'avatar', val: 'default', glyph: '🎰', name: 'Automat', price: 0, default: true },
  { id: 'av-fox', type: 'avatar', val: 'fox', glyph: '🦊', name: 'Fuchs', price: 200 },
  { id: 'av-joker', type: 'avatar', val: 'joker', glyph: '🃏', name: 'Joker', price: 400 },
  { id: 'av-dragon', type: 'avatar', val: 'dragon', glyph: '🐉', name: 'Drache', price: 600 },
  { id: 'av-unicorn', type: 'avatar', val: 'unicorn', glyph: '🦄', name: 'Einhorn', price: 800 },
  { id: 'av-rocket', type: 'avatar', val: 'rocket', glyph: '🚀', name: 'Rakete', price: 1000 },
  { id: 'av-crown', type: 'avatar', val: 'crown', glyph: '👑', name: 'Krone', price: 1500 },
  { id: 'skin-chrome', type: 'skin', val: 'chrome', name: 'Chrom Classic', price: 0, default: true },
  { id: 'skin-night', type: 'skin', val: 'night', name: 'Nacht-Chrom', price: 1000 },
  { id: 'skin-gold', type: 'skin', val: 'gold', name: 'Gold Edition', price: 1500 },
  { id: 'skin-neon', type: 'skin', val: 'neon', name: 'Neon Edition', price: 2500 },
]
export const TYPES = { frame: 'Profilrahmen', avatar: 'Avatare', skin: 'Automaten-Skins' }
export const glyphOf = v => ITEMS.find(i => i.type === 'avatar' && i.val === v)?.glyph ?? '🎰'
