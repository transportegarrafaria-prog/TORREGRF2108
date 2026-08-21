import { RefreshCw, Radio } from "lucide-react";
import logo from "@/assets/grf-logo.jpg.asset.json";

export function DashboardHeader({
  atualizadoEm,
  loading = false,
  onRefresh,
}: {
  atualizadoEm: string;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="sticky top-0 z-[900] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:px-6 lg:h-[72px] lg:py-0">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <img
          src={logo.url}
          alt="GRF Distribuição"
          className="h-9 w-auto shrink-0 rounded-md md:h-11"
        />
        <span className="hidden h-9 w-px shrink-0 bg-border-strong sm:block" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
              Torre de Controle
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--ok)_30%,transparent)] bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Operação online
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Monitoramento da operação em tempo real
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground xl:flex">
          <Radio className="size-3.5 text-cyan" />
          Sinal GPS atualizado {atualizadoEm}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex disabled:opacity-60 h-9 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-accent"
        >
          <RefreshCw
            className={`size-4 text-muted-foreground${loading ? " animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>
    </header>
  );
}
