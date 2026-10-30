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
			realTime,
			wagonCount: 1
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
	const groups: DepartureGroup[] = [];

	for (const current of departures) {
		const group = groups.find((existing) => isSameDeparture(existing, current));

		if (!group) {
			groups.push({
				departure: cloneDeparture(current),
				lineRefs: new Set([current.lineRef]),
				wagonsByLineRef: new Map([[current.lineRef, current.departure.wagonCount]])
			});
			continue;
		}

		const existing = group.departure;
		group.lineRefs.add(current.lineRef);

		// Count wagons per line ref first. Entries sharing a line ref belong to the
		// same feed/journey family, so their wagons add up (coupled units). The
		// same vehicle is then reported once per feed, so the final count is the
		// highest total reported by any single feed, not the sum across feeds.
		group.wagonsByLineRef.set(
			current.lineRef,
			(group.wagonsByLineRef.get(current.lineRef) ?? 0) + current.departure.wagonCount
		);
		existing.departure.wagonCount = Math.max(...group.wagonsByLineRef.values());

		// Prefer non-null realTime
		if (!existing.departure.realTime && current.departure.realTime) {
			existing.departure.realTime = current.departure.realTime;
		}

		// Combine directions without duplicates
		for (const dir of current.departure.direction) {
			const normalized = normalizeDirection(dir);
			const alreadyKnown = existing.departure.direction.some(
				(existingDirection) => normalizeDirection(existingDirection) === normalized
			);

			if (!alreadyKnown) {
				existing.departure.direction.push(dir);
			}
		}
	}

	// Strip the internal lineRef before returning.
	return groups.map(({ departure: { lineRef, ...mappedDeparture } }) => mappedDeparture);
}

type DepartureGroup = {
	departure: InternalDeparture;
	lineRefs: Set<string>;
	wagonsByLineRef: Map<string, number>;
};

function cloneDeparture(departure: InternalDeparture): InternalDeparture {
	return {
		...departure,
		platform: { ...departure.platform },
		departure: {
			...departure.departure,
			direction: [...departure.departure.direction]
		}
	};
}

/**
 * Decides whether a TRIAS stop event belongs to an existing departure group.
 *
 * The same vehicle can be reported multiple times:
 * - once per wagon, sharing a `LineRef` with another entry in the group
 *   (coupled trams), possibly with different destinations;
 * - once per data source, usually with different `LineRef` namespaces
 *   (e.g. `kvv:22305:E:R` and `ddb:920S5:D:H`).
 *
 * Checking every line ref seen in the group (not only the first one) keeps the
 * result independent of the order in which the feeds are interleaved. The
 * cross-feed case needs the line name and a shared destination so that two
 * opposite-direction trains leaving the same platform at the same time are not
 * merged.
 */
function isSameDeparture(group: DepartureGroup, b: InternalDeparture): boolean {
	const a = group.departure;

	if (a.departure.plannedTime.getTime() !== b.departure.plannedTime.getTime()) return false;
	if (a.platform.type !== b.platform.type || a.platform.name !== b.platform.name) return false;

	if (group.lineRefs.has(b.lineRef)) return true;

	if (!a.departure.lineName || a.departure.lineName !== b.departure.lineName) return false;

	return sharesDirection(a.departure.direction, b.departure.direction);
}

function sharesDirection(a: string[], b: string[]): boolean {
	// A missing destination cannot be compared, so keep the merge permissive.
	if (a.length === 0 || b.length === 0) return true;

	const directions = new Set(a.map(normalizeDirection));
	return b.some((direction) => directions.has(normalizeDirection(direction)));
}

function normalizeDirection(direction: string): string {
	return direction.trim().toLowerCase();
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
