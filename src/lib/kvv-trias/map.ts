import type { Departure, Platform } from './types';
import { PlatformType } from './types';
import { utcIsoToBerlinDate } from './time';

export type MappedDeparture = {
	platform: Platform;
	departure: Departure;
};

type InternalDeparture = MappedDeparture & {
	lineRef: string;
};

export function mapStopEventResultToDeparture(r: any): InternalDeparture | null {
	const stopEvent = r?.StopEvent;
	const callAtStop = stopEvent?.ThisCall?.CallAtStop;

	const serviceDep = callAtStop?.ServiceDeparture;
	const serviceArr = callAtStop?.ServiceArrival;

	const timetabled = serviceDep?.TimetabledTime ?? serviceArr?.TimetabledTime;
	const estimated = serviceDep?.EstimatedTime ?? serviceArr?.EstimatedTime;

	const plannedTime = utcIsoToBerlinDate(timetabled);
	if (!plannedTime) return null;

	const realTime = utcIsoToBerlinDate(estimated);

	const service = stopEvent?.Service;
	const direction = readText(service?.DestinationText);

	return {
		lineRef: service?.LineRef ?? '',
		platform: extractPlatform(readText(callAtStop?.PlannedBay)),
		departure: {
			lineName: extractLineName(service),
			direction: direction ? [direction] : [],
			vehicleType: extractVehicleType(service),
			plannedTime,
			realTime
		}
	};
}

function extractVehicleType(service: any): string {
	return (
		(typeof service?.Mode?.PtMode === 'string' ? service.Mode.PtMode : null) ??
		readText(service?.Mode?.Name) ??
		''
	);
}

export function consolidateWagons(departures: InternalDeparture[]): MappedDeparture[] {
	const uniqueDepartures: InternalDeparture[] = [];

	for (const current of departures) {
		const match = uniqueDepartures.find(
			(existing) =>
				existing.lineRef === current.lineRef &&
				existing.departure.plannedTime.getTime() === current.departure.plannedTime.getTime() &&
				existing.departure.realTime?.getTime() === current.departure.realTime?.getTime() &&
				existing.platform.type === current.platform.type &&
				existing.platform.name === current.platform.name
		);

		if (!match) {
			uniqueDepartures.push(current);
		}
	}

	// Strip the internal lineRef before returning.
	return uniqueDepartures.map(({ lineRef, ...mappedDeparture }) => mappedDeparture);
}

/**
 * Reads TRIAS "Text" nodes that can be:
 * - "3"
 * - 3
 * - { Text: "3", Language: "de" }
 * - arrays of the above
 */
function readText(node: any): string | null {
	if (node == null) return null;

	if (typeof node === 'string') return node;
	if (typeof node === 'number') return String(node);

	if (Array.isArray(node)) {
		for (const item of node) {
			const t = readText(item);
			if (t) return t;
		}
		return null;
	}

	if (typeof node !== 'object') return null;

	const t = node.Text;
	if (typeof t === 'string') return t;
	if (typeof t === 'number') return String(t);

	// Some parsers can nest Text again
	if (t && typeof t === 'object') {
		const t2 = (t as any).Text;
		if (typeof t2 === 'string') return t2;
		if (typeof t2 === 'number') return String(t2);
	}

	return null;
}

function extractPlatform(platformName: string | null): Platform {
	if (platformName === null || platformName === '')
		return {
			type: PlatformType.Unknown,
			name: ''
		};

	if (platformName.startsWith('Gleis')) {
		return {
			type: PlatformType.Rail,
			name: platformName.substring(6)
		};
	} else if (platformName.startsWith('Bstg.')) {
		return {
			type: PlatformType.Bus,
			name: platformName.substring(6)
		};
	}

	return {
		type: PlatformType.Rail,
		name: platformName
	};
}

function extractLineName(service: any): string {
	const published = readText(service?.PublishedLineName);
	if (published) return published;

	const publishedService = readText(service?.PublishedServiceName);
	if (publishedService) return publishedService;

	const lineRef: string | null =
		typeof service?.LineRef === 'string' ? service.LineRef : readText(service?.LineRef);

	if (lineRef) {
		const m = lineRef.match(/kvv:(\d+)/);
		if (m?.[1]) {
			const digits = m[1].replace(/^0+/, '');
			// heuristic: "21003" -> "3", "24050" -> "50"
			const last2 = digits.slice(-2);
			const last1 = digits.slice(-1);
			return last2.startsWith('0') ? last1 : last2;
		}
	}

	return '';
}
