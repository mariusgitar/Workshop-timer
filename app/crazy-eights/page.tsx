'use client';

import { useSearchParams } from 'next/navigation';
import CrazyEightsTimer from '@/components/CrazyEightsTimer';

export default function CrazyEightsPage() {
  const searchParams = useSearchParams();
  const room = searchParams.get('room');

  return <CrazyEightsTimer initialRoomId={room} />;
}
