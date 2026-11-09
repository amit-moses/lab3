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
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.absorbDroneHit()) return;
      this.finish('A drone caught you!');
    });
    this.initPowerups();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
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

  update(time, delta) {
    if (this.finished) return;
    this.updatePowerups(delta);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s${this.powerupHud()}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  // --- Power-ups. Timers run on this.pu.clock, which only advances while the game is
  // not paused (this.paused) or finished, so every power-up timer freezes on pause.
  initPowerups() {
    const p = COIN_DASH.powerups;
    this.pu = { clock: 0, item: null, kind: null, expires: 0,
      nextSpawn: Phaser.Math.Between(p.spawnMinMs, p.spawnMaxMs),
      shieldUntil: 0, graceUntil: 0, slowUntil: 0 };
    this.physics.add.overlap(this.player, this.pu.itemGroup = this.physics.add.group(),
      (player, item) => this.collectPowerup(item));
  }

  updatePowerups(delta) {
    if (this.paused) return;
    const pu = this.pu, p = COIN_DASH.powerups;
    pu.clock += delta;
    if (pu.item && pu.clock >= pu.expires) this.removePowerupItem();
    if (!pu.item && pu.clock >= pu.nextSpawn) this.spawnPowerup();
    if (pu.shieldUntil && pu.clock >= pu.shieldUntil) this.endShield();
    if (pu.slowUntil && pu.clock >= pu.slowUntil) this.endSlow();
    this.player.setStrokeStyle(pu.shieldUntil ? 3 : 0, p.colors.shield);
    this.player.setFillStyle(pu.shieldUntil ? p.colors.shield : COIN_DASH.colors.player);
  }

  spawnPowerup() {
    const pu = this.pu, p = COIN_DASH.powerups;
    pu.kind = Phaser.Math.RND.pick(['shield', 'slow']);
    const x = Phaser.Math.Between(40, COIN_DASH.width - 40);
    const y = Phaser.Math.Between(80, COIN_DASH.height - 40);
    pu.item = this.add.star(x, y, 5, 6, 12, p.colors[pu.kind]);
    pu.itemGroup.add(pu.item);
    pu.expires = pu.clock + p.lifetimeMs;
  }

  removePowerupItem() {
    const pu = this.pu, p = COIN_DASH.powerups;
    pu.item.destroy();
    pu.item = null;
    pu.nextSpawn = pu.clock + Phaser.Math.Between(p.spawnMinMs, p.spawnMaxMs);
  }

  collectPowerup(item) {
    const pu = this.pu, p = COIN_DASH.powerups;
    if (item !== pu.item || this.finished) return;
    if (pu.kind === 'shield') pu.shieldUntil = pu.clock + p.shieldMs;
    else this.startSlow();
    this.removePowerupItem();
  }

  startSlow() {
    const pu = this.pu, p = COIN_DASH.powerups;
    if (!pu.slowUntil) this.scaleDrones(p.slowFactor);
    pu.slowUntil = pu.clock + p.slowMs;
  }

  endSlow() {
    this.scaleDrones(1 / COIN_DASH.powerups.slowFactor);
    this.pu.slowUntil = 0;
  }

  scaleDrones(f) {
    this.drones.getChildren().forEach(d => d.body.velocity.scale(f));
  }

  endShield() {
    this.pu.shieldUntil = 0;
  }

  // Returns true if an active shield absorbed this drone hit.
  absorbDroneHit() {
    const pu = this.pu;
    if (pu.clock < pu.graceUntil) return true;
    if (!pu.shieldUntil) return false;
    this.endShield();
    pu.graceUntil = pu.clock + COIN_DASH.powerups.shieldGraceMs;
    return true;
  }

  powerupHud() {
    const pu = this.pu;
    const left = t => Math.ceil((t - pu.clock) / 1000);
    return (pu.shieldUntil ? `  Shield: ${left(pu.shieldUntil)}s` : '')
      + (pu.slowUntil ? `  Slow: ${left(pu.slowUntil)}s` : '');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
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
