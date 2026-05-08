import WorkshopTimer from “@/components/WorkshopTimer”;

interface Props {
params: { slug?: string[] };
}

export default function TimerPage({ params }: Props) {
const slug = params.slug ?? [];
const minutes = Math.max(1, Math.min(59, parseInt(slug[0]) || 5));
const auto = slug.includes(“auto”);
return <WorkshopTimer minutes={minutes} auto={auto} />;
}
