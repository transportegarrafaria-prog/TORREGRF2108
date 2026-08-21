import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Filters } from "@/data/vehicleModel";
import { statusOptions } from "@/data/vehicleModel";
import { gpsLabel } from "./ui-bits";

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.09em] text-subtle uppercase">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full border-border bg-card text-sm text-foreground data-[state=open]:border-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border bg-popover">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function FilterBar({
  filters,
  onChange,
  onClear,
  transportadoras,
  destinos,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
  transportadoras: string[];
  destinos: string[];
}) {
  return (
    <div className="panel grid grid-cols-2 items-end gap-3 p-4 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <Field
        label="Transportadora"
        value={filters.transportadora}
        onChange={(v) => onChange({ ...filters, transportadora: v })}
        options={[
          { value: "todas", label: "Todas" },
          ...transportadoras.map((t) => ({ value: t, label: t })),
        ]}
      />
      <Field
        label="Tipo"
        value={filters.tipo}
        onChange={(v) => onChange({ ...filters, tipo: v })}
        options={[
          { value: "todos", label: "Todos" },
          { value: "Distribuicao", label: "Distribuição" },
          { value: "Transbordo", label: "Transbordo" },
        ]}
      />
      <Field
        label="Status"
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
        options={[
          { value: "todos", label: "Todos" },
          ...statusOptions.map((s) => ({ value: s, label: gpsLabel(s) })),
        ]}
      />
      <Field
        label="Destino / Ponto"
        value={filters.destino}
        onChange={(v) => onChange({ ...filters, destino: v })}
        options={[
          { value: "todos", label: "Todos" },
          ...destinos.map((d) => ({ value: d, label: d })),
        ]}
      />
      <div className="col-span-2 flex items-center gap-2 md:col-span-4 xl:col-span-1">
        <Filter className="hidden size-4 text-subtle xl:block" />
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <X className="size-3.5" />
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
