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
};

export type PlatformDepartures = {
	platform: Platform;
	departures: Departure[];
};

export type StationDepartures = {
	stationName: string;
	cityName: string;
	platforms: PlatformDepartures[];
};
