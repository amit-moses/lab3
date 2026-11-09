// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  bestKey: 'coinDash.best',
  levelKey: 'coinDash.level',
  levels: {
    easy: { label: 'Easy', droneSpeed: 70, droneCount: 3 },
    normal: { label: 'Normal', droneSpeed: 105, droneCount: 3 },
    hard: { label: 'Hard', droneSpeed: 150, droneCount: 5 }
  },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
