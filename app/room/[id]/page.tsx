'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Pusher from 'pusher-js';

type RoomPageProps = {
  params: { id: string };
};

const R = 116;
const CX = 150;
const CY = 150;

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

export default function RoomPage({ params }: RoomPageProps) {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const wasFinishedRef = useRef(false);
  const endsAt = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY ?? '', {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? ''
    });

    const channel = pusher.subscribe(`room-${params.id}`);
    channel.bind('pusher:subscription_succeeded', () => {
      channel.bind('timer-update', (data: { remaining: number; total: number; running: boolean; finished: boolean }) => {
        setRemaining(data.remaining);
        setTotal(data.total);
        setRunning(data.running);
        setFinished(data.finished);

        if (data.running) {
          endsAt.current = Date.now() + data.remaining * 1000;
        } else {
          endsAt.current = null;
        }
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`room-${params.id}`);
      pusher.disconnect();
    };
  }, [params.id]);



  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    if (!running || finished || endsAt.current === null) {
      return;
    }

    const tick = () => {
      if (endsAt.current === null) return;
      const next = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(next);
    };

    tick();
    tickIntervalRef.current = setInterval(tick, 250);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [running, finished]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !running || finished || endsAt.current === null) {
        return;
      }

      const next = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(next);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [running, finished]);

  useEffect(() => {
    if (finished && !wasFinishedRef.current) {
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
    }
    wasFinishedRef.current = finished;
  }, [finished]);

  const frac = useMemo(() => (total > 0 ? remaining / total : 0), [remaining, total]);
  const isWaiting = total === 0 && remaining === 0;
  const urgent = frac <= 0.1 && frac > 0 && running;

  return (
    <>
      <div className="eyebrow">Workshop timer</div>
      {isWaiting ? (
        <div id="idle-state">
          <div id="idle-text">Venter på timer...</div>
        </div>
      ) : (
        <div id="ring-wrap" style={{ animation: urgent ? 'pulse 1s ease-in-out infinite' : '' }}>
          <svg id="svg" width="300" height="300">
            <circle cx="150" cy="150" r="116" fill="none" stroke="#1E1E1E" strokeWidth="68" />
            <path id="arc" fill="none" strokeWidth="68" strokeLinecap="butt" d={arcPath(frac)} stroke={arcColor(frac, finished)} opacity={finished ? '0.25' : '1'} />
            <circle cx="150" cy="150" r="92" fill="#111111" />
            <rect x="148.5" y="-1" width="3" height="69" fill="#111111" />
          </svg>

          <div id="center">
            <div id="time-display" style={{ color: finished ? '#dc2626' : '#FFFFFF', animation: finished ? 'flash 1s ease-in-out infinite' : '' }}>
              {fmt(remaining)}
            </div>
            <div id="hint-pill" style={{ background: '#1E1E1E', borderColor: '#2A2A2A', color: '#555555' }}>
              {finished ? 'Tid ute' : running ? 'Kjører' : 'Pauset'}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .eyebrow { font-size: 22px; font-weight: 700; letter-spacing: 0em; text-transform: none; color: #FFFFFF; margin-bottom: 48px; }
        #ring-wrap, #idle-state { position: relative; width: 300px; height: 300px; }
        #ring-wrap svg { display: block; pointer-events: none; }
        #center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: default; }
        #time-display { font-size: 58px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; transition: color 0.4s; text-align: center; padding: 0 12px; }
        #hint-pill { display: inline-flex; align-items: center; background: #1E1E1E; border: 1px solid #2A2A2A; border-radius: 100px; padding: 5px 14px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; transition: all 0.2s; }
        #idle-state { display: flex; align-items: center; justify-content: center; }
        #idle-text { font-size: 16px; color: #555555; text-align: center; }
      `}</style>
    </>
  );
}
