'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Mode = 'set' | 'run';

type WorkshopTimerProps = {
  initialMinutes?: number;
  autoStart?: boolean;
};

const R = 116;
const CX = 150;
const CY = 150;
const SIZE = 300;

const STORAGE_KEY = 'workshop-timer-state';

const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

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


export default function WorkshopTimer({ initialMinutes = 5, autoStart = false }: WorkshopTimerProps) {
  const seededMinutes = Math.max(1, Math.min(59, Math.floor(initialMinutes)));
  const [mode, setMode] = useState<Mode>(autoStart ? 'run' : 'set');
  const [scale, setScale] = useState<'short' | 'standard' | 'long'>('standard');
  const [setMins, setSetMins] = useState(seededMinutes);
  const [total, setTotal] = useState(seededMinutes * 60);
  const [remaining, setRemaining] = useState(seededMinutes * 60);
  const [running, setRunning] = useState(autoStart);
  const [finished, setFinished] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [hydrated, setHydrated] = useState(false);


  const getMaxMin = useCallback(() => (scale === 'short' ? 30 : scale === 'long' ? 240 : 59), [scale]);
  const getSnapMin = useCallback(() => (scale === 'short' ? 0.5 : scale === 'long' ? 5 : 1), [scale]);

  const angleToMins = useCallback((angle: number) => {
    let deg = (angle * 180) / Math.PI;
    if (deg < 0) deg += 360;
    const maxMin = getMaxMin();
    const snapMin = getSnapMin();
    const raw = (deg / 360) * maxMin;
    const snapped = Math.round(raw / snapMin) * snapMin;
    return Math.max(1, Math.min(maxMin, snapped));
  }, [getMaxMin, getSnapMin]);

  const ringRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef<number | null>(null);
  const runningRef = useRef(running);
  const remainingRef = useRef(remaining);

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
    if (!runningRef.current || !endsAtRef.current) return;
    const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) {
      stopTick();
      setRunning(false);
      setFinished(true);
      playDone();
    }
  }, [playDone, stopTick]);

  const startTick = useCallback(
    (seconds: number) => {
      stopTick();
      endsAtRef.current = Date.now() + seconds * 1000;
      tickerRef.current = setInterval(tick, 1000);
    },
    [stopTick]
  );

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        roomId?: string | null;
        remaining?: number;
        total?: number;
        running?: boolean;
        finished?: boolean;
        endsAt?: number | null;
      };

      const nextTotal = typeof parsed.total === 'number' ? Math.max(0, Math.floor(parsed.total)) : seededMinutes * 60;
      const nextRemaining = typeof parsed.remaining === 'number' ? Math.max(0, Math.floor(parsed.remaining)) : nextTotal;
      const nextRunning = Boolean(parsed.running);
      const nextFinished = Boolean(parsed.finished);

      if (typeof parsed.roomId === 'string' && parsed.roomId) setRoomId(parsed.roomId);
      setTotal(nextTotal);
      setRemaining(nextRemaining);
      setFinished(nextFinished);

      const now = Date.now();
      if (nextRunning && typeof parsed.endsAt === 'number' && parsed.endsAt > now) {
        setMode('run');
        setRunning(true);
        const resumed = Math.max(0, Math.ceil((parsed.endsAt - now) / 1000));
        setRemaining(resumed);
        startTick(resumed);
      } else {
        setRunning(false);
        if (nextTotal > 0) setMode('run');
      }
    } catch {
      // Ignore invalid persisted state.
    } finally {
      setHydrated(true);
    }

    return () => stopTick();
  }, [seededMinutes, startTick, stopTick]);

  useEffect(() => {
    if (!hydrated || !autoStart || running || total > 0 && mode === 'run') return;
    const seconds = seededMinutes * 60;
    setTotal(seconds);
    setRemaining(seconds);
    setMode('run');
    setRunning(true);
    startTick(seconds);
  }, [autoStart, hydrated, mode, running, seededMinutes, startTick, total]);

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
    const id = roomId ?? generateRoomId();
    const seconds = setMins * 60;
    setRoomId(id);
    setShowQR(false);
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
    setShowQR(false);
    setMode('set');

    if (roomId) {
      void fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, remaining: 0, total: 0, running: false, finished: false })
      });
    }
  };

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const payload = {
      roomId,
      remaining,
      total,
      running,
      finished,
      endsAt: endsAtRef.current
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [finished, hydrated, remaining, roomId, running, total]);



  // Immediate push on start, pause, resume, finish, or new timer total
  useEffect(() => {
    if (!roomId) return;
    void fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, remaining: remainingRef.current, total, running, finished })
    });
  }, [roomId, running, finished, total]);

  // Periodic push every second while running to keep remaining in sync
  useEffect(() => {
    if (!roomId || !running) return;
    const id = setInterval(() => {
      void fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, remaining: remainingRef.current, total, running: true, finished: false })
      });
    }, 1000);
    return () => clearInterval(id);
  }, [roomId, running, total]);

  const shareUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  const frac = useMemo(() => (mode === 'set' ? setMins / getMaxMin() : total > 0 ? remaining / total : 0), [getMaxMin, mode, remaining, setMins, total]);
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
          {mode === 'set' && <circle id="handle" cx={CX + R * Math.sin((setMins / getMaxMin()) * 2 * Math.PI)} cy={CY - R * Math.cos((setMins / getMaxMin()) * 2 * Math.PI)} r="9" fill="#111111" stroke="#FFFFFF" strokeWidth="2.5" />}
          <rect x="148.5" y="-1" width="3" height="69" fill="#111111" />
        </svg>

        <div id="center" onClick={() => (mode === 'set' ? startTimer() : togglePause())}>
          <div id="time-display" style={{ color: finished ? '#dc2626' : '#FFFFFF', animation: finished ? 'flash 1s ease-in-out infinite' : '' }}>
            {mode === 'set' ? fmt(Math.round(setMins * 60)) : fmt(remaining)}
          </div>
          <div id="hint-text">{mode === 'set' ? 'Trykk for start' : running ? 'Trykk for pause' : 'Trykk for start'}</div>
        </div>
      </div>

      {mode === 'set' && (
        <>
          <div id="drag-hint">Dra ringen for å stille tid</div>
          <div id="scale-picker">
            <button className={`scale-btn ${scale === 'short' ? 'active' : ''}`} onClick={() => { setScale('short'); setSetMins(1); }}>30m</button>
            <button className={`scale-btn ${scale === 'standard' ? 'active' : ''}`} onClick={() => { setScale('standard'); setSetMins(1); }}>1t</button>
            <button className={`scale-btn ${scale === 'long' ? 'active' : ''}`} onClick={() => { setScale('long'); setSetMins(5); }}>4t</button>
          </div>
        </>
      )}

      <div id="controls">
        {mode !== 'set' && <button className="btn ghost" onClick={backToSet}>← Endre tid</button>}
        <button className="btn ghost" onClick={() => setShowQR((prev) => !prev)}>{showQR ? 'Skjul QR' : 'Vis QR'}</button>
      </div>


      {roomId && (
        <div id="room-meta">
          <span className="room-label">Rom: </span>
          <span className="room-id">{roomId}</span>
        </div>
      )}

      {roomId && showQR && (
        <div id="share-box">
          {shareUrl && <QRCodeSVG value={shareUrl} size={140} bgColor="#111111" fgColor="#FFFFFF" />}
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#888888', fontSize: '12px', wordBreak: 'break-all', textAlign: 'center' }}
            >
              {shareUrl}
            </a>
          )}
        </div>
      )}

      <button
        id="new-room-link"
        onClick={() => {
          if (!window.confirm('Opprette nytt rom? Dette nullstiller aktiv timer.')) return;
          stopTick();
          window.sessionStorage.removeItem(STORAGE_KEY);
          const id = generateRoomId();
          setRoomId(id);
          setMode('set');
          setRunning(false);
          setFinished(false);
          setShowQR(false);
          setTotal(0);
          setRemaining(0);
          endsAtRef.current = null;
        }}
      >
        Nytt rom
      </button>

      <button
        id="crazy-eights-link"
        onClick={() => {
          window.location.href = '/crazy-eights';
        }}
      >
        Prøv Crazy Eights →
      </button>

      <style jsx>{`
        .eyebrow { font-size: 22px; font-weight: 700; letter-spacing: 0em; text-transform: none; color: #FFFFFF; margin-bottom: 48px; }
        #ring-wrap { position: relative; width: 300px; height: 300px; }
        #ring-wrap svg { display: block; pointer-events: none; }
        #center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        #time-display { font-size: 58px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; transition: color 0.4s; }
        #hint-text { font-size: 11px; font-weight: 600; color: #555555; letter-spacing: 0.02em; }
        #drag-hint { margin-top: 8px; font-size: 11px; color: #2e2e2e; }
        #scale-picker { margin-top: 8px; display: flex; gap: 6px; }
        .scale-btn { background: transparent; color: #333333; border: 1px solid #333333; border-radius: 100px; padding: 5px 12px; font-size: 11px; cursor: pointer; font-family: inherit; }
        .scale-btn.active { background: #333333; color: #ffffff; }
        #controls { margin-top: 20px; display: flex; gap: 10px; align-items: center; justify-content: center; }
        .btn { border-radius: 100px; padding: 8px 0; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.15s; border: none; background: transparent; color: #555555; letter-spacing: 0.01em; }
        .btn.ghost { border: 1px solid #2A2A2A; border-radius: 100px; padding: 9px 18px; font-size: 12px; font-weight: 600; color: #666666; background: transparent; cursor: pointer; font-family: inherit; }
        .btn.ghost:hover { color: #AAAAAA; }
        #room-meta { margin-top: 12px; display: flex; gap: 0; align-items: center; font-size: 12px; }
        .room-label { color: #333333; }
        .room-id { color: #555555; font-weight: 600; }
        #share-box { margin-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #AAAAAA; font-size: 13px; }
        #new-room-link { margin-top: 22px; font-size: 11px; color: #2a2a2a; text-decoration: underline; background: transparent; border: none; padding: 0; cursor: pointer; }
        #crazy-eights-link { margin-top: 8px; font-size: 11px; color: #2a2a2a; text-decoration: underline; background: transparent; border: none; padding: 0; cursor: pointer; }
      `}</style>
    </>
  );
}
