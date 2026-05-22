import { NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID ?? '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY ?? '',
  secret: process.env.PUSHER_SECRET ?? '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? '',
  useTLS: true
});

export async function POST(req: Request) {
  const { roomId, remaining, total, running, finished } = await req.json();

  console.log('Pusher config:', {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    secret: process.env.PUSHER_SECRET ? 'SET' : 'MISSING',
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  });

  await pusher.trigger(`room-${roomId}`, 'timer-update', {
    remaining,
    total,
    running,
    finished
  });

  return NextResponse.json({ ok: true });
}
