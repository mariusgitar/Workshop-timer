# Workshop Timer — Codex-kontekst

## Stack
- Next.js 14, TypeScript, Vercel
- Pusher Channels for sanntid (pusher server-side, pusher-js klient-side)
- Plus Jakarta Sans (Google Fonts)
- Ingen CSS-filer — all styling er inline styles i komponentene

## Filstruktur
- app/page.tsx — redirecter til /timer/5
- app/timer/[...slug]/page.tsx — sender initialMinutes og autoStart til WorkshopTimer
- app/room/[id]/page.tsx — viewer-siden, abonnerer på Pusher
- app/api/push/route.ts — serverless route som trigger Pusher-events
- components/WorkshopTimer.tsx — hovedkomponenten

## Miljøvariabler (ligger i Vercel)
- PUSHER_APP_ID
- NEXT_PUBLIC_PUSHER_KEY
- PUSHER_SECRET
- NEXT_PUBLIC_PUSHER_CLUSTER

## Viktige mønstre
- Wall-clock nedtelling: bruk endsAtRef (Date.now() + sekunder), ikke --remaining
- Refs for running og remaining for å unngå stale closure i setInterval
- sessionStorage for å gjenopprette state ved refresh
- Pusher-sync: kontroller sender til /api/push hvert sekund når running er true
- Viewer bruker pusher:subscription_succeeded før channel.bind('timer-update')

## Push-payload
{ roomId, remaining, total, running, finished, mode?, round? }
mode: 'timer' | 'crazy-eights'

## Design-system
- Bakgrunn: #111111
- Track-ring: #1E1E1E
- Arc-farger: hvit (#ffffff) > 50%, amber (#d97706) > 20%, rød (#dc2626)
- Font: Plus Jakarta Sans 800 for tall, 700 for titler, 600 for knapper
- Ghost-knapper: border 1px solid #2A2A2A, borderRadius 100px, color #666666
- Ring-størrelse: SIZE=300, STROKE=68, R=116, CX=150, CY=150

## Crazy Eights-modus
- Egen side: /crazy-eights
- Komponent: components/CrazyEightsTimer.tsx
- 8 runder à 60 sekunder, auto-restart med 3 sek pause mellom runder
- Samme rom-deling og Pusher-infrastruktur som WorkshopTimer
- Viewer på /room/[id] viser Crazy Eights-layout når mode === 'crazy-eights'

## Regler
- Ikke endre timer-logikk uten eksplisitt instruks
- Ikke endre Pusher-tilkobling uten eksplisitt instruks
- Alltid bekrefte med window.confirm() før destructive actions (nytt rom etc.)
- Norsk brukergrensesnitt, engelske variabelnavn
