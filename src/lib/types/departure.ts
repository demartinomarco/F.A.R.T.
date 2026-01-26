export interface Root {
	parameters: Parameter[];
	dm: Dm;
	arr: Arr;
	dateTime: DateTime;
	dateRange: DateRange[];
	option: Option;
	servingLines: ServingLines;
	departureList: DepartureList[];
}

export interface Parameter {
	name: string;
	value: string;
}

export interface Dm {
	input: Input;
	points: Points;
	itdOdvAssignedStops: ItdOdvAssignedStop[];
}

export interface Input {
	input: string;
}

export interface Points {
	point: Point;
}

export interface Point {
	usage: string;
	type: string;
	name: string;
	stateless: string;
	ref: Ref;
	infos: any;
}

export interface Ref {
	id: string;
	gid: string;
	omc: string;
	placeID: string;
	place: string;
	coords: string;
}

export interface ItdOdvAssignedStop {
	stopID: string;
	name: string;
	x: string;
	y: string;
	mapName: string;
	value: string;
	place: string;
	nameWithPlace: string;
	distanceTime: string;
	isTransferStop: string;
	vm: string;
	gid: string;
}

export interface Arr {
	input: Input;
	points: any;
}

export interface DateTime {
	deparr: string;
	ttpFrom: string;
	ttpTo: string;
	year: string;
	month: string;
	day: string;
	hour: string;
	minute: string;
}

export interface DateRange {
	day: string;
	month: string;
	year: string;
	weekday: string;
}

export interface Option {
	ptOption: PtOption;
}

export interface PtOption {
	active: string;
	maxChanges: string;
	maxTime: string;
	maxWait: string;
	routeType: string;
	changeSpeed: string;
	lineRestriction: string;
	useProxFootSearch: string;
	useProxFootSearchOrigin: string;
	useProxFootSearchDestination: string;
	bike: string;
	plane: string;
	noCrowded: string;
	noSolidStairs: string;
	noEscalators: string;
	noElevators: string;
	lowPlatformVhcl: string;
	wheelchair: string;
	needElevatedPlt: string;
	assistance: string;
	SOSAvail: string;
	noLonelyTransfer: string;
	illumTransfer: string;
	overgroundTransfer: string;
	noInsecurePlaces: string;
	privateTransport: string;
	excludedMeans: ExcludedMean[];
	activeImp: string;
	activeCom: string;
	activeSec: string;
}

export interface ExcludedMean {
	means: string;
	value: string;
	selected: string;
}

export interface ServingLines {
	lines: Line[];
}

export interface Line {
	mode: Mode;
	index: string;
	assignedStop: string;
	assignedStopID: string;
}

export interface Mode {
	name: string;
	number: string;
	product: string;
	productId: string;
	type: string;
	code: string;
	destination: string;
	destID: string;
	desc: string;
	timetablePeriod: string;
	diva: Diva;
}

export interface Diva {
	branch: string;
	line: string;
	supplement: string;
	dir: string;
	project: string;
	network: string;
	stateless: string;
	globalId: string;
	tripCode: string;
	operator: string;
	opPublicCode: string;
	opCode: string;
	vF: string;
	vTo: string;
	lineDisplay: string;
	attrs: Attr[];
}

export interface Attr {
	name: string;
	value: string;
}

export interface DepartureList {
	stopID: string;
	x: string;
	y: string;
	mapName: string;
	area: string;
	platform: string;
	platformName: string;
	stopName: string;
	nameWO: string;
	pointType: string;
	countdown: string;
	dateTime: DateTime;
	realDateTime: DateTime;
	realtimeTripStatus: string;
	servingLine: ServingLine;
	operator: Operator;
	attrs: Attr2[];
	occupancy?: string;
}

export interface ServingLine {
	key: string;
	code: string;
	number: string;
	symbol: string;
	motType: string;
	mtSubcode: string;
	realtime: string;
	direction: string;
	directionFrom: string;
	name: string;
	delay: string;
	hints: Hint[];
	liErgRiProj: LiErgRiProj;
	destID: string;
	stateless: string;
	lineDisplay: string;
	trainNum?: string;
	trainType?: string;
}

export interface Hint {
	content: string;
}

export interface LiErgRiProj {
	line: string;
	project: string;
	direction: string;
	supplement: string;
	network: string;
	gid: string;
}

export interface Operator {
	code: string;
	name: string;
	publicCode: string;
}

export interface Attr2 {
	name: string;
	value: string;
}

export interface ApiResponse {
	stationName: string;
	cityName: string;
	departureList: Departure[];
}

export interface Departure {
	lineName: string;
	direction: string;
	platformName: string;
	type: string;
	plannedTime: Date;
	realTime: Date | null;
}

export interface DeparturesByPlatform {
	platformName: string;
	departures: Departure[];
}
