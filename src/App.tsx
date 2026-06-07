import { useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapView } from "@/components/MapView";
import type { MapViewHandle } from "@/components/MapView";
import { StationDrawer } from "@/components/StationDrawer";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel } from "@/components/FilterPanel";
import type { StationFilters } from "@/api/sta";
import type { Thing } from "@/types/sta";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export default function App() {
  const [selectedStation, setSelectedStation] = useState<Thing | null>(null);
  const [filters, setFilters] = useState<StationFilters>({});
  const mapRef = useRef<MapViewHandle>(null);

  function handleSearchSelect(thing: Thing) {
    const coords = thing.Locations?.[0]?.location?.coordinates;
    if (coords) mapRef.current?.flyTo(coords);
    setSelectedStation(thing);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative h-screen w-screen overflow-hidden">
        <MapView ref={mapRef} filters={filters} onStationSelect={setSelectedStation} />
        <SearchBar onSelect={handleSearchSelect} />
        <FilterPanel filters={filters} onChange={setFilters} />
        <StationDrawer
          thing={selectedStation}
          filterParamId={filters.observedPropertyId}
          onClose={() => setSelectedStation(null)}
        />
      </div>
    </QueryClientProvider>
  );
}
