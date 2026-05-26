'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const TOTAL_ROUNDS = 8;
const ROUND_SECONDS = 60;
const PAUSE_SECONDS = 3;

const R = 116;
const CX = 150;
const CY = 150;
const SIZE = 300;

const STORAGE_KEY = 'crazy-eights-state';

type Phase = 'idle' | 'running' | 'pause' | 'finished';

type PersistedState = {
  roomId?: string | null;
  round?: number;
  remaining?: number;
  total?: number;
  running?: boolean;
  finished?: boolean;
  phase?: Phase;
  pauseRemaining?: number;
  endsAt?: number | null;
};

type PushPayload = {
  roomId: string;
  mode: 'crazy-eights';
  round: number;
  remaining: number;
  total: number;
  running: boolean;
  finished: boolean;
  endsAt: number | null;
};

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

type CrazyEightsTimerProps = {
  initialRoomId?: string | null;
};

export default function CrazyEightsTimer({ initialRoomId = null }: CrazyEightsTimerProps) {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);
  const [showQR, setShowQR] = useState(false);
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(ROUND_SECONDS);
  const [total] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [flash, setFlash] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (initialRoomId) setShowQR(true);
  }, [initialRoomId]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef<number | null>(null);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const playFlashSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [880, 1174].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch {
      // Ignore audio failures.
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

  const startRound = useCallback((nextRound: number) => {
    setRound(nextRound);
    setPhase('running');
    setRunning(true);
    setFinished(false);
    setPauseRemaining(0);
    setRemaining(ROUND_SECONDS);
    endsAtRef.current = Date.now() + ROUND_SECONDS * 1000;
  }, []);

  const startPause = useCallback(() => {
    setPhase('pause');
    setRunning(false);
    setPauseRemaining(PAUSE_SECONDS);
    endsAtRef.current = Date.now() + PAUSE_SECONDS * 1000;
    setFlash(true);
    playFlashSound();
    window.setTimeout(() => setFlash(false), 850);
  }, [playFlashSound]);

  const resetAll = useCallback(() => {
    if (!window.confirm('Er du sikker på at du vil nullstille økten?')) return;
    stopTick();
    endsAtRef.current = null;
    setRound(1);
    setRemaining(ROUND_SECONDS);
    setPhase('idle');
    setRunning(false);
    setFinished(false);
    setPauseRemaining(0);
  }, [stopTick]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (typeof parsed.roomId === 'string' && parsed.roomId) setRoomId(parsed.roomId);
      setRound(typeof parsed.round === 'number' ? Math.max(1, Math.min(TOTAL_ROUNDS, Math.floor(parsed.round))) : 1);
      setRemaining(typeof parsed.remaining === 'number' ? Math.max(0, Math.floor(parsed.remaining)) : ROUND_SECONDS);
      setPauseRemaining(typeof parsed.pauseRemaining === 'number' ? Math.max(0, Math.floor(parsed.pauseRemaining)) : 0);
      setPhase(parsed.phase ?? 'idle');
      setRunning(Boolean(parsed.running));
      setFinished(Boolean(parsed.finished));

      const now = Date.now();
      if (parsed.running && typeof parsed.endsAt === 'number' && parsed.endsAt > now) {
        endsAtRef.current = parsed.endsAt;
      } else {
        endsAtRef.current = null;
        if ((parsed.phase ?? 'idle') === 'running') setRunning(false);
      }
    } catch {
      // Ignore invalid persisted state.
    } finally {
      setHydrated(true);
    }

    return () => stopTick();
  }, [stopTick]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      roomId,
      round,
      remaining,
      total,
      running,
      finished,
      phase,
      pauseRemaining,
      endsAt: endsAtRef.current
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, roomId, round, remaining, total, running, finished, phase, pauseRemaining]);

  useEffect(() => {
    stopTick();

    if (phase === 'running') {
      if (!endsAtRef.current) endsAtRef.current = Date.now() + remaining * 1000;
      const tick = () => {
        if (!endsAtRef.current) return;
        const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0) {
          if (round >= TOTAL_ROUNDS) {
            stopTick();
            setPhase('finished');
            setRunning(false);
            setFinished(true);
            playDone();
            return;
          }
          startPause();
        }
      };
      tick();
      tickRef.current = setInterval(tick, 250);
      return;
    }

    if (phase === 'pause') {
      if (!endsAtRef.current) endsAtRef.current = Date.now() + pauseRemaining * 1000;
      const tick = () => {
        if (!endsAtRef.current) return;
        const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
        setPauseRemaining(left);
        if (left <= 0) {
          startRound(Math.min(round + 1, TOTAL_ROUNDS));
        }
      };
      tick();
      tickRef.current = setInterval(tick, 150);
    }

    return () => stopTick();
  }, [phase, pauseRemaining, playDone, remaining, round, startPause, startRound, stopTick]);

  useEffect(() => {
    if (!roomId || !running) return;
    const push = () => {
      void fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          mode: 'crazy-eights',
          round,
          remaining,
          total,
          running,
          finished,
          endsAt: endsAtRef.current
        } satisfies PushPayload)
      });
    };
    push();
    const id = setInterval(push, 1000);
    return () => clearInterval(id);
  }, [roomId, round, remaining, total, running, finished]);

  const shareUrl = useMemo(() => (roomId && typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : ''), [roomId]);
  const frac = useMemo(() => (total > 0 ? remaining / total : 0), [remaining, total]);

  const createRoomAndStart = () => {
    const id = roomId ?? generateRoomId();
    setRoomId(id);
    setShowQR(false);
    startRound(1);
  };

  return (
    <>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Crazy Eights</div>
      <div style={{ fontSize: 42, fontWeight: 800, color: '#FFFFFF', marginBottom: 24, letterSpacing: '-0.02em' }}>
        {finished ? 'Ferdig!' : `Runde ${round} av ${TOTAL_ROUNDS}`}
      </div>

      <div style={{ position: 'relative', width: SIZE, height: SIZE, animation: flash ? 'flash 0.6s ease-in-out 2' : '' }}>
        <svg width={SIZE} height={SIZE}>
          <circle cx="150" cy="150" r="116" fill="none" stroke="#1E1E1E" strokeWidth="68" />
          <path fill="none" strokeWidth="68" strokeLinecap="butt" d={arcPath(frac)} stroke={arcColor(frac, finished)} opacity={finished ? '0.25' : '1'} />
          <circle cx="150" cy="150" r="92" fill="#111111" />
          <rect x="148.5" y="-1" width="3" height="69" fill="#111111" />
        </svg>

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: finished ? '#dc2626' : '#FFFFFF', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {phase === 'pause' ? `+${pauseRemaining}` : fmt(remaining)}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: 100, padding: '5px 14px', fontSize: 11, fontWeight: 600, color: '#666666' }}>
            {finished ? 'Økt ferdig' : phase === 'pause' ? 'Neste runde starter...' : running ? 'Kjører' : 'Klar'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 26, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={createRoomAndStart} style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: 100, color: '#FFFFFF', fontWeight: 600, padding: '12px 18px', cursor: 'pointer' }}>Start 8 runder</button>
        <button onClick={resetAll} style={{ background: 'transparent', border: '1px solid #2A2A2A', borderRadius: 100, color: '#666666', fontWeight: 600, padding: '12px 18px', cursor: 'pointer' }}>Nullstill</button>
        {roomId && <button onClick={() => setShowQR((v) => !v)} style={{ background: 'transparent', border: '1px solid #2A2A2A', borderRadius: 100, color: '#666666', fontWeight: 600, padding: '12px 18px', cursor: 'pointer' }}>Del rom</button>}
      </div>

      {roomId && showQR && shareUrl && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <QRCodeSVG value={shareUrl} size={160} bgColor="#111111" fgColor="#FFFFFF" />
          <div style={{ fontSize: 12, color: '#666666' }}>{shareUrl}</div>
        </div>
      )}

      <style jsx>{`
        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </>
  );
}
