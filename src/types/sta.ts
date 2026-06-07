// Standard STA response envelope
export interface STAResponse<T> {
  "@iot.count"?: number;
  "@iot.nextLink"?: string;
  value: T[];
}

export interface Sensor {
  properties: {
    family?: string;
  };
}

// Physical parameter (temperature, salinity, …)
export interface ObservedProperty {
  "@iot.id": number;
  name?: string;
  description: string;
}

// GeoJSON Point location attached to a Thing
export interface STALocation {
  "@iot.id"?: number;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface MultiDatastream {
  "@iot.id": number;
  name: string;
  phenomenonTime?: string;
  properties: {
    network_name?: string;
    network_description?: string;
    url_doi?: string;
    uuid_catalog?: string;
    multiserie_id?: string;
    depth?: number;
    type?: string;
    processing_level?: string;
    serie_ids?: number[];
  };
  ObservedProperties?: ObservedProperty[];
  Sensor?: Sensor;
}

// Thing = monitoring station
export interface Thing {
  "@iot.id": number;
  name: string;
  description?: string;
  properties: {
    code?: string;
    active: "true" | "false";
    center?: string;
    center_description?: string;
    pi_name?: string;
    pi_description?: string;
    pi_email?: string;
  };
  Locations: STALocation[];
  MultiDatastreams?: MultiDatastream[];
}

export interface UnitOfMeasurement {
  name: string;
  symbol?: string;
  definition?: string;
}

// Datastream = individual time series
export interface Datastream {
  "@iot.id"?: number;
  phenomenonTime?: string;
  unitOfMeasurement?: UnitOfMeasurement;
  properties: {
    serie_id?: number;
    network_name?: string;
    depth?: number;
    type?: string;
    processing_level?: string;
    processing_level_code?: string;
    serie_name?: string;
    serie_path?: string;
    serie_start_date?: string;
    serie_end_date?: string;
  };
  ObservedProperty?: ObservedProperty;
  Sensor?: Sensor;
}

// Observations returned with $resultFormat=DataArray
export interface ObservationDataArrayResponse {
  "@iot.count"?: number;
  value: Array<{
    components: string[];
    dataArray: [string, number | null][];
  }>;
}

// Processed observation point ready for Recharts
export interface ObservationPoint {
  time: number; // Unix timestamp in ms
  value: number;
}
