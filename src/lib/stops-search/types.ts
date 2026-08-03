export type StopRow = {
  gid: string;
  place_name: string;
  stop_name: string;
  lon: number;
  lat: number;
};

export type SearchResult = {
  value: string;
  label: string;
  placeName: string;
  stopName: string;
  distanceKm?: number;
};

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type ScoredCandidate = {
  item: StopRow;
  textScore: number;
};