import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Pause } from "lucide-react";
import { unlockAudio } from "@/game/audio";
import { Engine, type Hud, type Phase } from "@/game/engine";

const INITIAL: Hud = {
  phase: "menu",
  act: 1,
  actTitle: "Act I — The Lot",
  waveLabel: "",
  score: 0,
  best: 0,
  hp: 100,
  maxHp: 100,
  weapon: "pistol",
  shotgun: false,
  mg: false,
  bossName: null,
  bossHp: 0,
  bossMax: 0,
  banner: "",
  keyboard: false,
};

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const knobL = useRef<HTMLDivElement>(null);
  const knobR = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>(INITIAL);
  const [bestSeen, setBestSeen] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setBestSeen(Number(localStorage.getItem("ashline-best") || "0") || 0);
    } catch {
      setBestSeen(0);
    }
    const engine = new Engine(canvas, {
      onHud: setHud,
      onSticks: (left, right) => {
        if (knobL.current) knobL.current.style.transform = `translate(${left.x}px, ${left.y}px)`;
        if (knobR.current) knobR.current.style.transform = `translate(${right.x}px, ${right.y}px)`;
      },
    });
    engineRef.current = engine;
    rootRef.current?.focus();
    return engine.start();
  }, []);

  const phase: Phase = hud.phase;
  const playing = phase === "play" || phase === "pause";

  const begin = () => {
    unlockAudio();
    rootRef.current?.focus();
    engineRef.current?.startRun();
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="game-root relative h-dvh w-full overflow-hidden bg-bg text-fg outline-none"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => rootRef.current?.focus()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {playing ? (
        <>
          <button
            type="button"
            data-ui
            className="pause-btn flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-fg"
            aria-label={phase === "pause" ? "Resume" : "Pause"}
            onClick={() => engineRef.current?.togglePause()}
          >
            <Pause className="size-5" />
          </button>
          {hud.keyboard ? (
            <div className="hud-chip flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm text-fg">
              <Keyboard className="size-4 text-muted" />
              Keyboard
            </div>
          ) : null}
          <div className="stick stick-left" aria-hidden>
            <p className="stick-label">Move</p>
            <div className="stick-base">
              <div ref={knobL} className="stick-knob" />
            </div>
          </div>
          <div className="stick stick-right" aria-hidden>
            <p className="stick-label">Aim</p>
            <div className="stick-base">
              <div ref={knobR} className="stick-knob" />
            </div>
          </div>
          <div className="weapon-bar" data-ui>
            <WeaponButton
              label="Pistol"
              hotkey="1"
              active={hud.weapon === "pistol"}
              onClick={() => engineRef.current?.setWeapon("pistol")}
            />
            {hud.shotgun ? (
              <WeaponButton
                label="Shotgun"
                hotkey="2"
                active={hud.weapon === "shotgun"}
                onClick={() => engineRef.current?.setWeapon("shotgun")}
              />
            ) : null}
            {hud.mg ? (
              <WeaponButton
                label="Machine gun"
                hotkey="3"
                active={hud.weapon === "mg"}
                onClick={() => engineRef.current?.setWeapon("mg")}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {phase === "menu" ? (
        <Overlay>
          <p className="text-sm tracking-widest text-accent">THREE ACTS</p>
          <h1 className="mt-2 font-display text-5xl leading-none text-fg">ASHLINE</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Night shift at a hospital that will not stay down. You start with a pistol. The yard hides a shotgun.
            The ward hides a machine gun.
          </p>
          <ol className="mt-4 space-y-1 text-sm text-muted">
            <li>I — The Lot</li>
            <li>II — The Ward</li>
            <li>III — The Morgue</li>
          </ol>
          <button type="button" data-ui className="mt-6 h-12 w-full rounded-lg bg-accent text-base font-medium text-fg" onClick={begin}>
            Start
          </button>
          <div className="mt-5 space-y-2 text-sm leading-relaxed text-muted">
            <p>Move with the left stick, or WASD and the arrow keys.</p>
            <p>Aim and fire with the right side of the screen, the mouse, or by holding Space.</p>
            <p>A hardware keyboard works together with the sticks. Keys 1, 2, and 3 swap weapons you have found.</p>
          </div>
          {bestSeen ? <p className="mt-4 text-sm text-fg">Best {bestSeen}</p> : null}
        </Overlay>
      ) : null}

      {phase === "pause" ? (
        <Overlay>
          <h2 className="font-display text-4xl text-fg">Paused</h2>
          <p className="mt-3 text-sm text-muted">{hud.actTitle}</p>
          <button type="button" data-ui className="mt-6 h-12 w-full rounded-lg bg-accent font-medium text-fg" onClick={() => engineRef.current?.togglePause()}>
            Resume
          </button>
        </Overlay>
      ) : null}

      {phase === "dead" || phase === "won" ? (
        <Overlay>
          <p className="text-sm tracking-widest text-accent">{phase === "won" ? "SHIFT OVER" : hud.actTitle}</p>
          <h2 className="mt-2 font-display text-4xl text-fg">{phase === "won" ? "The ward holds." : "You went down."}</h2>
          <p className="mt-4 text-base text-muted">
            {phase === "won"
              ? "Three bosses. The lot, the ward, and the morgue are still."
              : "Some of them lose their heads. You lost the rest."}
          </p>
          <p className="mt-4 text-fg">
            Score {hud.score}
            {hud.best ? ` · Best ${hud.best}` : ""}
          </p>
          <button type="button" data-ui className="mt-6 h-12 w-full rounded-lg bg-accent font-medium text-fg" onClick={begin}>
            Start
          </button>
          <button
            type="button"
            data-ui
            className="mt-3 h-12 w-full rounded-lg border border-line bg-bg font-medium text-fg"
            onClick={() => engineRef.current?.toMenu()}
          >
            Title
          </button>
        </Overlay>
      ) : null}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
      <div data-ui className="panel pointer-events-auto w-full max-w-md rounded-xl border border-line bg-surface px-6 py-7">
        {children}
      </div>
    </div>
  );
}

function WeaponButton({
  label,
  hotkey,
  active,
  onClick,
}: {
  label: string;
  hotkey: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-ui
      onClick={onClick}
      className={
        active
          ? "h-11 rounded-lg border border-accent bg-accent px-3 text-sm font-medium text-fg"
          : "h-11 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg"
      }
    >
      {hotkey} {label}
    </button>
  );
}
