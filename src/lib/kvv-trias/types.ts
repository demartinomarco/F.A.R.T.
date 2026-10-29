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
	situations: Disruption[];
	notServiced: boolean;
};

/**
 * A TRIAS/SIRI "PtSituation": a warning or info message from the operator
 * (track closures, diversions, line suspensions, ...).
 */
export type Disruption = {
	situationNumber: string;
	summary: string;
	description: string | null;
	detail: string | null; // raw HTML as supplied by the operator
	priority: number | null;
	scopeType: string | null;
	validFrom: Date | null;
	validUntil: Date | null;
	affectedStopIds: string[];
};

/** Machine-readable message from TRIAS, e.g. "stop not served" (code -4030). */
export type StationMessage = {
	code: string;
	text: string;
};

export type PlatformDepartures = {
	platform: Platform;
	departures: Departure[];
};

export type StationDepartures = {
	stationName: string;
	cityName: string;
	platforms: PlatformDepartures[];
	errorMessages: StationMessage[];
	stationSituations: Disruption[];
};

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export function isApiEnvelope<T>(x: any): x is ApiEnvelope<T> {
	return !!x && typeof x === 'object' && typeof x.ok === 'boolean';
}
