import { lazy, Suspense, useEffect, useState } from "react";
import type { Vehicle } from "@/data/vehicleModel";

const MapCanvas = lazy(() =>
  import("./LiveMapCanvas").then((m) => ({ default: m.LiveMapCanvas })),
);

function MapSkeleton() {
  return (
    <div className="h-full w-full animate-pulse bg-[linear-gradient(110deg,var(--card)_30%,var(--card-elevated)_50%,var(--card)_70%)]" />
  );
}

export function LiveMap({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <MapSkeleton />;

  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapCanvas vehicles={vehicles} selectedId={selectedId} onSelect={onSelect} />
    </Suspense>
  );
}
