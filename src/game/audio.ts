let ac: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!ac) ac = new Ctx();
  if (ac.state === "suspended") void ac.resume();
}

function ctx(): AudioContext | null {
  return ac;
}

function burst(seconds: number, freq: number, gain: number, kind: "noise" | "tone") {
  const audio = ctx();
  if (!audio) return;
  const t = audio.currentTime;
  const g = audio.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  g.connect(audio.destination);

  if (kind === "tone") {
    const o = audio.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + seconds);
    o.connect(g);
    o.start(t);
    o.stop(t + seconds);
    return;
  }

  const n = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, n, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  src.connect(filter);
  filter.connect(g);
  src.start(t);
}

export const sfx = {
  pistol() {
    burst(0.07, 1800, 0.12, "noise");
  },
  shotgun() {
    burst(0.18, 520, 0.22, "noise");
    burst(0.12, 90, 0.08, "tone");
  },
  mg() {
    burst(0.045, 2200, 0.08, "noise");
  },
  hit() {
    burst(0.06, 400, 0.06, "noise");
  },
  kill() {
    burst(0.12, 240, 0.07, "tone");
  },
  hurt() {
    burst(0.16, 140, 0.1, "tone");
  },
  pickup() {
    burst(0.12, 520, 0.06, "tone");
    burst(0.14, 780, 0.05, "tone");
  },
  boss() {
    burst(0.4, 70, 0.12, "tone");
  },
  clear() {
    burst(0.18, 440, 0.06, "tone");
    burst(0.22, 660, 0.05, "tone");
  },
  dead() {
    burst(0.45, 80, 0.12, "tone");
  },
  win() {
    burst(0.2, 520, 0.07, "tone");
    burst(0.28, 690, 0.06, "tone");
  },
};
