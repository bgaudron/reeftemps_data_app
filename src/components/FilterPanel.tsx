import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import {
  networksQueryOptions,
  observedPropertiesQueryOptions,
  stationsQueryOptions,
} from "@/api/sta";
import type { StationFilters } from "@/api/sta";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterPanelProps {
  filters: StationFilters;
  onChange: (filters: StationFilters) => void;
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const { data: networks = [] } = useQuery(networksQueryOptions);
  const { data: observedProps = [] } = useQuery(observedPropertiesQueryOptions());
  const { data: filteredStations = [] } = useQuery(stationsQueryOptions(filters));
  const { data: allStations = [] } = useQuery(stationsQueryOptions({}));

  const selectedNetworks = filters.networks ?? [];
  const activeOnly = filters.activeOnly ?? false;
  const hasActiveFilters =
    selectedNetworks.length > 0 || filters.observedPropertyId != null || activeOnly;

  function toggleNetwork(network: string) {
    const next = selectedNetworks.includes(network)
      ? selectedNetworks.filter((n) => n !== network)
      : [...selectedNetworks, network];
    onChange({ ...filters, networks: next.length > 0 ? next : undefined });
  }

  function setObservedProperty(id: number | undefined) {
    onChange({ ...filters, observedPropertyId: id });
  }

  function setActiveOnly(value: boolean) {
    onChange({ ...filters, activeOnly: value || undefined });
  }

  function reset() {
    onChange({});
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 left-4 z-10 flex items-center justify-center size-10 bg-white rounded-2xl shadow-lg border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
        title="Ouvrir les filtres"
      >
        <SlidersHorizontalIcon className="size-4" />
        {hasActiveFilters && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-500" />
        )}
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-10 w-72 bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col">

      {/* Header */}
      <button
        onClick={() => setOpen(false)}
        className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0 w-full hover:bg-slate-50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontalIcon className="size-3.5 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filtres</span>
        </div>
        {hasActiveFilters && (
          <span
            onClick={(e) => { e.stopPropagation(); reset(); }}
            className="text-xs text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100"
          >
            Réinitialiser
          </span>
        )}
      </button>

      {/* Filters */}
      <div className="px-4 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">

        {/* Networks */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Réseau
          </p>
          <div className="flex flex-wrap gap-1.5">
            {networks.map((network) => {
              const active = selectedNetworks.includes(network);
              return (
                <button
                  key={network}
                  onClick={() => toggleNetwork(network)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {network}
                  {active && <XIcon className="size-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Observed property */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Paramètre
          </p>
          <Select
            value={filters.observedPropertyId != null ? String(filters.observedPropertyId) : "all"}
            onValueChange={(v) => setObservedProperty(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les paramètres</SelectItem>
              {observedProps.map((prop) => (
                <SelectItem key={prop["@iot.id"]} value={String(prop["@iot.id"])}>
                  {prop.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Statut
          </p>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs">
            <button
              onClick={() => setActiveOnly(false)}
              className={`flex-1 py-1.5 font-medium transition-colors ${
                !activeOnly
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              Toutes
            </button>
            <button
              onClick={() => setActiveOnly(true)}
              className={`flex-1 py-1.5 font-medium transition-colors border-l border-slate-200 ${
                activeOnly
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              Actives
            </button>
          </div>
        </div>

      </div>

      {/* Counter */}
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredStations.length}</span>
          {" "}station{filteredStations.length !== 1 ? "s" : ""} sur {allStations.length}
        </p>
        {filteredStations.length === 0 && hasActiveFilters && (
          <button onClick={reset} className="mt-1 text-xs text-sky-600 hover:underline">
            Assouplir les filtres
          </button>
        )}
      </div>

    </div>
  );
}
