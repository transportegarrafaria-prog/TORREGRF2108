import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "./ui-bits";

const accents: Record<Tone, { text: string; bar: string; ring: string; soft: string }> = {
  brand: {
    text: "text-primary",
    bar: "bg-primary",
    ring: "border-[color-mix(in_oklab,var(--primary)_55%,transparent)]",
    soft: "bg-primary-soft",
  },
  ok: {
    text: "text-ok",
    bar: "bg-ok",
    ring: "border-[color-mix(in_oklab,var(--ok)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--ok)_13%,transparent)]",
  },
  warn: {
    text: "text-warn",
    bar: "bg-warn",
    ring: "border-[color-mix(in_oklab,var(--warn)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--warn)_13%,transparent)]",
  },
  crit: {
    text: "text-crit",
    bar: "bg-crit",
    ring: "border-[color-mix(in_oklab,var(--crit)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--crit)_13%,transparent)]",
  },
  transfer: {
    text: "text-transfer",
    bar: "bg-transfer",
    ring: "border-[color-mix(in_oklab,var(--transfer)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--transfer)_13%,transparent)]",
  },
  cyan: {
    text: "text-cyan",
    bar: "bg-cyan",
    ring: "border-[color-mix(in_oklab,var(--grf-cyan)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--grf-cyan)_13%,transparent)]",
  },
  neutral: {
    text: "text-muted-foreground",
    bar: "bg-muted-foreground",
    ring: "border-border-strong",
    soft: "bg-secondary",
  },
};

export function KpiCard({
  label,
  value,
  hint,
  extra,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  extra?: string | undefined;
  icon: LucideIcon;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  const a = accents[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "panel group relative overflow-hidden p-4 text-left transition-all hover:-translate-y-[1px] hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && cn(a.ring, "bg-card-elevated"),
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] transition-opacity",
          a.bar,
          active ? "opacity-100" : "opacity-35 group-hover:opacity-70",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn("grid size-9 shrink-0 place-items-center rounded-lg", a.soft, a.text)}
        >
          <Icon className="size-[18px]" />
        </span>
        {extra && (
          <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", a.soft, a.text)}>
            {extra}
          </span>
        )}
      </div>
      <p className="tabular mt-4 text-[34px] leading-none font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-[13px] font-semibold tracking-[0.05em] text-foreground/90 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}
