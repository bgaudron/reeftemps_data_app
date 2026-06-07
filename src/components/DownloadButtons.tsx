import { useQuery } from "@tanstack/react-query";
import { datastreamQueryOptions } from "@/api/sta";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon, FileDownIcon, TableIcon, BarChart2Icon } from "lucide-react";

const PORTAL = "https://www.reeftemps.science/";
const THREDDS = PORTAL + "thredds/dodsC/";
const NETCDF = PORTAL + "thredds/fileServer/";
const CSV = PORTAL + "dap2csv?dataset=";
const GRAPH = PORTAL + "dap2graph?dataset=";

interface DownloadButtonsProps {
  serieId: number;
  compact?: boolean;
}

export function DownloadButtons({ serieId, compact = false }: DownloadButtonsProps) {
  const { data: ds } = useQuery(datastreamQueryOptions(serieId));

  if (!ds?.properties.serie_path) return null;

  const seriePath = ds.properties.serie_path;
  const paramName = ds.ObservedProperty?.name ?? "";
  const dodsBase = THREDDS + seriePath;
  const open = (url: string) => window.open(url, "_blank");

  const actions = [
    { title: "Ouvrir dans Thredds",   icon: ExternalLinkIcon, url: dodsBase + ".html" },
    { title: "Télécharger NetCDF",    icon: FileDownIcon,     url: NETCDF + seriePath },
    { title: "Télécharger CSV",       icon: TableIcon,        url: `${CSV}${dodsBase}&variable=${paramName}` },
    { title: "Voir le graphe PNG",    icon: BarChart2Icon,    url: `${GRAPH}${dodsBase}&y_variable=${paramName}` },
  ];

  if (compact) {
    return (
      <>
        {actions.map(({ title, icon: Icon, url }) => (
          <Button
            key={title}
            variant="ghost"
            title={title}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
            onClick={() => open(url)}
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ title, icon: Icon, url }) => (
        <Button key={title} variant="outline" size="sm" onClick={() => open(url)}>
          <Icon className="size-3.5" />
          {title.replace(/^(Ouvrir dans |Télécharger |Voir le )/, "")}
        </Button>
      ))}
    </div>
  );
}
