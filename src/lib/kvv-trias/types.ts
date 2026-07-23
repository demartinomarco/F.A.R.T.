export type EventType = 'dep' | 'arr';

export enum PlatformType {
	RailPlatform,
	BusBay,
	Unkown
}

export type Platform = {
	type: PlatformType;
	name: string;
};

export type ApiDeparture = {
	lineName: string;
	direction: string;
	platform: Platform;
	plannedTime: Date;
	type: string;
	realTime: Date | null;
};

export type ApiResponse = {
	stationName: string;
	cityName: string;
	departureList: ApiDeparture[];
};
