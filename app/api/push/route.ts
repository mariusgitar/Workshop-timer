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

  try {
    await pusher.trigger(`room-${roomId}`, 'timer-update', {
      remaining,
      total,
      running,
      finished
    });
    console.log('Pusher trigger success for room:', roomId);
  } catch (error) {
    console.error('Pusher trigger error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
