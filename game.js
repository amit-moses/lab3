/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.playSound('coin');
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.initAudio();
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  // --- Sound effects, synthesized with WebAudio (no audio files).
  // The AudioContext is created on the first key press (browser autoplay rules).
  initAudio() {
    let muted = false;
    try { muted = localStorage.getItem(COIN_DASH.audio.storageKey) === '1'; } catch (e) { /* default unmuted */ }
    this.muted = muted;
    this.muteLabel = this.add.text(COIN_DASH.width - 18, 12, 'Muted',
      { font: '14px monospace', color: '#9fb0c8' }).setOrigin(1, 0).setVisible(this.muted);
    this.input.keyboard.on('keydown', () => this.ensureAudio());
    this.input.keyboard.on('keydown-M', () => {
      this.muted = !this.muted;
      this.muteLabel.setVisible(this.muted);
      try { localStorage.setItem(COIN_DASH.audio.storageKey, this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    });
  }

  ensureAudio() {
    if (!window.coinDashAudio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      window.coinDashAudio = new Ctx();
    }
    if (window.coinDashAudio.state === 'suspended') window.coinDashAudio.resume();
    return window.coinDashAudio;
  }

  playSound(name) {
    const ctx = window.coinDashAudio;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    // [frequency Hz, start offset s, duration s, wave type]
    const notes = {
      coin: [[880, 0, 0.08, 'square'], [1320, 0.07, 0.1, 'square']],
      gameOver: [[330, 0, 0.18, 'sawtooth'], [220, 0.18, 0.18, 'sawtooth'], [147, 0.36, 0.35, 'sawtooth']],
      timeUp: [[523, 0, 0.15, 'triangle'], [392, 0.17, 0.3, 'triangle']]
    }[name];
    const t0 = ctx.currentTime;
    notes.forEach(([freq, at, dur, type]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(COIN_DASH.audio.volume, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur);
    });
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.playSound(reason === 'Time is up!' ? 'timeUp' : 'gameOver');
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
