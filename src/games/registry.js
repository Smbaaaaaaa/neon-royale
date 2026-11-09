export const BETS = [2, 5, 10, 20, 50, 100, 500, 1000] // wählbare Einsätze/Chipwerte in RC; die Gewinntabelle der Slot Machine gilt für 2 RC und skaliert mit dem Einsatz
export const games = [
  { id: 'slots', name: 'Slot Machine', blurb: 'Fünf Walzen, Hebel, 9 Gewinnlinien.', path: '/spiele/slots', featured: true },
  { id: 'roulette', name: 'Roulette', blurb: 'Europäisches Roulette mit einer Null.', path: '/spiele/roulette' },
  { id: 'blackjack', name: 'Blackjack', blurb: 'Schlag den Dealer, ohne über 21 zu gehen.', path: '/spiele/blackjack' },
  { id: 'poker', name: 'Video Poker', blurb: 'Jacks or Better: halte die besten Karten.', path: '/spiele/poker' },
  { id: 'scratch', name: 'Rubbellose', blurb: 'Rubble die Folie mit der Royal-Münze frei.', path: '/spiele/rubbellose' },
  { id: 'holdem', name: "Texas Hold'em", blurb: 'Mehrspieler-Poker mit Blinds, Erhöhen und All-in.', path: '/multiplayer' },
]
