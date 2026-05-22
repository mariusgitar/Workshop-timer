import WorkshopTimer from '@/components/WorkshopTimer';

type Params = Record<string, string | string[] | undefined>;

function parseFromSearch(searchParams: Params): { minutes?: number; autoStart: boolean } {
  const slugRaw = searchParams.slug;
  const slug = Array.isArray(slugRaw) ? slugRaw[0] : slugRaw;
  const parts = slug ? slug.replace(/^\/+/, '').split('/') : [];

  const minutesFromSlug = parts.find((p) => /^\d+$/.test(p));
  const minutesFromQueryRaw = searchParams.minutes;
  const minutesFromQuery = Array.isArray(minutesFromQueryRaw) ? minutesFromQueryRaw[0] : minutesFromQueryRaw;

  const parsedMinutes = minutesFromSlug ?? minutesFromQuery;
  const minutes = parsedMinutes ? Math.max(1, Math.min(59, Number.parseInt(parsedMinutes, 10))) : undefined;
  const autoFromQueryRaw = searchParams.auto;
  const autoFromQuery = Array.isArray(autoFromQueryRaw) ? autoFromQueryRaw[0] : autoFromQueryRaw;
  const autoStart = parts.includes('auto') || autoFromQuery === '1' || autoFromQuery === 'true';

  return { minutes, autoStart };
}

export default function Page({ searchParams }: { searchParams: Params }) {
  const { minutes, autoStart } = parseFromSearch(searchParams);
  return <WorkshopTimer initialMinutes={minutes} autoStart={autoStart} />;
}
