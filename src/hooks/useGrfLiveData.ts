import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGrfPayload, type GrfPayload } from "@/services/grfApi";
import { buildAlerts, buildTimeline, buildVehicles, horaDeIso } from "@/services/grfTransform";
import type { AlertItem, TimelineEvent, Vehicle } from "@/data/vehicleModel";

const REFRESH_MS = 60_000;

export interface GrfLiveData {
  vehicles: Vehicle[];
  alerts: AlertItem[];
  timeline: TimelineEvent[];
  atualizadoEm: string;
  loading: boolean;
  hasData: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGrfLiveData(): GrfLiveData {
  const [payload, setPayload] = useState<GrfPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGrfPayload();
      if (!mounted.current) return;
      setPayload(data);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "Falha ao atualizar dados");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load]);

  const vehicles = payload ? buildVehicles(payload) : [];
  const alerts = payload ? buildAlerts(vehicles, payload) : [];
  const timeline = payload ? buildTimeline(vehicles, payload) : [];

  const maisRecente = (payload?.monitoramento ?? [])
    .map((m) => m.atualizadoEm ?? null)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  const atualizadoEm = horaDeIso(maisRecente ?? payload?.servidor ?? null) ?? "—";

  return {
    vehicles,
    alerts,
    timeline,
    atualizadoEm,
    loading,
    hasData: payload !== null,
    error,
    refresh: () => void load(),
  };
}
