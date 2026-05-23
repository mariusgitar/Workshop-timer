'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CrazyEightsTimer from '@/components/CrazyEightsTimer';

function CrazyEightsContent() {
  const searchParams = useSearchParams();
  const room = searchParams.get('room');
  return <CrazyEightsTimer initialRoomId={room} />;
}

export default function CrazyEightsPage() {
  return (
    <Suspense fallback={null}>
      <CrazyEightsContent />
    </Suspense>
  );
}
