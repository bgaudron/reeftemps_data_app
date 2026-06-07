import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { stationsQueryOptions } from "@/api/sta";
import type { Thing } from "@/types/sta";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SearchBarProps {
  onSelect: (thing: Thing) => void;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const { data: stations = [] } = useQuery(stationsQueryOptions({}));

  function handleSelect(thing: Thing) {
    setQuery("");
    onSelect(thing);
  }

  return (
    <div className="absolute top-4 z-10 left-16 right-28 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-96">
      <Command
        shouldFilter
        className="rounded-2xl shadow-lg border border-slate-200 bg-white"
      >
        <CommandInput
          placeholder="Rechercher une station…"
          value={query}
          onValueChange={setQuery}
        />
        {query.length > 0 && (
          <CommandList>
            <CommandEmpty>Aucune station trouvée</CommandEmpty>
            <CommandGroup>
              {stations.map((station) => (
                <CommandItem
                  key={station["@iot.id"]}
                  value={station.name}
                  onSelect={() => handleSelect(station)}
                >
                  <MapPinIcon className="size-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{station.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </div>
  );
}
