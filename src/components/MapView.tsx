import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { Undo2Icon } from "lucide-react";
import { stationsQueryOptions } from "@/api/sta";
import type { StationFilters } from "@/api/sta";
import type { Thing } from "@/types/sta";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
// Vue d'ouverture : Pacifique central, zoom 2.5 pour voir tous les territoires
const PACIFIC_CENTER: [number, number] = [167, -20];
const PACIFIC_ZOOM = 2.5;

export interface MapViewHandle {
  flyTo: (coords: [number, number], zoom?: number) => void;
}

interface MapViewProps {
  filters?: StationFilters;
  onStationSelect?: (thing: Thing) => void;
}

function toGeoJSON(things: Thing[]) {
  const features = things.flatMap((t) => {
    const loc = t.Locations?.[0]?.location;
    if (!loc || loc.type !== "Point") return [];
    return [
      {
        type: "Feature" as const,
        id: t["@iot.id"],
        geometry: { type: "Point" as const, coordinates: loc.coordinates },
        properties: {
          id: t["@iot.id"],
          name: t.name,
          description: t.description ?? "",
          active: t.properties.active,
          network: t.MultiDatastreams?.[0]?.properties.network_name ?? "",
          center: t.properties.center ?? "",
        },
      },
    ];
  });
  return { type: "FeatureCollection" as const, features };
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { filters = {}, onStationSelect },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [clustersReady, setClustersReady] = useState(false);
  const [showReset, setShowReset] = useState(false);
  // Refs pour accès en closures d'événements sans stale capture
  const stationsRef = useRef<Thing[]>([]);
  const onSelectRef = useRef(onStationSelect);

  useEffect(() => {
    onSelectRef.current = onStationSelect;
  }, [onStationSelect]);

  useImperativeHandle(ref, () => ({
    flyTo: (coords, zoom = 13) => {
      mapRef.current?.flyTo({ center: coords, zoom, duration: 800 });
    },
  }));

  const { data: stations = [], isLoading } = useQuery(stationsQueryOptions(filters));

  stationsRef.current = stations;

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: PACIFIC_CENTER,
      zoom: PACIFIC_ZOOM,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: "260px",
      className: "station-popup",
    });

    map.on("load", () => {
      loadedRef.current = true;
      if (stationsRef.current.length > 0) map.once("idle", () => setClustersReady(true));
      containerRef.current?.querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib")?.removeAttribute("open");
      map.on("moveend", () => setShowReset(map.getZoom() > PACIFIC_ZOOM + 1));

      // Source GeoJSON avec clustering natif MapLibre
      map.addSource("stations", {
        type: "geojson",
        data: toGeoJSON(stationsRef.current),
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Bulles de cluster
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step", ["get", "point_count"],
            "#0ea5e9", 10,
            "#0284c7", 30,
            "#1d4ed8",
          ],
          "circle-radius": [
            "step", ["get", "point_count"],
            20, 10,
            28, 30,
            36,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Compteur dans les bulles
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "stations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });

      // Stations individuelles — actives en bleu, inactives en gris
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "active"], "true"],
            "#0ea5e9",
            "#94a3b8",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Clic sur cluster → fitBounds sur toutes les stations du groupe
      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const pointCount = features[0].properties?.point_count as number;
        const source = map.getSource("stations") as maplibregl.GeoJSONSource;
        const leaves = await source.getClusterLeaves(clusterId, pointCount, 0);
        const bounds = new maplibregl.LngLatBounds();
        for (const leaf of leaves) {
          if (leaf.geometry.type === "Point") {
            bounds.extend(leaf.geometry.coordinates as [number, number]);
          }
        }
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
      });

      // Clic sur station individuelle → callback (ouvrira le tiroir)
      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id as number;
        const thing = stationsRef.current.find((t) => t["@iot.id"] === id);
        if (thing) onSelectRef.current?.(thing);
      });

      // Tooltip station au survol
      map.on("mouseenter", "unclustered-point", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const { name, description, active, network, center } = feature.properties ?? {};
        const dot = active === "true"
          ? `<span style="width:7px;height:7px;border-radius:50%;background:#34d399;flex-shrink:0;display:inline-block;"></span>`
          : `<span style="width:7px;height:7px;border-radius:50%;background:#94a3b8;flex-shrink:0;display:inline-block;"></span>`;
        const desc = description && !/^not available$/i.test(description.trim()) ? description : null;
        const html = `
          <div style="padding:10px 12px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:${desc ? 4 : 6}px;">
              ${dot}
              <span style="font-size:13px;font-weight:600;color:#0f172a;line-height:1.3;">${name ?? ""}</span>
            </div>
            ${desc ? `<p style="font-size:11px;color:#64748b;margin:0 0 6px;line-height:1.5;">${desc}</p>` : ""}
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              ${network ? `<span style="font-size:10px;color:#0284c7;background:#e0f2fe;padding:1px 7px;border-radius:20px;">${network}</span>` : ""}
              ${center ? `<span style="font-size:10px;color:#475569;background:#f1f5f9;padding:1px 7px;border-radius:20px;">${center}</span>` : ""}
            </div>
          </div>`;
        popup
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Mise à jour de la source quand les stations changent (filtres)
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return;
    const source = mapRef.current.getSource("stations") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(toGeoJSON(stations));
      if (stations.length > 0) mapRef.current.once("idle", () => setClustersReady(true));
    }
  }, [stations]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!clustersReady && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-slate-600 shadow flex items-center gap-2">
          <img src="/favicon.ico" className="size-4 animate-spin" alt="" />
          Chargement des stations…
        </div>
      )}
      {showReset && (
        <button
          onClick={() => mapRef.current?.flyTo({ center: PACIFIC_CENTER, zoom: PACIFIC_ZOOM, duration: 800 })}
          title="Vue Pacifique"
          className="absolute top-4 right-14 z-10 flex items-center justify-center size-10 bg-white rounded-2xl shadow-lg border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Undo2Icon className="size-3.5" />
        </button>
      )}
    </div>
  );
});
