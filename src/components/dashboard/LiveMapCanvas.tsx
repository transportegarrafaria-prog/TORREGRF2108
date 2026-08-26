import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { estadoCores, type Vehicle } from "@/data/vehicleModel";
import { estadoLabel } from "./ui-bits";

function markerColor(v: Vehicle) {
  return estadoCores[v.estado] ?? "var(--primary)";
}

const truckSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;

function truckIcon(v: Vehicle, selected: boolean) {
  const color = markerColor(v);
  return L.divIcon({
    className: "grf-truck-wrapper",
    html: `<div class="grf-truck${selected ? " is-selected" : ""}" style="--truck:${color}">
        <span class="grf-truck-ico">${truckSvg}</span>
        <span class="grf-truck-plate">${v.placa}</span>
      </div>`,
    iconSize: [92, 30],
    iconAnchor: [46, 30],
    popupAnchor: [0, -28],
  });
}

export function hasCoords(v: Vehicle): v is Vehicle & { latitude: number; longitude: number } {
  return Number.isFinite(v.latitude) && Number.isFinite(v.longitude);
}

function FitBounds({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();
  useEffect(() => {
    const located = vehicles.filter(hasCoords);
    if (!located.length) return;
    const bounds = located.map((v) => [v.latitude, v.longitude]) as [number, number][];
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 10 });
  }, [vehicles, map]);
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="tabular text-[12px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export function LiveMapCanvas({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const located = useMemo(() => vehicles.filter(hasCoords), [vehicles]);
  const icons = useMemo(
    () => new Map(located.map((v) => [v.id, truckIcon(v, v.id === selectedId)])),
    [located, selectedId],
  );

  return (
    <div className="grf-map h-full w-full">
      <MapContainer center={[-22.5, -43.1]} zoom={8} scrollWheelZoom className="h-full w-full">
        {/*
          Tiles direto do OpenStreetMap: sem chave, sem marca d'água.
          O CARTO passou a estampar "API KEY REQUIRED" nos basemaps
          gratuitos, e aparecia por cima do mapa ao dar zoom.
          Sem {s}: o OSM pede o host único (a./b./c. estão descontinuados).
          Sem {r}: o servidor padrão não serve tile @2x.
        */}
        <TileLayer
          attribution='&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitBounds vehicles={vehicles} />
        {located.map((v) => {
          const color = markerColor(v);
          return (
            <Marker
              key={v.id}
              position={[v.latitude, v.longitude]}
              icon={icons.get(v.id)!}
              zIndexOffset={v.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(v.id) }}
            >
              <Popup>
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold tracking-wide text-foreground">
                      {v.placa}
                    </span>
                    <span
                      className="rounded-md border px-2 py-0.5 text-[11px] font-medium"
                      style={{ color, borderColor: color }}
                    >
                      {estadoLabel(v.estado)}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    <Row label="Velocidade" value={`${v.velocidade} km/h`} />
                    <Row
                      label="GPS"
                      value={v.gpsAtualizadoEm === null ? "—" : `há ${v.gpsAtualizadoEm} min`}
                    />
                    <Row label="Destino" value={v.destino} />
                    <Row label="Transportadora" value={v.transportadora} />
                    <Row label="Saída prevista" value={v.saidaPrevista} />
                    <Row label="Saída real" value={v.saiu ? (v.saidaReal ?? "—") : "—"} />
                    {v.tipo === "Transbordo" && (
                      <Row label="Chegada transbordo" value={v.chegadaTransbordo ?? "—"} />
                    )}
                    <Row label="Última posição" value={v.ultimaPosicao} />
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg bg-primary py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:brightness-110"
                  >
                    Ver veículo
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
