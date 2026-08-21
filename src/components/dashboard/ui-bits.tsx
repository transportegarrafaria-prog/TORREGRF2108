import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  icon,
  right,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col overflow-hidden", className)}>
      {title && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="shrink-0 text-primary">{icon}</span>}
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-semibold tracking-[0.09em] text-foreground uppercase">
                {title}
              </h2>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName ?? "p-5")}>{children}</div>
    </section>
  );
}

const badgeTones = {
  ok: "bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ok border-[color-mix(in_oklab,var(--ok)_30%,transparent)]",
  warn: "bg-[color-mix(in_oklab,var(--warn)_16%,transparent)] text-warn border-[color-mix(in_oklab,var(--warn)_30%,transparent)]",
  crit: "bg-[color-mix(in_oklab,var(--crit)_16%,transparent)] text-crit border-[color-mix(in_oklab,var(--crit)_32%,transparent)]",
  transfer:
    "bg-[color-mix(in_oklab,var(--transfer)_16%,transparent)] text-transfer border-[color-mix(in_oklab,var(--transfer)_32%,transparent)]",
  brand:
    "bg-primary-soft text-[color-mix(in_oklab,var(--primary)_75%,white)] border-[color-mix(in_oklab,var(--primary)_38%,transparent)]",
  cyan: "bg-[color-mix(in_oklab,var(--grf-cyan)_14%,transparent)] text-cyan border-[color-mix(in_oklab,var(--grf-cyan)_30%,transparent)]",
  neutral: "bg-secondary text-muted-foreground border-border-strong",
} as const;

export type Tone = keyof typeof badgeTones;

export function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

export function gpsTone(status: string): Tone {
  switch (status) {
    case "Em rota":
      return "ok";
    case "Parado":
      return "brand";
    case "Em atencao":
      return "warn";
    case "GPS desatualizado":
      return "crit";
    default:
      return "neutral";
  }
}

export function situacaoTone(s: string): Tone {
  switch (s) {
    case "No horario":
      return "ok";
    case "Atraso leve":
      return "warn";
    case "Atraso alto":
      return "crit";
    case "Concluido":
      return "cyan";
    case "Conferir horario":
      return "transfer";
    default:
      return "neutral";
  }
}

export const gpsLabel = (s: string) => (s === "Em atencao" ? "Em atenção" : s);
export const situacaoLabel = (s: string) =>
  s === "No horario"
    ? "No horário"
    : s === "Aguardando saida"
      ? "Aguardando saída"
      : s === "Concluido"
        ? "Concluído"
        : s === "Conferir horario"
          ? "Conferir horário"
          : s;
