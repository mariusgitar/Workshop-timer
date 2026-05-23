import { NextResponse } from 'next/server';
import Pusher from 'pusher';

export async function POST(req: Request) {
  const { roomId, remaining, total, running, finished, mode, round } = await req.json();

  const appId = process.env.PUSHER_APP_ID ?? '';
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY ?? '';
  const secret = process.env.PUSHER_SECRET ?? '';
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? '';

  if (!appId || !key || !secret || !cluster) {
    console.error('Pusher env incomplete:', {
      PUSHER_APP_ID: appId ? 'set' : 'MISSING',
      NEXT_PUBLIC_PUSHER_KEY: key ? 'set' : 'MISSING',
      PUSHER_SECRET: secret ? 'set' : 'MISSING',
      NEXT_PUBLIC_PUSHER_CLUSTER: cluster ? 'set' : 'MISSING',
    });
    return NextResponse.json({ ok: false, error: 'Pusher config incomplete' }, { status: 500 });
  }

  const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });

  try {
    await pusher.trigger(`room-${roomId}`, 'timer-update', {
      remaining,
      total,
      running,
      finished,
      mode: mode ?? 'timer',
      round: round ?? null
    });
    console.log(`Pusher trigger success — appId:${appId} cluster:${cluster} channel:room-${roomId}`);
  } catch (error) {
    console.error('Pusher trigger error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
