# Spec API STA + téléchargements (Reeftemps)

Référence exacte extraite de l'ancien code. À lire avant d'implémenter la
récupération de données ou les téléchargements dans la data app.

## URLs de base

```
portal  = https://www.reeftemps.science/
STA     = portal + "sta/v1.1/"
thredds = portal + "thredds/dodsC/"        (OPeNDAP)
netcdf  = portal + "thredds/fileServer/"   (fichier NetCDF direct)
csv     = portal + "dap2csv?dataset="      (export CSV, service serveur)
graph   = portal + "dap2graph?dataset="    (graphe PNG, service serveur)
```

Note : l'ancien `reeftemps.ird.nc` existe encore mais le portail de référence
est `www.reeftemps.science`.

## Flux de requêtes STA (dans l'ordre)

Toutes les requêtes passent par TanStack Query. Définir une interface TypeScript
par entité dans `src/types/sta.ts` (Thing, Datastream, MultiDatastream,
Observation, ObservedProperty).

### 1. Réseaux
```
Datastreams?$select=distinct:properties/network_name&$orderby=properties/network_name
```

### 2. Paramètres physiques (ObservedProperties)
```
ObservedProperties?$select=@iot.id,description&$orderby=description
```
Filtres optionnels : `&$filter=Datastreams/Thing/properties/active eq 'true'`
et `Datastreams/properties/network_name in ('<reseau>')`.

### 3. Stations pour la carte (GeoJSON)
```
Things?$select=id,name,description,properties/code,properties/active,properties/center,properties/center_description,properties/pi_name,properties/pi_description,properties/pi_email&$expand=Locations($select=location),MultiDatastreams($select=properties/network_name,properties/network_description,properties/url_doi,properties/uuid_catalog;$top=1)
```
Filtres combinables (logique ET) :
- paramètre : `&$filter=MultiDatastreams/ObservedProperties/@iot.id eq <pp>`
- statut : `... and properties/active eq 'true'`
- réseau : `... and Datastreams/properties/network_name in ('<reseau>')`

C'est exactement la logique de filtrage combinable de l'UX — elle existe déjà
côté API.

### 4. Multiséries d'une station (par profondeur / instrument)
D'abord les identifiants :
```
Things(<id>)/MultiDatastreams?$select=distinct:properties/multiserie_id
```
Puis pour chaque multiserie :
```
Things(<id>)/MultiDatastreams?$filter=properties/multiserie_id eq '<mid>'&$select=@iot.id,name,phenomenonTime,properties/depth,properties/type,properties/processing_level,properties/serie_ids&$expand=ObservedProperties($select=description),Sensor($select=properties/family)
```

### 5. Métadonnées d'une série (fournit le serie_path, clé des téléchargements)
```
Datastreams?$filter=properties/serie_id eq <serie_id>&$select=phenomenonTime,unitOfMeasurement/name,properties/depth,properties/type,properties/processing_level,properties/processing_level_code,properties/serie_name,properties/serie_path,properties/serie_start_date,properties/serie_end_date&$expand=ObservedProperty($select=name,description),Sensor($select=properties/family)&$top=1
```

### 6. Observations (les points du graphe)
```
Observations?$filter=parameters/serie_id eq <serie_id>&$select=phenomenonTime,result&$orderby=phenomenonTime desc&$top=600000&$resultFormat=DataArray
```
Détails importants :
- `$resultFormat=DataArray` renvoie des tableaux compacts `[date, valeur]` au
  lieu du JSON STA verbeux.
- `$top=600000` couvre les très longues séries.
- Traitement : concaténer les `data.value[].dataArray`, convertir la date en
  timestamp ms (`new Date(row[0]).getTime()`), puis `reverse()` (car récupéré
  en `desc`).
- Annuler la requête précédente si une nouvelle série est demandée (AbortController /
  annulation TanStack Query).

### Compteurs (pour la page d'accueil)
```
Things?$count=true&$top=0
Datastreams?$select=distinct:properties/serie_id&$count=true&$top=0
```

## Construction des URLs de téléchargement

Tout part du `serie_path` (champ `properties.serie_path` de la requête 5) et du
nom du paramètre (`ObservedProperty.name`).

```ts
const url_thredds_dodsC = thredds + seriePath            // base OPeNDAP
const url_thredds_html   = url_thredds_dodsC + ".html"   // formulaire Thredds
const url_netcdf         = netcdf + seriePath            // NetCDF direct
const url_csv            = csv + url_thredds_dodsC + "&variable="   + observedPropertyName
const url_graph          = graph + url_thredds_dodsC + "&y_variable=" + observedPropertyName
```

### Plage de dates
Format ISO `YYYY-MM-DDTHH:mm:ss` en UTC, suffixée :
```
&time_start=2023-01-01T00:00:00Z&time_end=2023-12-31T23:59:59Z
```

### Déclenchement
Simple `window.open(url, "_blank")`. Les services dap2csv / dap2graph génèrent
le fichier côté serveur — RIEN à réimplémenter côté front.

### Aperçu du graphe
Le graphe PNG s'affiche aussi en aperçu inline : `<img src={url_graph} />`.

## Cas particuliers
- Jeux de données « profile » (si `seriePath.includes('profile')`) : PAS de
  sélecteur de plage de dates, mais une option « colormap » (checkbox) qui
  s'ajoute en `&colormap=true|false` sur l'URL du graphe.
- DOI / citation : le `url_doi` vient de `MultiDatastreams/0/properties/url_doi`.
  Citation formatée via `https://citation.doi.org/format?doi=<doi>&style=apa&lang=fr-FR`.

## Migration vs ancien code
- `jQuery.getJSON` / `jQuery.ajax` → TanStack Query
- Highcharts Stock → Recharts (ou garder Highcharts si licence dispo)
- OpenLayers 3 → MapLibre GL
- Les services de téléchargement (dap2csv, dap2graph, Thredds) restent IDENTIQUES.
EOF
echo done