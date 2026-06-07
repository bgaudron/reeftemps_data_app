import { queryOptions } from "@tanstack/react-query";
import type {
  Datastream,
  MultiDatastream,
  ObservationPoint,
  ObservedProperty,
  STAResponse,
  Thing,
} from "../types/sta";

const STA_BASE = "https://www.reeftemps.science/sta/v1.1/";

async function staFetch<T>(path: string, signal?: AbortSignal): Promise<STAResponse<T>> {
  const res = await fetch(STA_BASE + path, { signal });
  if (!res.ok) throw new Error(`STA ${res.status}: ${path}`);
  return res.json() as Promise<STAResponse<T>>;
}

// ─── Networks ─────────────────────────────────────────────────────────────────

async function fetchNetworks(): Promise<string[]> {
  const data = await staFetch<{ properties: { network_name: string } }>(
    "Datastreams?$select=distinct:properties/network_name&$orderby=properties/network_name"
  );
  return data.value.map((d) => d.properties.network_name).filter(Boolean);
}

export const networksQueryOptions = queryOptions({
  queryKey: ["networks"],
  queryFn: fetchNetworks,
  staleTime: 1000 * 60 * 60,
});

// ─── Observed properties (physical parameters) ────────────────────────────────

export interface ObservedPropertyFilters {
  activeOnly?: boolean;
  network?: string;
}

async function fetchObservedProperties(
  filters: ObservedPropertyFilters
): Promise<ObservedProperty[]> {
  const clauses: string[] = [];
  if (filters.activeOnly) clauses.push("Datastreams/Thing/properties/active eq 'true'");
  if (filters.network)
    clauses.push(`Datastreams/properties/network_name in ('${filters.network}')`);

  const filter = clauses.length ? `&$filter=${clauses.join(" and ")}` : "";
  const data = await staFetch<ObservedProperty>(
    `ObservedProperties?$select=@iot.id,name,description&$orderby=description${filter}`
  );
  return data.value;
}

export const observedPropertiesQueryOptions = (filters: ObservedPropertyFilters = {}) =>
  queryOptions({
    queryKey: ["observedProperties", filters],
    queryFn: () => fetchObservedProperties(filters),
    staleTime: 1000 * 60 * 60,
  });

// ─── Stations (Things) ────────────────────────────────────────────────────────

export interface StationFilters {
  observedPropertyId?: number;
  activeOnly?: boolean;
  networks?: string[];
}

const THINGS_SELECT = [
  "id",
  "name",
  "description",
  "properties/code",
  "properties/active",
  "properties/center",
  "properties/center_description",
  "properties/pi_name",
  "properties/pi_description",
  "properties/pi_email",
].join(",");

const THINGS_EXPAND = [
  "Locations($select=location)",
  "MultiDatastreams($select=properties/network_name,properties/network_description,properties/url_doi,properties/uuid_catalog;$top=1)",
].join(",");

async function fetchStations(filters: StationFilters, signal?: AbortSignal): Promise<Thing[]> {
  const clauses: string[] = [];
  if (filters.observedPropertyId != null)
    clauses.push(
      `MultiDatastreams/ObservedProperties/@iot.id eq ${filters.observedPropertyId}`
    );
  if (filters.activeOnly) clauses.push("properties/active eq 'true'");
  if (filters.networks?.length)
    clauses.push(
      `Datastreams/properties/network_name in (${filters.networks.map((n) => `'${n}'`).join(",")})`
    );

  const filter = clauses.length ? `&$filter=${clauses.join(" and ")}` : "";
  const data = await staFetch<Thing>(
    `Things?$select=${THINGS_SELECT}&$expand=${THINGS_EXPAND}${filter}`,
    signal
  );
  return data.value;
}

export const stationsQueryOptions = (filters: StationFilters = {}) =>
  queryOptions({
    queryKey: ["stations", filters],
    queryFn: ({ signal }) => fetchStations(filters, signal),
    staleTime: 1000 * 60 * 5,
  });

// ─── MultiDatastreams d'une station (requête #4) ──────────────────────────────
// Deux sous-requêtes : d'abord les multiserie_id distincts, puis les détails
// de chaque multiserie en parallèle.

const MULTIDS_SELECT = [
  "@iot.id",
  "name",
  "phenomenonTime",
  "properties/depth",
  "properties/type",
  "properties/processing_level",
  "properties/serie_ids",
].join(",");

const MULTIDS_EXPAND = [
  "ObservedProperties($select=@iot.id,description)",
  "Sensor($select=properties/family)",
].join(",");

async function fetchMultiDatastreams(thingId: number): Promise<MultiDatastream[]> {
  const idsData = await staFetch<{ properties: { multiserie_id: string } }>(
    `Things(${thingId})/MultiDatastreams?$select=distinct:properties/multiserie_id`
  );
  const multiserieIds = idsData.value
    .map((d) => d.properties.multiserie_id)
    .filter(Boolean);

  const chunks = await Promise.all(
    multiserieIds.map((mid) =>
      staFetch<MultiDatastream>(
        `Things(${thingId})/MultiDatastreams?$filter=properties/multiserie_id eq '${mid}'` +
          `&$select=${MULTIDS_SELECT}&$expand=${MULTIDS_EXPAND}`
      ).then((r) =>
        // Parmi les MDS du même multiserie_id, garder celui avec le plus d'ObservedProperties
        r.value.reduce((best, cur) =>
          (cur.ObservedProperties?.length ?? 0) > (best.ObservedProperties?.length ?? 0) ? cur : best
        )
      )
    )
  );
  return chunks;
}

export const multiDatastreamsQueryOptions = (thingId: number) =>
  queryOptions({
    queryKey: ["multiDatastreams", thingId],
    queryFn: () => fetchMultiDatastreams(thingId),
    staleTime: 1000 * 60 * 30,
  });

// ─── Métadonnées d'une série (requête #5) — fournit le serie_path ─────────────

const DATASTREAM_SELECT = [
  "phenomenonTime",
  "unitOfMeasurement/name",
  "properties/depth",
  "properties/type",
  "properties/processing_level",
  "properties/processing_level_code",
  "properties/serie_name",
  "properties/serie_path",
  "properties/serie_start_date",
  "properties/serie_end_date",
].join(",");

async function fetchDatastream(serieId: number): Promise<Datastream> {
  const data = await staFetch<Datastream>(
    `Datastreams?$filter=properties/serie_id eq ${serieId}` +
      `&$select=${DATASTREAM_SELECT}` +
      `&$expand=ObservedProperty($select=name,description),Sensor($select=properties/family)` +
      `&$top=1`
  );
  if (!data.value[0]) throw new Error(`Datastream introuvable pour serie_id ${serieId}`);
  return data.value[0];
}

export const datastreamQueryOptions = (serieId: number) =>
  queryOptions({
    queryKey: ["datastream", serieId],
    queryFn: () => fetchDatastream(serieId),
    staleTime: 1000 * 60 * 60,
  });

// ─── Observations (requête #6) — points du graphe ────────────────────────────
// DataArray compact : chaque chunk a { components, dataArray: [date, valeur][] }
// Récupéré en desc → reverse() pour Recharts (ordre chronologique).

async function fetchObservations(
  serieId: number,
  signal?: AbortSignal
): Promise<ObservationPoint[]> {
  const data = await staFetch<{ components: string[]; dataArray: [string, number | null][] }>(
    `Observations?$filter=parameters/serie_id eq ${serieId}` +
      `&$select=phenomenonTime,result` +
      `&$orderby=phenomenonTime desc` +
      `&$top=600000` +
      `&$resultFormat=DataArray`,
    signal
  );

  const points: ObservationPoint[] = data.value
    .flatMap((chunk) => chunk.dataArray)
    .filter((row): row is [string, number] => row[1] != null)
    .map(([date, value]) => ({ time: new Date(date).getTime(), value }));

  points.reverse();
  return points;
}

export const observationsQueryOptions = (serieId: number) =>
  queryOptions({
    queryKey: ["observations", serieId],
    queryFn: ({ signal }) => fetchObservations(serieId, signal),
    staleTime: 1000 * 60 * 5,
  });

// ─── Compteurs globaux (page d'accueil) ───────────────────────────────────────

export interface STACounts {
  things: number;
  datastreams: number;
}

async function fetchCounts(): Promise<STACounts> {
  const [thingsRes, dsRes] = await Promise.all([
    staFetch<Record<string, never>>("Things?$count=true&$top=0"),
    staFetch<Record<string, never>>(
      "Datastreams?$select=distinct:properties/serie_id&$count=true&$top=0"
    ),
  ]);
  return {
    things: thingsRes["@iot.count"] ?? 0,
    datastreams: dsRes["@iot.count"] ?? 0,
  };
}

export const countsQueryOptions = queryOptions({
  queryKey: ["counts"],
  queryFn: fetchCounts,
  staleTime: 1000 * 60 * 60,
});

// ─── Re-exports for downstream consumers ──────────────────────────────────────

export type { Datastream, MultiDatastream, ObservationPoint, ObservedProperty, Thing };
