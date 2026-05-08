“use client”;

import { useState, useEffect, useRef, useCallback } from “react”;

const SIZE = 320;
const STROKE = 72;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_MINUTES = 59;

function pad(n: number) { return String(n).padStart(2, “0”); }
function formatTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

function angleToMinutes(angle: number) {
let deg = (angle * 180) / Math.PI;
if (deg < 0) deg += 360;
return Math.max(1, Math.min(MAX_MINUTES, Math.round((deg / 360) * MAX_MINUTES)));
}

function arcPath(fraction: number) {
if (fraction <= 0) return “”;
const clamp = Math.min(fraction, 0.9999);
const angle = clamp * 2 * Math.PI;
const ex = CX + R * Math.sin(angle);
const ey = CY - R * Math.cos(angle);
return `M ${CX} ${CY - R} A ${R} ${R} 0 ${clamp > 0.5 ? 1 : 0} 1 ${ex} ${ey}`;
}

function getArcColor(fraction: number, finished: boolean) {
if (finished) return “#ef4444”;
if (fraction > 0.5) return “#ffffff”;
if (fraction > 0.2) return “#f59e0b”;
return “#ef4444”;
}

interface Props {
minutes: number;
auto: boolean;
}

export default function WorkshopTimer({ minutes: initialMinutes, auto }: Props) {
const [mode, setMode] = useState<“set” | “run”>(auto ? “run” : “set”);
const [setMins, setSetMins] = useState(initialMinutes);
const [total, setTotal] = useState(initialMinutes * 60);
const [remaining, setRemaining] = useState(initialMinutes * 60);
const [running, setRunning] = useState(auto);
const [finished, setFinished] = useState(false);

const containerRef = useRef<HTMLDivElement>(null);
const isDragging = useRef(false);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const playDone = useCallback(() => {
try {
const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
[523, 659, 784].forEach((freq, i) => {
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain); gain.connect(ctx.destination);
osc.type = “sine”; osc.frequency.value = freq;
const t = ctx.currentTime + i * 0.2;
gain.gain.setValueAtTime(0, t);
gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
osc.start(t); osc.stop(t + 0.6);
});
} catch (e) {}
}, []);

useEffect(() => {
if (running) {
intervalRef.current = setInterval(() => {
setRemaining(r => {
if (r <= 1) {
clearInterval(intervalRef.current!);
setRunning(false); setFinished(true); playDone();
return 0;
}
return r - 1;
});
}, 1000);
} else {
if (intervalRef.current) clearInterval(intervalRef.current);
}
return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
}, [running, playDone]);

function getAngle(e: PointerEvent | TouchEvent | React.PointerEvent | React.TouchEvent) {
const el = containerRef.current;
if (!el) return 0;
const rect = el.getBoundingClientRect();
const clientX = “touches” in e ? e.touches[0].clientX : (e as PointerEvent).clientX;
const clientY = “touches” in e ? e.touches[0].clientY : (e as PointerEvent).clientY;
return Math.atan2(clientX - (rect.left + rect.width / 2), -(clientY - (rect.top + rect.height / 2)));
}

function isOnRing(e: PointerEvent | TouchEvent | React.PointerEvent | React.TouchEvent) {
const el = containerRef.current;
if (!el) return false;
const rect = el.getBoundingClientRect();
const scale = rect.width / SIZE;
const clientX = “touches” in e ? e.touches[0].clientX : (e as PointerEvent).clientX;
const clientY = “touches” in e ? e.touches[0].clientY : (e as PointerEvent).clientY;
const dist = Math.sqrt((clientX - (rect.left + rect.width / 2)) ** 2 + (clientY - (rect.top + rect.height / 2)) ** 2);
return dist >= (R - STROKE / 2) * scale && dist <= (R + STROKE / 2) * scale;
}

function onDown(e: React.PointerEvent | React.TouchEvent) {
if (mode !== “set” || !isOnRing(e)) return;
isDragging.current = true;
setSetMins(angleToMinutes(getAngle(e)));
e.preventDefault();
}
function onMove(e: PointerEvent | TouchEvent) {
if (!isDragging.current) return;
setSetMins(angleToMinutes(getAngle(e)));
e.preventDefault();
}
function onUp() { isDragging.current = false; }

useEffect(() => {
window.addEventListener(“pointermove”, onMove);
window.addEventListener(“pointerup”, onUp);
window.addEventListener(“touchmove”, onMove, { passive: false });
window.addEventListener(“touchend”, onUp);
return () => {
window.removeEventListener(“pointermove”, onMove);
window.removeEventListener(“pointerup”, onUp);
window.removeEventListener(“touchmove”, onMove);
window.removeEventListener(“touchend”, onUp);
};
});

function startTimer() {
const secs = setMins * 60;
setTotal(secs); setRemaining(secs);
setFinished(false); setMode(“run”); setRunning(true);
}
function togglePause() { if (!finished) setRunning(r => !r); }
function backToSet() {
if (intervalRef.current) clearInterval(intervalRef.current);
setRunning(false); setFinished(false); setMode(“set”);
}

const setFraction = setMins / MAX_MINUTES;
const runFraction = total > 0 ? remaining / total : 0;
const fraction = mode === “set” ? setFraction : runFraction;
const color = mode === “set” ? “#ffffff” : getArcColor(runFraction, finished);
const urgentPulse = mode === “run” && runFraction <= 0.1 && runFraction > 0 && running;

const hx = CX + R * Math.sin(setFraction * 2 * Math.PI);
const hy = CY - R * Math.cos(setFraction * 2 * Math.PI);

return (
<div style={{
minHeight: “100vh”, background: “#0e0e0e”,
display: “flex”, flexDirection: “column”,
alignItems: “center”, justifyContent: “center”,
fontFamily: “‘DM Mono’, monospace”,
userSelect: “none”, WebkitUserSelect: “none”,
}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400&display=swap'); @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.02)} } @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} } .btn { background:transparent; border:1px solid #2a2a2a; color:#555; border-radius:4px; padding:9px 24px; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; cursor:pointer; font-family:inherit; transition:all 0.15s; } .btn:hover { border-color:#555; color:#aaa; } .btn.primary { background:#fff; border-color:#fff; color:#0e0e0e; } .btn.primary:hover { background:#ddd; border-color:#ddd; }`}</style>

```
  <div style={{ fontSize:"10px", letterSpacing:"0.35em", color:"#252525",
    textTransform:"uppercase", marginBottom:"48px" }}>
    Workshop Timer
  </div>

  <div ref={containerRef}
    style={{
      position:"relative", width:SIZE, height:SIZE,
      animation: urgentPulse ? "pulse 1s ease-in-out infinite" : "none",
      cursor: mode === "set" ? "crosshair" : "default",
    }}
    onPointerDown={onDown}
    onTouchStart={onDown}
  >
    <svg width={SIZE} height={SIZE} style={{ display:"block", pointerEvents:"none" }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2d2d2d" strokeWidth={STROKE} />
      {fraction > 0 && (
        <path d={arcPath(fraction)} fill="none" stroke={color} strokeWidth={STROKE}
          strokeLinecap="butt" opacity={finished ? 0.3 : 1}
          style={{ transition: mode === "run" ? "stroke 0.8s ease" : "none" }} />
      )}
      <circle cx={CX} cy={CY} r={R - STROKE / 2 - 1} fill="#0e0e0e" />
      {mode === "set" && (
        <circle cx={hx} cy={hy} r={10} fill="#0e0e0e" stroke="#fff" strokeWidth={2.5} />
      )}
      <rect x={CX - 1.5} y={CY - R - STROKE/2 - 1} width={3} height={STROKE + 2} fill="#0e0e0e" />
    </svg>

    <div onClick={mode === "set" ? startTimer : togglePause}
      style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:"10px", cursor:"pointer" }}>
      <div style={{ fontSize:"54px", fontWeight:300, lineHeight:1,
        color: finished ? "#ef4444" : "#e0e0e0",
        letterSpacing:"-0.02em", fontVariantNumeric:"tabular-nums", transition:"color 0.4s" }}>
        {mode === "set" ? `${pad(setMins)}:00` : formatTime(remaining)}
      </div>
      <div style={{ fontSize:"10px", letterSpacing:"0.2em", color:"#2e2e2e",
        textTransform:"uppercase", animation:"fadeIn 0.3s ease" }}>
        {mode === "set" ? "trykk for start"
          : finished ? "—"
          : running ? "trykk for pause" : "pauset"}
      </div>
    </div>
  </div>

  <div style={{ marginTop:"40px", display:"flex", gap:"12px", alignItems:"center" }}>
    {mode === "set" ? (
      <button className="btn primary" onClick={startTimer}>Start</button>
    ) : (
      <>
        <button className="btn" onClick={backToSet}>← Endre tid</button>
        {!finished && (
          <button className="btn primary" onClick={togglePause}>
            {running ? "Pause" : "Fortsett"}
          </button>
        )}
        {finished && (
          <button className="btn primary" onClick={backToSet}>Ny runde</button>
        )}
      </>
    )}
  </div>

  <div style={{ marginTop:"24px", fontSize:"10px", letterSpacing:"0.25em",
    color:"#1e1e1e", textTransform:"uppercase" }}>
    {mode === "set" ? `dra ringen · 1–${MAX_MINUTES} min` : finished ? "tid ute" : ""}
  </div>
</div>
```

);
}
