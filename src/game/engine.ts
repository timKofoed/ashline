import { sfx, unlockAudio } from "@/game/audio";

/**
 * Top-down twin-stick. Movement is screen-space and independent of aim.
 * +Y is down the canvas.
 * A / ArrowLeft  decreases world x (left)
 * D / ArrowRight increases world x (right)
 * W / ArrowUp    decreases world y (up on screen)
 * S / ArrowDown  increases world y
 */

export type Phase = "menu" | "play" | "pause" | "dead" | "won";
export type WeaponId = "pistol" | "shotgun" | "mg";
export type ZKind = "shambler" | "runner" | "brute" | "boss";

export interface Hud {
  phase: Phase;
  act: number;
  actTitle: string;
  waveLabel: string;
  score: number;
  best: number;
  hp: number;
  maxHp: number;
  weapon: WeaponId;
  shotgun: boolean;
  mg: boolean;
  bossName: string | null;
  bossHp: number;
  bossMax: number;
  banner: string;
  keyboard: boolean;
}

export interface Stick {
  x: number;
  y: number;
  active: boolean;
}

const WORLD_W = 2400;
const WORLD_H = 1600;
const WALL = 64;
const STEP = 1 / 60;
const BEST_KEY = "ashline-best";
const SPEED = 228;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Wave {
  count: number;
  hp: number;
  speed: number;
  runners: number;
  brutes: number;
}
interface ActDef {
  title: string;
  quiet: string;
  tint: string;
  interval: number;
  waves: Wave[];
  boss: { name: string; hp: number; speed: number; radius: number };
  blocks: Rect[];
  pickups: { kind: "shotgun" | "mg" | "med"; x: number; y: number }[];
}

const ACTS: ActDef[] = [
  {
    title: "Act I — The Lot",
    quiet: "The lot is quiet",
    tint: "#c4bfb4",
    interval: 0.74,
    waves: [
      { count: 5, hp: 26, speed: 52, runners: 0, brutes: 0 },
      { count: 6, hp: 30, speed: 60, runners: 0, brutes: 0 },
      { count: 7, hp: 34, speed: 68, runners: 1, brutes: 0 },
    ],
    boss: { name: "The Orderly", hp: 340, speed: 56, radius: 46 },
    blocks: [
      { x: 420, y: 380, w: 170, h: 110 },
      { x: 1780, y: 340, w: 180, h: 120 },
      { x: 480, y: 1080, w: 160, h: 130 },
      { x: 1680, y: 1100, w: 200, h: 110 },
      { x: 1040, y: 260, w: 140, h: 90 },
    ],
    pickups: [
      { kind: "shotgun", x: 1960, y: 780 },
      { kind: "med", x: 430, y: 800 },
    ],
  },
  {
    title: "Act II — The Ward",
    quiet: "The ward is quiet",
    tint: "#b7c0ae",
    interval: 0.42,
    waves: [
      { count: 6, hp: 40, speed: 84, runners: 2, brutes: 0 },
      { count: 7, hp: 44, speed: 90, runners: 3, brutes: 0 },
      { count: 7, hp: 48, speed: 96, runners: 3, brutes: 1 },
      { count: 8, hp: 50, speed: 100, runners: 4, brutes: 1 },
    ],
    boss: { name: "The Surgeon", hp: 640, speed: 76, radius: 56 },
    blocks: [
      { x: 820, y: 340, w: 90, h: 300 },
      { x: 1490, y: 340, w: 90, h: 300 },
      { x: 820, y: 980, w: 90, h: 280 },
      { x: 1490, y: 980, w: 90, h: 280 },
      { x: 340, y: 720, w: 220, h: 80 },
      { x: 1840, y: 740, w: 220, h: 80 },
    ],
    pickups: [
      { kind: "mg", x: 1200, y: 1240 },
      { kind: "med", x: 1200, y: 240 },
    ],
  },
  {
    title: "Act III — The Morgue",
    quiet: "The morgue is quiet",
    tint: "#c2aea4",
    interval: 0.3,
    waves: [
      { count: 7, hp: 52, speed: 104, runners: 3, brutes: 0 },
      { count: 8, hp: 56, speed: 110, runners: 4, brutes: 1 },
      { count: 8, hp: 58, speed: 116, runners: 5, brutes: 2 },
      { count: 9, hp: 62, speed: 120, runners: 5, brutes: 2 },
      { count: 10, hp: 66, speed: 124, runners: 6, brutes: 2 },
    ],
    boss: { name: "The Warden", hp: 980, speed: 88, radius: 66 },
    blocks: [
      { x: 680, y: 480, w: 240, h: 90 },
      { x: 1480, y: 480, w: 240, h: 90 },
      { x: 680, y: 1020, w: 240, h: 90 },
      { x: 1480, y: 1020, w: 240, h: 90 },
      { x: 340, y: 700, w: 100, h: 220 },
      { x: 1960, y: 700, w: 100, h: 220 },
      { x: 1060, y: 230, w: 280, h: 80 },
      { x: 1060, y: 1300, w: 280, h: 80 },
    ],
    pickups: [{ kind: "med", x: 1200, y: 1080 }],
  },
];

const GUNS: Record<
  WeaponId,
  { cooldown: number; speed: number; damage: number; pellets: number; spread: number; recoil: number; knock: number; frame: number; size: number }
> = {
  pistol: { cooldown: 0.34, speed: 880, damage: 24, pellets: 1, spread: 0.035, recoil: 0.14, knock: 90, frame: 0, size: 52 },
  shotgun: { cooldown: 0.78, speed: 740, damage: 11, pellets: 6, spread: 0.52, recoil: 0.5, knock: 340, frame: 1, size: 78 },
  mg: { cooldown: 0.078, speed: 960, damage: 8, pellets: 1, spread: 0.11, recoil: 0.07, knock: 42, frame: 2, size: 70 },
};

interface Zombie {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  kind: ZKind;
  flash: number;
  kx: number;
  ky: number;
  walk: number;
  face: number;
  enraged: boolean;
}
interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  knock: number;
}
interface Head {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  rot: number;
  vr: number;
  life: number;
  scale: number;
}
interface Blood {
  active: boolean;
  x: number;
  y: number;
  rot: number;
  scale: number;
  frame: number;
  life: number;
}
interface Corpse {
  active: boolean;
  x: number;
  y: number;
  rot: number;
  headless: boolean;
  life: number;
  scale: number;
}
interface Pickup {
  active: boolean;
  kind: "shotgun" | "mg" | "med";
  x: number;
  y: number;
  bob: number;
}
interface Floater {
  active: boolean;
  x: number;
  y: number;
  text: string;
  life: number;
}
interface PointerHeld {
  role: "move" | "aim";
  ox: number;
  oy: number;
  x: number;
  y: number;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  return img;
}

function pushOut(e: { x: number; y: number; radius: number }, rect: Rect) {
  const nearestX = clamp(e.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(e.y, rect.y, rect.y + rect.h);
  const dx = e.x - nearestX;
  const dy = e.y - nearestY;
  const inside = dx === 0 && dy === 0;
  if (!inside) {
    const d = Math.hypot(dx, dy);
    if (d >= e.radius || d === 0) return;
    const push = e.radius - d;
    e.x += (dx / d) * push;
    e.y += (dy / d) * push;
    return;
  }
  const left = e.x - rect.x;
  const right = rect.x + rect.w - e.x;
  const top = e.y - rect.y;
  const bottom = rect.y + rect.h - e.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) e.x = rect.x - e.radius;
  else if (m === right) e.x = rect.x + rect.w + e.radius;
  else if (m === top) e.y = rect.y - e.radius;
  else e.y = rect.y + rect.h + e.radius;
}

function resolveBody(e: { x: number; y: number; radius: number }, blocks: Rect[]) {
  e.x = clamp(e.x, WALL + e.radius, WORLD_W - WALL - e.radius);
  e.y = clamp(e.y, WALL + e.radius, WORLD_H - WALL - e.radius);
  for (let i = 0; i < 2; i++) for (const rect of blocks) pushOut(e, rect);
}

export class Engine {
  phase: Phase = "menu";
  private canvas: HTMLCanvasElement;
  private onHud: (hud: Hud) => void;
  private onSticks: (left: Stick, right: Stick) => void;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private hitstop = 0;
  private shake = 0;
  private reduceMotion = false;
  private camX = 0;
  private camY = 0;
  private score = 0;
  private best = 0;
  private act = 1;
  private def = ACTS[0]!;
  private obstacles: Rect[] = [];
  private waveIndex = -1;
  private waveQueue: ZKind[] = [];
  private waveHp = 30;
  private waveSpeed = 60;
  private spawnCd = 0;
  private between = 0;
  private bossUp = false;
  private clearT = 0;
  private banner = "";
  private bannerT = 0;
  private keyboard = false;
  private qaKeys = false;
  private keys = new Set<string>();
  private pointers = new Map<number, PointerHeld>();
  private mouseDown = false;
  private hasMouseAim = false;
  private mouseX = 0;
  private mouseY = 0;
  private lastEmit = 0;
  stickL: Stick = { x: 0, y: 0, active: false };
  stickR: Stick = { x: 0, y: 0, active: false };
  private player = {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    vx: 0,
    vy: 0,
    aim: 0,
    hp: 100,
    maxHp: 100,
    radius: 16,
    fireCd: 0,
    invuln: 0,
    muzzle: 0,
    walk: 0,
    weapon: "pistol" as WeaponId,
    unlocked: { shotgun: false, mg: false },
  };
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private heads: Head[] = [];
  private bloods: Blood[] = [];
  private corpses: Corpse[] = [];
  private pickups: Pickup[] = [];
  private texts: Floater[] = [];
  private img = {
    player: loadImage("/game/player.png"),
    zombie: loadImage("/game/zombie.png"),
    boss: loadImage("/game/boss.png"),
    blood: loadImage("/game/blood.png"),
    weapons: loadImage("/game/weapons.png"),
    muzzle: loadImage("/game/muzzle.png"),
    head: loadImage("/game/head.png"),
    crate: loadImage("/game/crate.png"),
    medkit: loadImage("/game/medkit.png"),
    corpse: loadImage("/game/corpse.png"),
    corpseOff: loadImage("/game/corpse-off.png"),
    floor: loadImage("/game/floor.jpg"),
  };
  private cleanups: Array<() => void> = [];

  constructor(
    canvas: HTMLCanvasElement,
    handlers: { onHud: (hud: Hud) => void; onSticks: (left: Stick, right: Stick) => void },
  ) {
    this.canvas = canvas;
    this.onHud = handlers.onHud;
    this.onSticks = handlers.onSticks;
    this.ctx2d = canvas.getContext("2d");
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
    } catch {
      this.best = 0;
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    this.obstacles = ACTS[0]!.blocks.map((b) => ({ ...b }));
  }

  start() {
    this.bind();
    this.installProbe();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.emit(true);
    return () => this.stop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    for (const off of this.cleanups) off();
    this.cleanups = [];
  }

  startRun() {
    unlockAudio();
    this.score = 0;
    this.player.x = WORLD_W / 2;
    this.player.y = WORLD_H / 2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.aim = 0;
    this.player.hp = 100;
    this.player.fireCd = 0;
    this.player.invuln = 0;
    this.player.muzzle = 0;
    this.player.walk = 0;
    this.player.weapon = "pistol";
    this.player.unlocked.shotgun = false;
    this.player.unlocked.mg = false;
    this.keys.delete("Space");
    this.keys.delete("Enter");
    this.deactivateAll();
    this.phase = "play";
    this.setupAct(1);
    this.emit(true);
  }

  toMenu() {
    this.phase = "menu";
    this.deactivateAll();
    this.player.hp = this.player.maxHp;
    this.player.x = WORLD_W / 2;
    this.player.y = WORLD_H / 2;
    this.clearT = 0;
    this.bannerT = 0;
    this.emit(true);
  }

  togglePause() {
    if (this.phase === "play") this.phase = "pause";
    else if (this.phase === "pause") this.phase = "play";
    this.emit(true);
  }

  setWeapon(id: WeaponId) {
    if (id === "shotgun" && !this.player.unlocked.shotgun) return;
    if (id === "mg" && !this.player.unlocked.mg) return;
    this.player.weapon = id;
    this.emit(true);
  }

  private setupAct(n: number) {
    this.act = n;
    this.def = ACTS[n - 1] ?? ACTS[0]!;
    this.obstacles = this.def.blocks.map((b) => ({ ...b }));
    this.waveIndex = -1;
    this.waveQueue = [];
    this.between = 0;
    this.bossUp = false;
    this.clearT = 0;
    this.spawnCd = 0;
    for (const z of this.zombies) z.active = false;
    for (const b of this.bullets) b.active = false;
    this.banner = this.def.title;
    this.bannerT = 2.6;
    this.placePickups();
    resolveBody(this.player, this.obstacles);
  }

  private placePickups() {
    this.pickups = [];
    const add = (kind: Pickup["kind"], x: number, y: number) => {
      if (kind === "shotgun" && this.player.unlocked.shotgun) return;
      if (kind === "mg" && this.player.unlocked.mg) return;
      this.pickups.push({ active: true, kind, x, y, bob: Math.random() * 6 });
    };
    for (const p of this.def.pickups) add(p.kind, p.x, p.y);
    if (this.act === 3) {
      if (!this.player.unlocked.shotgun) add("shotgun", 960, 800);
      if (!this.player.unlocked.mg) add("mg", 1440, 800);
    }
  }

  private deactivateAll() {
    for (const list of [this.zombies, this.bullets, this.heads, this.bloods, this.corpses, this.texts]) {
      for (const item of list) item.active = false;
    }
    this.pickups = [];
  }

  private frame = (t: number) => {
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    if (this.phase === "play") {
      if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt);
      else {
        this.acc = Math.min(0.2, this.acc + dt);
        let guard = 0;
        while (this.acc >= STEP && guard++ < 5 && this.phase === "play") {
          this.step(STEP);
          this.acc -= STEP;
        }
      }
    }
    this.draw();
    this.onSticks(this.stickL, this.stickR);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number) {
    this.time += dt;
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.player.fireCd = Math.max(0, this.player.fireCd - dt);
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.muzzle = Math.max(0, this.player.muzzle - dt);
    this.shake = Math.max(0, this.shake - dt * 1.7);
    this.applyInput(dt);
    this.cosmetics(dt);
    if (this.clearT > 0) {
      this.clearT -= dt;
      this.collect();
      if (this.clearT <= 0) this.advance();
      return;
    }
    this.updateSpawns(dt);
    this.updateZombies(dt);
    if (this.phase !== "play") return;
    this.updateBullets(dt);
    this.collect();
    this.checkProgress(dt);
  }

  private applyInput(dt: number) {
    const move = this.readMove();
    const len = Math.hypot(move.x, move.y);
    const mx = len > 1 ? move.x / len : move.x;
    const my = len > 1 ? move.y / len : move.y;
    this.player.vx = mx * SPEED;
    this.player.vy = my * SPEED;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    resolveBody(this.player, this.obstacles);
    if (mx !== 0 || my !== 0) this.player.walk += dt * 9;
    this.stickL = move.stick
      ? { x: move.knobX, y: move.knobY, active: true }
      : mx !== 0 || my !== 0
        ? { x: mx * 36, y: my * 36, active: true }
        : { x: 0, y: 0, active: false };

    const aim = [...this.pointers.values()].find((p) => p.role === "aim");
    let firing = this.mouseDown || this.keys.has("Space");
    if (aim) {
      const w = this.clientToWorld(aim.x, aim.y);
      this.player.aim = Math.atan2(w.y - this.player.y, w.x - this.player.x);
      firing = true;
      const dx = aim.x - aim.ox;
      const dy = aim.y - aim.oy;
      const d = Math.hypot(dx, dy) || 1;
      const c = Math.min(d, 46);
      this.stickR = { x: (dx / d) * c, y: (dy / d) * c, active: true };
    } else if (this.hasMouseAim) {
      const w = this.clientToWorld(this.mouseX, this.mouseY);
      this.player.aim = Math.atan2(w.y - this.player.y, w.x - this.player.x);
      this.stickR = { x: 0, y: 0, active: false };
    } else {
      this.stickR = { x: 0, y: 0, active: false };
    }

    const gun = GUNS[this.player.weapon];
    if (firing && this.player.fireCd <= 0) {
      this.player.fireCd = gun.cooldown;
      this.player.muzzle = 0.07;
      this.shake = Math.min(1, this.shake + gun.recoil);
      for (let i = 0; i < gun.pellets; i++) {
        const a = this.player.aim + (Math.random() - 0.5) * gun.spread;
        const b = this.take(this.bullets, () => ({
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          damage: 0,
          radius: 4,
          knock: 0,
        }));
        const muzzle = 28;
        b.x = this.player.x + Math.cos(a) * muzzle;
        b.y = this.player.y + Math.sin(a) * muzzle;
        b.vx = Math.cos(a) * gun.speed;
        b.vy = Math.sin(a) * gun.speed;
        b.life = 0.72;
        b.damage = gun.damage;
        b.radius = this.player.weapon === "shotgun" ? 3.5 : 3;
        b.knock = gun.knock;
      }
      if (this.player.weapon === "shotgun") sfx.shotgun();
      else if (this.player.weapon === "mg") sfx.mg();
      else sfx.pistol();
    }
  }

  private readMove() {
    const held = [...this.pointers.values()].find((p) => p.role === "move");
    if (held) {
      const dx = held.x - held.ox;
      const dy = held.y - held.oy;
      const len = Math.hypot(dx, dy);
      const dead = 14;
      const max = 64;
      if (len < dead) return { x: 0, y: 0, stick: true, knobX: dx, knobY: dy };
      const mag = Math.min(1, (len - dead) / (max - dead));
      const knob = Math.min(len, 46);
      return {
        x: (dx / len) * mag,
        y: (dy / len) * mag,
        stick: true,
        knobX: (dx / len) * knob,
        knobY: (dy / len) * knob,
      };
    }
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, stick: false, knobX: 0, knobY: 0 };
  }

  private updateSpawns(dt: number) {
    if (this.waveQueue.length === 0) return;
    this.spawnCd -= dt;
    if (this.spawnCd > 0) return;
    if (this.zombies.filter((z) => z.active).length >= 36) return;
    const kind = this.waveQueue.pop();
    if (!kind) return;
    this.spawnZombie(kind);
    this.spawnCd = this.def.interval;
  }

  private spawnZombie(kind: ZKind) {
    const z = this.take(this.zombies, () => ({
      active: false,
      x: 0,
      y: 0,
      hp: 1,
      maxHp: 1,
      speed: 60,
      radius: 20,
      kind: "shambler" as ZKind,
      flash: 0,
      kx: 0,
      ky: 0,
      walk: 0,
      face: 1,
      enraged: false,
    }));
    const spot = this.edgeSpot();
    z.x = spot.x;
    z.y = spot.y;
    z.kind = kind;
    z.flash = 0;
    z.kx = 0;
    z.ky = 0;
    z.walk = Math.random() * 4;
    z.face = this.player.x >= spot.x ? 1 : -1;
    z.enraged = false;
    let hp = this.waveHp;
    let speed = this.waveSpeed;
    let radius = 20;
    if (kind === "runner") {
      hp *= 0.7;
      speed *= 1.42;
      radius = 18;
    } else if (kind === "brute") {
      hp *= 1.85;
      speed *= 0.66;
      radius = 28;
    } else if (kind === "boss") {
      hp = this.def.boss.hp;
      speed = this.def.boss.speed;
      radius = this.def.boss.radius;
    }
    z.hp = hp;
    z.maxHp = hp;
    z.speed = speed;
    z.radius = radius;
    resolveBody(z, this.obstacles);
    return z;
  }

  private edgeSpot() {
    for (let i = 0; i < 14; i++) {
      const side = (Math.random() * 4) | 0;
      const m = WALL + 36;
      let x = m;
      let y = m;
      if (side === 0) {
        x = m + Math.random() * (WORLD_W - m * 2);
        y = m;
      } else if (side === 1) {
        x = WORLD_W - m;
        y = m + Math.random() * (WORLD_H - m * 2);
      } else if (side === 2) {
        x = m + Math.random() * (WORLD_W - m * 2);
        y = WORLD_H - m;
      } else {
        x = m;
        y = m + Math.random() * (WORLD_H - m * 2);
      }
      if (Math.hypot(x - this.player.x, y - this.player.y) < 320) continue;
      const body = { x, y, radius: 22 };
      const beforeX = body.x;
      const beforeY = body.y;
      resolveBody(body, this.obstacles);
      if (Math.hypot(body.x - beforeX, body.y - beforeY) > 8) continue;
      return { x, y };
    }
    return { x: WALL + 80, y: WORLD_H / 2 };
  }

  private updateZombies(dt: number) {
    for (const z of this.zombies) {
      if (!z.active) continue;
      z.flash = Math.max(0, z.flash - dt);
      if (z.kind === "boss" && !z.enraged && z.hp < z.maxHp * 0.5) {
        z.enraged = true;
        z.speed *= 1.16;
      }
      const dx = this.player.x - z.x;
      const dy = this.player.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      const vx = (dx / d) * z.speed + z.kx;
      if (vx > 14) z.face = 1;
      else if (vx < -14) z.face = -1;
      z.x += vx * dt;
      z.y += (dy / d) * z.speed * dt + z.ky * dt;
      z.kx *= Math.exp(-7 * dt);
      z.ky *= Math.exp(-7 * dt);
      z.walk += dt * (4 + z.speed * 0.02);
      let sx = 0;
      let sy = 0;
      for (const o of this.zombies) {
        if (!o.active || o === z) continue;
        const ox = z.x - o.x;
        const oy = z.y - o.y;
        const od = Math.hypot(ox, oy);
        const min = z.radius + o.radius + 6;
        if (od > 0 && od < min) {
          sx += (ox / od) * (min - od);
          sy += (oy / od) * (min - od);
        }
      }
      z.x += sx * 0.22;
      z.y += sy * 0.22;
      resolveBody(z, this.obstacles);
      if (d < this.player.radius + z.radius - 2 && this.player.invuln <= 0) {
        const dmg = z.kind === "boss" ? 8 + this.act * 4 : z.kind === "brute" ? 14 : z.kind === "runner" ? 9 : 6 + this.act;
        this.player.hp -= dmg;
        this.player.invuln = 0.62;
        const ang = Math.atan2(this.player.y - z.y, this.player.x - z.x);
        this.player.x += Math.cos(ang) * 22;
        this.player.y += Math.sin(ang) * 22;
        resolveBody(this.player, this.obstacles);
        this.shake = Math.min(1, this.shake + 0.45);
        this.spill(this.player.x, this.player.y, 1, 0.55);
        sfx.hurt();
        if (this.player.hp <= 0) {
          this.player.hp = 0;
          this.phase = "dead";
          this.commitScore();
          sfx.dead();
          this.emit(true);
          return;
        }
      }
    }
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < WALL || b.y < WALL || b.x > WORLD_W - WALL || b.y > WORLD_H - WALL) {
        b.active = false;
        continue;
      }
      let blocked = false;
      for (const rect of this.obstacles) {
        if (b.x > rect.x && b.x < rect.x + rect.w && b.y > rect.y && b.y < rect.y + rect.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        b.active = false;
        continue;
      }
      for (const z of this.zombies) {
        if (!z.active) continue;
        if (Math.hypot(b.x - z.x, b.y - z.y) > b.radius + z.radius) continue;
        z.hp -= b.damage;
        z.flash = 0.08;
        const inv = Math.hypot(b.vx, b.vy) || 1;
        z.kx += (b.vx / inv) * b.knock;
        z.ky += (b.vy / inv) * b.knock;
        b.active = false;
        if (z.hp <= 0) this.killZombie(z);
        else if (Math.random() < 0.12) this.spill(z.x, z.y, 1, 0.45);
        else sfx.hit();
        break;
      }
    }
  }

  private killZombie(z: Zombie) {
    z.active = false;
    const boss = z.kind === "boss";
    const pop = boss || Math.random() < 0.42;
    const points = boss ? 200 : z.kind === "brute" ? 25 : z.kind === "runner" ? 15 : 10;
    this.score += points;
    this.spawnText(z.x, z.y - 10, `+${points}`);
    const corpse = this.take(this.corpses, () => ({
      active: false,
      x: 0,
      y: 0,
      rot: 0,
      headless: false,
      life: 0,
      scale: 1,
    }));
    corpse.x = z.x;
    corpse.y = z.y;
    corpse.rot = Math.atan2(z.y - this.player.y, z.x - this.player.x);
    corpse.headless = pop;
    corpse.life = 18;
    corpse.scale = boss ? z.radius / 28 : z.kind === "brute" ? 1.25 : 1;
    this.spill(z.x, z.y, boss ? 4 : pop ? 3 : 2, boss ? 0.9 : 0.75);
    if (pop) {
      const head = this.take(this.heads, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        rot: 0,
        vr: 0,
        life: 0,
        scale: 1,
      }));
      const ang = Math.atan2(z.y - this.player.y, z.x - this.player.x) + (Math.random() - 0.5) * 0.9;
      const sp = 80 + Math.random() * 90;
      head.x = z.x;
      head.y = z.y;
      head.vx = Math.cos(ang) * sp;
      head.vy = Math.sin(ang) * sp;
      head.z = 6;
      head.vz = 240 + Math.random() * 80;
      head.rot = Math.random() * 6;
      head.vr = (Math.random() - 0.5) * 9;
      head.life = 14;
      head.scale = boss ? 1.65 : 1;
    }
    this.hitstop = boss ? 0.08 : 0.03;
    this.shake = Math.min(1, this.shake + (boss ? 0.75 : 0.22));
    sfx.kill();
  }

  private spill(x: number, y: number, n: number, scale: number) {
    for (let i = 0; i < n; i++) {
      if (this.bloods.filter((b) => b.active).length >= 36 && Math.random() < 0.5) continue;
      const b = this.take(this.bloods, () => ({
        active: false,
        x: 0,
        y: 0,
        rot: 0,
        scale: 1,
        frame: 0,
        life: 0,
      }));
      b.x = x + (Math.random() - 0.5) * 28;
      b.y = y + (Math.random() - 0.5) * 28;
      b.rot = Math.random() * Math.PI * 2;
      b.scale = scale * (0.75 + Math.random() * 0.45);
      b.frame = (Math.random() * 4) | 0;
      b.life = 12 + Math.random() * 4;
    }
  }

  private cosmetics(dt: number) {
    for (const h of this.heads) {
      if (!h.active) continue;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += h.vz * dt;
      h.vz -= 920 * dt;
      h.rot += h.vr * dt;
      if (h.z <= 0) {
        h.z = 0;
        h.vz = -h.vz * 0.3;
        h.vx *= 0.7;
        h.vy *= 0.7;
        h.vr *= 0.65;
        if (Math.abs(h.vz) < 50) h.vz = 0;
      }
      h.x = clamp(h.x, WALL, WORLD_W - WALL);
      h.y = clamp(h.y, WALL, WORLD_H - WALL);
      h.life -= dt;
      if (h.life <= 0) h.active = false;
    }
    for (const b of this.bloods) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) b.active = false;
    }
    for (const c of this.corpses) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) c.active = false;
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      t.y -= 28 * dt;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
    }
  }

  private collect() {
    for (const p of this.pickups) {
      if (!p.active) continue;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) > 36) continue;
      p.active = false;
      if (p.kind === "med") {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 36);
        this.spawnText(p.x, p.y, "+health");
      } else if (p.kind === "shotgun") {
        this.player.unlocked.shotgun = true;
        this.player.weapon = "shotgun";
        this.spawnText(p.x, p.y, "Shotgun");
      } else {
        this.player.unlocked.mg = true;
        this.player.weapon = "mg";
        this.spawnText(p.x, p.y, "Machine gun");
      }
      sfx.pickup();
      this.emit(true);
    }
  }

  private checkProgress(dt: number) {
    const alive = this.zombies.some((z) => z.active);
    if (alive || this.waveQueue.length > 0) {
      this.between = 0;
      return;
    }
    this.between += dt;
    if (this.waveIndex < this.def.waves.length - 1) {
      if (this.between >= (this.waveIndex < 0 ? 1.05 : 1.3)) this.startNextWave();
      return;
    }
    if (!this.bossUp) {
      if (this.between >= 1.5) this.spawnBoss();
      return;
    }
    this.clearT = 2.5;
    this.banner = this.def.quiet;
    this.bannerT = 2.5;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    this.score += 100;
    sfx.clear();
    this.emit(true);
  }

  private startNextWave() {
    this.waveIndex += 1;
    this.between = 0;
    const w = this.def.waves[this.waveIndex];
    if (!w) return;
    this.waveHp = w.hp;
    this.waveSpeed = w.speed;
    const q: ZKind[] = [];
    for (let i = 0; i < w.brutes; i++) q.push("brute");
    for (let i = 0; i < w.runners; i++) q.push("runner");
    for (let i = 0; i < w.count; i++) q.push("shambler");
    for (let i = q.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = q[i]!;
      q[i] = q[j]!;
      q[j] = tmp;
    }
    this.waveQueue = q;
    this.spawnCd = 0.15;
    this.banner = `Wave ${this.waveIndex + 1}`;
    this.bannerT = 1.3;
  }

  private spawnBoss() {
    this.bossUp = true;
    this.between = 0;
    const spots = [
      { x: WALL + 90, y: WALL + 90 },
      { x: WORLD_W - WALL - 90, y: WALL + 90 },
      { x: WALL + 90, y: WORLD_H - WALL - 90 },
      { x: WORLD_W - WALL - 90, y: WORLD_H - WALL - 90 },
    ].sort(
      (a, b) =>
        Math.hypot(b.x - this.player.x, b.y - this.player.y) - Math.hypot(a.x - this.player.x, a.y - this.player.y),
    );
    const z = this.spawnZombie("boss");
    const spot = spots[0]!;
    z.x = spot.x;
    z.y = spot.y;
    resolveBody(z, this.obstacles);
    this.banner = this.def.boss.name;
    this.bannerT = 2.6;
    sfx.boss();
    this.emit(true);
  }

  private advance() {
    if (this.act >= 3) {
      this.score += 250;
      this.phase = "won";
      this.commitScore();
      sfx.win();
      this.emit(true);
      return;
    }
    this.setupAct(this.act + 1);
    this.emit(true);
  }

  private spawnText(x: number, y: number, text: string) {
    const t = this.take(this.texts, () => ({ active: false, x: 0, y: 0, text: "", life: 0 }));
    t.x = x;
    t.y = y;
    t.text = text;
    t.life = 0.8;
  }

  private take<T extends { active: boolean; life?: number }>(pool: T[], make: () => T): T {
    const free = pool.find((item) => !item.active);
    if (free) {
      free.active = true;
      return free;
    }
    if (pool.length < 48) {
      const item = make();
      item.active = true;
      pool.push(item);
      return item;
    }
    let slot = pool[0]!;
    for (const item of pool) if ((item.life ?? 0) < (slot.life ?? 0)) slot = item;
    slot.active = true;
    return slot;
  }

  private commitScore() {
    try {
      const prev = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
      this.best = Math.max(prev, this.score);
      localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      this.best = Math.max(this.best, this.score);
    }
  }

  private clientToWorld(cx: number, cy: number) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: cx - rect.left + this.camX, y: cy - rect.top + this.camY };
  }

  private draw() {
    const ctx = this.ctx2d;
    if (!ctx) return;
    const cssW = this.canvas.clientWidth || 1;
    const cssH = this.canvas.clientHeight || 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(0, 0, cssW, cssH);

    const look = 36;
    let camX = this.player.x - cssW / 2 + Math.cos(this.player.aim) * look;
    let camY = this.player.y - cssH / 2 + Math.sin(this.player.aim) * look;
    if (cssW < WORLD_W) camX = clamp(camX, 0, WORLD_W - cssW);
    else camX = (WORLD_W - cssW) / 2;
    if (cssH < WORLD_H) camY = clamp(camY, 0, WORLD_H - cssH);
    else camY = (WORLD_H - cssH) / 2;
    this.camX = camX;
    this.camY = camY;
    const mag = this.reduceMotion ? 0 : this.shake * 8;
    const sx = (Math.random() - 0.5) * mag;
    const sy = (Math.random() - 0.5) * mag;

    ctx.save();
    ctx.translate(-camX + sx, -camY + sy);
    this.drawWorld(ctx);
    ctx.restore();
    this.drawHud(ctx, cssW, cssH);
  }

  private drawWorld(ctx: CanvasRenderingContext2D) {
    if (this.img.floor.complete && this.img.floor.naturalWidth) {
      ctx.drawImage(this.img.floor, 0, 0, WORLD_W, WORLD_H);
    } else {
      ctx.fillStyle = "#221c17";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = this.def.tint;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();

    ctx.fillStyle = "#0c0b09";
    ctx.fillRect(0, 0, WORLD_W, WALL);
    ctx.fillRect(0, WORLD_H - WALL, WORLD_W, WALL);
    ctx.fillRect(0, 0, WALL, WORLD_H);
    ctx.fillRect(WORLD_W - WALL, 0, WALL, WORLD_H);

    for (const c of this.corpses) {
      if (!c.active) continue;
      const img = c.headless ? this.img.corpseOff : this.img.corpse;
      const alpha = c.life < 3 ? c.life / 3 : 0.92;
      ctx.save();
      ctx.globalAlpha = alpha;
      this.blit(ctx, img, 1, 1, 0, c.x, c.y, 92 * c.scale, c.rot);
      ctx.restore();
    }
    for (const b of this.bloods) {
      if (!b.active) continue;
      ctx.save();
      ctx.globalAlpha = (b.life < 3.5 ? b.life / 3.5 : 1) * 0.8;
      this.blit(ctx, this.img.blood, 2, 2, b.frame, b.x, b.y, 54 * b.scale, b.rot);
      ctx.restore();
    }
    for (const rect of this.obstacles) this.drawCrates(ctx, rect);
    for (const p of this.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(this.time * 3 + p.bob) * 4;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = "rgba(243, 234, 215, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      if (p.kind === "med") this.blit(ctx, this.img.medkit, 1, 1, 0, 0, 0, 40, 0);
      else {
        const frame = p.kind === "shotgun" ? 1 : 2;
        this.blit(ctx, this.img.weapons, 3, 1, frame, 0, 0, p.kind === "shotgun" ? 64 : 58, 0);
      }
      ctx.fillStyle = "#f3ead7";
      ctx.font = "600 14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "med" ? "MEDKIT" : p.kind === "shotgun" ? "SHOTGUN" : "MACHINE GUN", 0, -34);
      ctx.restore();
    }
    for (const h of this.heads) {
      if (!h.active) continue;
      ctx.save();
      ctx.globalAlpha = h.life < 2.5 ? Math.max(0, h.life / 2.5) : 1;
      this.shadow(ctx, h.x, h.y, 12 * h.scale);
      this.blit(ctx, this.img.head, 1, 1, 0, h.x, h.y - h.z, 34 * h.scale, h.rot);
      ctx.restore();
    }
    for (const z of this.zombies) {
      if (!z.active) continue;
      const frame = Math.floor(z.walk) % 4;
      const sheet = z.kind === "boss" ? this.img.boss : this.img.zombie;
      const size = z.radius * (z.kind === "boss" ? 2.55 : 2.7);
      this.shadow(ctx, z.x, z.y, z.radius * 0.9);
      ctx.save();
      if (z.flash > 0) ctx.filter = "brightness(2.6)";
      if (z.kind === "boss" && this.act === 3) ctx.filter = z.flash > 0 ? "brightness(2.6) saturate(0.75)" : "saturate(0.8)";
      ctx.translate(z.x, z.y);
      ctx.scale(z.face, 1);
      this.blit(ctx, sheet, 2, 2, frame, 0, 0, size, 0);
      ctx.restore();
    }

    const p = this.player;
    const pFrame = Math.hypot(p.vx, p.vy) > 12 ? Math.floor(p.walk) % 4 : 0;
    this.shadow(ctx, p.x, p.y, 16);
    ctx.save();
    ctx.globalAlpha = p.invuln > 0 && Math.sin(p.invuln * 42) > 0 ? 0.45 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    this.blit(ctx, this.img.player, 2, 2, pFrame, 0, 0, 68, 0);
    const gun = GUNS[p.weapon];
    this.blit(ctx, this.img.weapons, 3, 1, gun.frame, 16, 2, gun.size, 0);
    if (p.muzzle > 0) {
      const mf = Math.min(3, Math.floor((1 - p.muzzle / 0.07) * 4));
      ctx.globalCompositeOperation = "lighter";
      this.blit(ctx, this.img.muzzle, 2, 2, mf, 16 + gun.size * 0.42, 2, 36, 0);
    }
    ctx.restore();

    for (const b of this.bullets) {
      if (!b.active) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = b.knock > 200 ? "#d6a15a" : "#f3ead7";
      ctx.fillRect(-9, -1.6, b.knock > 200 ? 11 : 14, 3.2);
      ctx.restore();
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.life * 1.6);
      ctx.fillStyle = "#f3ead7";
      ctx.font = "600 16px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  private drawCrates(ctx: CanvasRenderingContext2D, rect: Rect) {
    const s = 78;
    for (let y = rect.y; y < rect.y + rect.h - 8; y += s - 8) {
      for (let x = rect.x; x < rect.x + rect.w - 8; x += s - 8) {
        this.blit(ctx, this.img.crate, 1, 1, 0, x + s / 2, y + s / 2, s, 0);
      }
    }
  }

  private shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.save();
    ctx.translate(x, y + 8);
    ctx.scale(1, 0.42);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cols: number,
    rows: number,
    frame: number,
    x: number,
    y: number,
    size: number,
    rot: number,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (!img.complete || !img.naturalWidth) {
      ctx.fillStyle = "#a39888";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const fw = img.naturalWidth / cols;
    const fh = img.naturalHeight / rows;
    const c = ((frame % cols) + cols) % cols;
    const r = Math.floor(frame / cols) % rows;
    ctx.drawImage(img, c * fw, r * fh, fw, fh, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, cssW: number, cssH: number) {
    if (this.phase === "menu") return;
    const boss = this.zombies.find((z) => z.active && z.kind === "boss");
    ctx.save();
    ctx.fillStyle = "#f3ead7";
    ctx.font = "600 18px Newsreader, Georgia, serif";
    ctx.textAlign = "left";
    ctx.fillText(this.def.title, 20, 36);
    ctx.font = "500 14px Outfit, sans-serif";
    ctx.fillStyle = "#a39888";
    const wave =
      this.clearT > 0
        ? "Act clear"
        : boss
          ? boss && this.def.boss.name
          : this.waveIndex < 0
            ? "Get ready"
            : `Wave ${this.waveIndex + 1} / ${this.def.waves.length}`;
    ctx.fillText(wave, 20, 58);
    const hpW = 168;
    ctx.fillStyle = "#3a322b";
    ctx.fillRect(20, 70, hpW, 8);
    ctx.fillStyle = "#c45c3e";
    ctx.fillRect(20, 70, hpW * clamp(this.player.hp / this.player.maxHp, 0, 1), 8);
    if (boss) {
      ctx.fillStyle = "#f3ead7";
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.fillText(this.def.boss.name, 20, 98);
      ctx.fillStyle = "#3a322b";
      ctx.fillRect(20, 106, 220, 8);
      ctx.fillStyle = "#c45c3e";
      ctx.fillRect(20, 106, 220 * clamp(boss.hp / boss.maxHp, 0, 1), 8);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#f3ead7";
    ctx.font = "600 18px Outfit, sans-serif";
    ctx.fillText(String(this.score), cssW - 96, 36);

    if (this.bannerT > 0 && this.banner) {
      ctx.globalAlpha = Math.min(1, this.bannerT);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f3ead7";
      ctx.font = "600 34px Newsreader, Georgia, serif";
      ctx.fillText(this.banner, cssW / 2, cssH * 0.22);
    }
    if (this.player.hp < 32 && this.phase === "play") {
      ctx.globalAlpha = 0.18;
      const g = ctx.createRadialGradient(cssW / 2, cssH / 2, cssW * 0.2, cssW / 2, cssH / 2, cssW * 0.62);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "#c45c3e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    ctx.restore();
  }

  private snapshot(): Hud {
    const boss = this.zombies.find((z) => z.active && z.kind === "boss");
    const waveLabel =
      this.clearT > 0
        ? "Act clear"
        : boss
          ? this.def.boss.name
          : this.waveIndex < 0
            ? "Get ready"
            : `Wave ${this.waveIndex + 1} / ${this.def.waves.length}`;
    return {
      phase: this.phase,
      act: this.act,
      actTitle: this.def.title,
      waveLabel,
      score: this.score,
      best: this.best,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      weapon: this.player.weapon,
      shotgun: this.player.unlocked.shotgun,
      mg: this.player.unlocked.mg,
      bossName: boss ? this.def.boss.name : null,
      bossHp: boss ? boss.hp : 0,
      bossMax: boss ? boss.maxHp : 0,
      banner: this.bannerT > 0 ? this.banner : "",
      keyboard: this.keyboard,
    };
  }

  private emit(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastEmit < 140) return;
    this.lastEmit = now;
    this.onHud(this.snapshot());
  }

  private installProbe() {
    if (typeof window === "undefined") return;
    const qa = import.meta.env.DEV || new URLSearchParams(window.location.search).has("qa");
    if (!qa) return;
    window.__controlsTest = {
      getYaw: () => this.player.aim,
      getSpeed: () => Math.hypot(this.player.vx, this.player.vy),
      getX: () => this.player.x,
      getY: () => this.player.y,
      setKeys: (codes: string[]) => {
        this.qaKeys = true;
        this.keys = new Set(codes);
      },
      getInfo: () => ({
        banner: this.banner,
        wave: this.waveIndex,
        boss: this.bossUp,
        alive: this.zombies.filter((z) => z.active).length,
        score: this.score,
        weapon: this.player.weapon,
      }),
    };
  }

  private bind() {
    const down = (e: KeyboardEvent) => {
      this.qaKeys = false;
      this.keys.add(e.code);
      this.keyboard = true;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.code === "Escape") this.togglePause();
      if (e.code === "Digit1") this.setWeapon("pistol");
      if (e.code === "Digit2") this.setWeapon("shotgun");
      if (e.code === "Digit3") this.setWeapon("mg");
      if ((e.code === "Enter" || e.code === "Space") && (this.phase === "menu" || this.phase === "dead" || this.phase === "won")) {
        this.startRun();
      }
      this.emit(true);
    };
    const up = (e: KeyboardEvent) => {
      if (this.qaKeys) return;
      this.keys.delete(e.code);
    };
    const blur = () => {
      if (!this.qaKeys) this.keys.clear();
      this.mouseDown = false;
      this.pointers.clear();
    };
    const isUi = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("[data-ui]"));
    const pointerDown = (e: PointerEvent) => {
      if (isUi(e.target)) return;
      if (this.phase !== "play") return;
      if (e.pointerType === "touch") {
        const rect = this.canvas.getBoundingClientRect();
        const role: PointerHeld["role"] = e.clientX < rect.left + rect.width * 0.46 ? "move" : "aim";
        if ([...this.pointers.values()].some((p) => p.role === role)) return;
        this.pointers.set(e.pointerId, { role, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
        e.preventDefault();
      } else {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.hasMouseAim = true;
        this.mouseDown = true;
      }
    };
    const pointerMove = (e: PointerEvent) => {
      const held = this.pointers.get(e.pointerId);
      if (held) {
        held.x = e.clientX;
        held.y = e.clientY;
        return;
      }
      if (e.pointerType !== "touch") {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.hasMouseAim = true;
      }
    };
    const pointerUp = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (e.pointerType !== "touch") this.mouseDown = false;
    };
    const context = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    this.canvas.addEventListener("contextmenu", context);
    const vis = () => {
      if (document.hidden) blur();
      else unlockAudio();
    };
    document.addEventListener("visibilitychange", vis);
    this.cleanups.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      this.canvas.removeEventListener("contextmenu", context);
      document.removeEventListener("visibilitychange", vis);
      delete window.__controlsTest;
    });
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
      getInfo?: () => {
        banner: string;
        wave: number;
        boss: boolean;
        alive: number;
        score: number;
        weapon: string;
      };
    };
  }
}
