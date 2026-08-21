import { useState } from "react";
import {
  LayoutDashboard,
  Map,
  Truck,
  Route,
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const items = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "mapa", label: "Mapa ao vivo", icon: Map },
  { id: "veiculos", label: "Veículos", icon: Truck },
  { id: "rotas", label: "Rotas", icon: Route },
  { id: "transbordo", label: "Transbordo", icon: ArrowLeftRight },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "relatorios", label: "Relatórios", icon: ChartNoAxesCombined },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const [active, setActive] = useState("visao");
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setActive(item.id);
                  onNavigate?.();
                }}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors lg:justify-center xl:justify-start",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute top-1/2 -left-3 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon
                  className={cn("size-[18px] shrink-0", isActive && "text-primary")}
                />
                <span className="truncate lg:hidden xl:inline">{item.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="xl:hidden">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function Footer() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground lg:justify-center xl:justify-start">
        <Settings className="size-[18px] shrink-0" />
        <span className="lg:hidden xl:inline">Configurações</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex lg:w-[76px] xl:w-[236px]">
      <div className="flex h-[72px] items-center border-b border-sidebar-border px-4 lg:justify-center xl:justify-start">
        <span className="text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase lg:hidden xl:inline">
          Torre de controle
        </span>
        <span className="hidden text-[11px] font-bold tracking-[0.1em] text-primary lg:inline xl:hidden">
          TC
        </span>
      </div>
      <Nav />
      <Footer />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-[11px] font-semibold tracking-[0.22em] text-subtle uppercase">
                Torre de controle
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
            <Footer />
          </div>
        </div>
      )}
    </>
  );
}
