export type EventType = 'dep' | 'arr';

export type ApiDeparture = {
	lineName: string;
	direction: string;
	platformName: string;
	plannedTime: Date;
	type: string;
	realTime: Date | null;
};

export type ApiResponse = {
	stationName: string;
	cityName: string;
	departureList: ApiDeparture[];
};
