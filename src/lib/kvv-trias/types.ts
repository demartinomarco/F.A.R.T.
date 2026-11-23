export type EventType = 'dep' | 'arr';

export enum PlatformType {
	Rail = 'rail',
	Bus = 'bus',
	Unknown = 'unknown'
}

export type Platform = {
	type: PlatformType;
	name: string;
};

export type Departure = {
	lineName: string;
	direction: string[];
	plannedTime: Date;
	vehicleType: string;
	realTime: Date | null;
	wagonCount: number;
	cancelled: boolean;
};

export type PlatformDepartures = {
	platform: Platform;
	departures: Departure[];
};

// Representative data per unique line name, enough for LineIcon to pick the
// right badge colors (which depend on lineName and vehicleType).
export type LineOption = {
	name: string;
	vehicleType: string;
};

export type StationDepartures = {
	stationName: string;
	cityName: string;
	platforms: PlatformDepartures[];
};

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export function isApiEnvelope<T>(x: any): x is ApiEnvelope<T> {
	return !!x && typeof x === 'object' && typeof x.ok === 'boolean';
}
