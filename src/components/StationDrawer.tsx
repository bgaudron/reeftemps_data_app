import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { multiDatastreamsQueryOptions } from "@/api/sta";
import type { MultiDatastream, Thing } from "@/types/sta";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";
import { DownloadButtons } from "@/components/DownloadButtons";

interface SerieOption {
  serieId: number;
  observedPropertyId: number | undefined;
  label: string;
}

function buildSerieOptions(multiDatastreams: MultiDatastream[]): SerieOption[] {
  return multiDatastreams.flatMap((mds) => {
    const ids = mds.properties.serie_ids ?? [];
    const obsProps = mds.ObservedProperties ?? [];
    return obsProps.flatMap((prop, i) => {
      const serieId = ids[i];
      if (serieId == null) return [];
      const parts = [
        prop.description,
        mds.properties.depth != null ? `${mds.properties.depth} m` : null,
        mds.properties.processing_level,
      ].filter(Boolean);
      return [{
        serieId,
        observedPropertyId: prop["@iot.id"],
        label: parts.join(" — ") || mds.name || `Série ${serieId}`,
      }];
    });
  });
}

function formatCoords(lng: number, lat: number): string {
  const lo = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  const la = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  return `${la}, ${lo}`;
}

interface StationDrawerProps {
  thing: Thing | null;
  filterParamId?: number;
  onClose: () => void;
}

function extractDOI(urlDoi: string): string {
  return urlDoi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

export function StationDrawer({ thing, filterParamId, onClose }: StationDrawerProps) {
  const thingId = thing?.["@iot.id"] ?? 0;

  const { data: multiDatastreams = [], isPending: mdsLoading } = useQuery({
    ...multiDatastreamsQueryOptions(thingId),
    enabled: !!thing,
  });

  const urlDoi = thing?.MultiDatastreams?.[0]?.properties.url_doi ?? null;
  const doi = urlDoi ? extractDOI(urlDoi) : null;

  const { data: citation } = useQuery({
    queryKey: ["citation", doi],
    queryFn: () =>
      fetch(`https://citation.doi.org/format?doi=${encodeURIComponent(doi!)}&style=apa&lang=fr-FR`)
        .then((r) => r.text()),
    enabled: !!doi,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const serieOptions = useMemo(() => buildSerieOptions(multiDatastreams), [multiDatastreams]);
  const [selectedSerieId, setSelectedSerieId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSerieId(null);
  }, [thingId]);

  useEffect(() => {
    if (serieOptions.length === 0) return;
    if (serieOptions.length === 1) {
      setSelectedSerieId(serieOptions[0].serieId);
      return;
    }
    if (filterParamId != null) {
      const match = serieOptions.find((o) => o.observedPropertyId === filterParamId);
      if (match) setSelectedSerieId(match.serieId);
    }
  }, [serieOptions, filterParamId]);

  const coords = thing?.Locations?.[0]?.location?.coordinates;
  const isActive = thing?.properties.active === "true";
  const network = thing?.MultiDatastreams?.[0]?.properties.network_name;

  return (
    <Sheet open={!!thing} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[65vh] flex flex-col p-0 gap-0">

        {/* En-tête fixe */}
        <SheetHeader className="px-5 pt-4 pb-3 border-b bg-white flex-shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">

            {/* Infos station */}
            <div className="shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block size-2 rounded-full shrink-0 ${isActive ? "bg-emerald-400" : "bg-slate-300"}`} />
                <SheetTitle className="text-base">{thing?.name}</SheetTitle>
                {network && (
                  <Badge variant="outline" className="text-xs">{network}</Badge>
                )}
              </div>
              <SheetDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                {coords && <span>{formatCoords(coords[0], coords[1])}</span>}
                {thing?.properties.center && <span>{thing.properties.center}</span>}
                {thing?.properties.pi_name && <span>PI : {thing.properties.pi_name}</span>}
              </SheetDescription>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-slate-200 shrink-0" />

            {/* Sélecteur — prend toute la place disponible */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Série</p>
              {mdsLoading ? (
                <span className="text-xs text-slate-400">Chargement…</span>
              ) : serieOptions.length > 1 ? (
                <Select
                  value={selectedSerieId != null ? String(selectedSerieId) : undefined}
                  onValueChange={(v) => setSelectedSerieId(Number(v))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Série…" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {serieOptions.map((opt) => (
                      <SelectItem key={opt.serieId} value={String(opt.serieId)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-slate-500">{serieOptions[0]?.label ?? "—"}</span>
              )}
            </div>

            <div className="hidden sm:block w-px self-stretch bg-slate-200 shrink-0" />

            {/* Actions */}
            <div className="flex flex-col gap-1 shrink-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Téléchargements</p>
              <div className="flex items-center gap-0.5">
                {selectedSerieId != null
                  ? <DownloadButtons serieId={selectedSerieId} compact />
                  : <span className="text-xs text-slate-400">—</span>
                }
              </div>
            </div>

            {/* Fermeture */}
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 self-start shrink-0"
              onClick={onClose}
            >
              <XIcon className="size-4" />
            </Button>

          </div>
        </SheetHeader>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3">

          {/* Graphe avec Brush intégré pour le zoom */}
          {selectedSerieId != null ? (
            <TimeSeriesChart
              serieId={selectedSerieId}
              observedPropertyId={serieOptions.find(o => o.serieId === selectedSerieId)?.observedPropertyId}
            />
          ) : (
            <div className="h-56 flex items-center justify-center">
              <span className="text-sm text-slate-400">Sélectionnez une série pour afficher le graphe</span>
            </div>
          )}

          {/* Citation DOI */}
          {urlDoi && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Citation</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {citation ?? <span className="text-slate-300 italic">Chargement…</span>}
              </p>
              <a
                href={urlDoi}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-[11px] text-sky-600 hover:underline break-all"
              >
                {urlDoi}
              </a>
            </div>
          )}

          {/* Licence */}
          <div className="flex items-center gap-2 pb-2 text-[11px] text-slate-400">
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 transition-colors"
            >
              <span className="font-semibold">CC BY-SA 4.0</span>
              {" "}— Creative Commons Attribution-ShareAlike 4.0 International
            </a>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
