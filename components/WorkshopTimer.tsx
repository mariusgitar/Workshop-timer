'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Mode = 'set' | 'run';

type WorkshopTimerProps = {
  initialMinutes?: number;
  autoStart?: boolean;
};

const MAX_MIN = 59;
const R = 116;
const CX = 150;
const CY = 150;
const SIZE = 300;

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

const arcPath = (frac: number) => {
  if (frac <= 0) return '';
  const f = Math.min(frac, 0.9999);
  const a = f * 2 * Math.PI;
  const ex = CX + R * Math.sin(a);
  const ey = CY - R * Math.cos(a);
  return `M ${CX} ${CY - R} A ${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 ${ex} ${ey}`;
};

const arcColor = (frac: number, fin: boolean) => {
  if (fin) return '#dc2626';
  if (frac > 0.5) return '#FFFFFF';
  if (frac > 0.2) return '#d97706';
  return '#dc2626';
};

const angleToMins = (angle: number) => {
  let deg = (angle * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.max(1, Math.min(MAX_MIN, Math.round((deg / 360) * MAX_MIN)));
};

export default function WorkshopTimer({ initialMinutes = 5, autoStart = false }: WorkshopTimerProps) {
  const seededMinutes = Math.max(1, Math.min(MAX_MIN, Math.floor(initialMinutes)));
  const [mode, setMode] = useState<Mode>(autoStart ? 'run' : 'set');
  const [setMins, setSetMins] = useState(seededMinutes);
  const [total, setTotal] = useState(seededMinutes * 60);
  const [remaining, setRemaining] = useState(seededMinutes * 60);
  const [running, setRunning] = useState(autoStart);
  const [finished, setFinished] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  const ringRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef<number | null>(null);

  const stopTick = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const playDone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t);
        osc.stop(t + 0.6);
      });
    } catch {
      // Ignore audio failures.
    }
  }, []);

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (!running || !endsAtRef.current) return prev;
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      if (left <= 0) {
        stopTick();
        setRunning(false);
        setFinished(true);
        playDone();
        return 0;
      }
      return left;
    });
  }, [playDone, running, stopTick]);

  const startTick = useCallback(
    (seconds: number) => {
      stopTick();
      endsAtRef.current = Date.now() + seconds * 1000;
      tickerRef.current = setInterval(tick, 1000);
    },
    [stopTick, tick]
  );

  useEffect(() => {
    if (autoStart) startTick(seededMinutes * 60);
    return () => stopTick();
  }, [autoStart, seededMinutes, startTick, stopTick]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && running && endsAtRef.current) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [running, tick]);

  const getAngle = useCallback((e: PointerEvent | TouchEvent | React.PointerEvent | React.TouchEvent) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as PointerEvent).clientX;
    const clientY = touch ? touch.clientY : (e as PointerEvent).clientY;
    return Math.atan2(clientX - cx, -(clientY - cy));
  }, []);

  const isOnRing = useCallback((e: PointerEvent | TouchEvent | React.PointerEvent | React.TouchEvent) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const scale = rect.width / SIZE;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as PointerEvent).clientX;
    const clientY = touch ? touch.clientY : (e as PointerEvent).clientY;
    const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
    return dist >= (R - 34) * scale && dist <= (R + 34) * scale;
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      setSetMins(angleToMins(getAngle(e)));
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      setSetMins(angleToMins(getAngle(e)));
      e.preventDefault();
    };
    const stopDrag = () => setDragging(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('touchend', stopDrag);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [dragging, getAngle]);

  const startTimer = () => {
    const seconds = setMins * 60;
    setTotal(seconds);
    setRemaining(seconds);
    setFinished(false);
    setMode('run');
    setRunning(true);
    startTick(seconds);
  };

  const togglePause = () => {
    if (finished) return;

    if (running) {
      setRunning(false);
      stopTick();
      return;
    }

    setRunning(true);
    startTick(remaining);
  };

  const backToSet = () => {
    stopTick();
    setRunning(false);
    setFinished(false);
    setMode('set');
  };



  useEffect(() => {
    if (!running || !roomId) return;

    const sync = () => {
      void fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, remaining, total, running, finished })
      });
    };

    sync();
    const interval = setInterval(sync, 1000);
    return () => clearInterval(interval);
  }, [finished, remaining, roomId, running, total]);

  const shareUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  const createRoomId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setRoomId(id);
  };

  const frac = useMemo(() => (mode === 'set' ? setMins / MAX_MIN : total > 0 ? remaining / total : 0), [mode, remaining, setMins, total]);
  const urgent = mode === 'run' && frac <= 0.1 && frac > 0 && running;

  return (
    <>
      <div className="eyebrow">Workshop timer</div>
      <div
        id="ring-wrap"
        ref={ringRef}
        style={{ animation: urgent ? 'pulse 1s ease-in-out infinite' : '', cursor: mode === 'set' ? 'crosshair' : 'default' }}
        onPointerDown={(e) => {
          if (mode !== 'set' || !isOnRing(e)) return;
          setDragging(true);
          setSetMins(angleToMins(getAngle(e)));
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          if (mode !== 'set' || !isOnRing(e)) return;
          setDragging(true);
          setSetMins(angleToMins(getAngle(e)));
          e.preventDefault();
        }}
      >
        <svg id="svg" width="300" height="300">
          <circle cx="150" cy="150" r="116" fill="none" stroke="#1E1E1E" strokeWidth="68" />
          <path id="arc" fill="none" strokeWidth="68" strokeLinecap="butt" d={arcPath(frac)} stroke={mode === 'set' ? '#FFFFFF' : arcColor(frac, finished)} opacity={finished ? '0.25' : '1'} />
          <circle cx="150" cy="150" r="92" fill="#111111" />
          {mode === 'set' && <circle id="handle" cx={CX + R * Math.sin((setMins / MAX_MIN) * 2 * Math.PI)} cy={CY - R * Math.cos((setMins / MAX_MIN) * 2 * Math.PI)} r="9" fill="#111111" stroke="#FFFFFF" strokeWidth="2.5" />}
          <rect x="148.5" y="-1" width="3" height="69" fill="#111111" />
        </svg>

        <div id="center" onClick={() => (mode === 'set' ? startTimer() : togglePause())}>
          <div id="time-display" style={{ color: finished ? '#dc2626' : '#FFFFFF', animation: finished ? 'flash 1s ease-in-out infinite' : '' }}>
            {mode === 'set' ? `${pad(setMins)}:00` : fmt(remaining)}
          </div>
          <div
            id="hint-pill"
            style={
              mode === 'set'
                ? { background: '#1E1E1E', borderColor: '#2A2A2A', color: '#555555' }
                : finished
                  ? { background: '#2A0A0A', borderColor: '#5A1A1A', color: '#dc2626' }
                  : running
                    ? { background: '#1E1E1E', borderColor: '#2A2A2A', color: '#555555' }
                    : { background: '#1E2A1E', borderColor: '#2A4A2A', color: '#15803d' }
            }
          >
            {mode === 'set' ? 'Dra for å stille' : finished ? 'Tid ute' : running ? 'Trykk for pause' : 'Pauset'}
          </div>
        </div>
      </div>

      <div id="controls">
        {mode === 'set' ? (
          <button className="btn primary" onClick={startTimer}>Start</button>
        ) : finished ? (
          <button className="btn primary" onClick={backToSet}>Ny runde</button>
        ) : (
          <>
            <button className="btn ghost" onClick={backToSet}>← Endre tid</button>
            <button className="btn ghost" onClick={createRoomId}>Del timer</button>
            <button className="btn primary" onClick={togglePause}>{running ? 'Pause' : 'Fortsett'}</button>
          </>
        )}
      </div>

      {mode === 'run' && roomId && (
        <div id="share-box">
          <div>Rom: <strong>{roomId}</strong></div>
          {shareUrl && <QRCodeSVG value={shareUrl} size={140} bgColor="#111111" fgColor="#FFFFFF" />}
        </div>
      )}

      <div id="footer">{mode === 'set' ? '1 – 59 min' : ''}</div>

      <style jsx>{`
        .eyebrow { font-size: 22px; font-weight: 700; letter-spacing: 0em; text-transform: none; color: #FFFFFF; margin-bottom: 48px; }
        #ring-wrap { position: relative; width: 300px; height: 300px; }
        #ring-wrap svg { display: block; pointer-events: none; }
        #center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        #time-display { font-size: 58px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; transition: color 0.4s; }
        #hint-pill { display: inline-flex; align-items: center; background: #1E1E1E; border: 1px solid #2A2A2A; border-radius: 100px; padding: 5px 14px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; transition: all 0.2s; }
        #controls { margin-top: 36px; display: flex; gap: 10px; align-items: center; }
        .btn { border-radius: 100px; padding: 10px 26px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.15s; border: none; letter-spacing: 0.01em; }
        .btn.primary { background: #FFFFFF; color: #111111; }
        .btn.primary:hover { background: #E8E8E8; }
        .btn.ghost { background: transparent; color: #555555; border: 1px solid #2A2A2A; }
        .btn.ghost:hover { border-color: #555555; color: #AAAAAA; }
        #share-box { margin-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #AAAAAA; font-size: 13px; }
        #footer { margin-top: 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; color: #2A2A2A; text-transform: uppercase; }
      `}</style>
    </>
  );
}
