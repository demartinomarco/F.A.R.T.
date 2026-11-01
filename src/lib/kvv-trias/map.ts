import type { Departure, Platform } from './types';
import { PlatformType } from './types';
import { utcIsoToBerlinDate } from './time';

export type MappedDeparture = {
	platform: Platform;
	departure: Departure;
};

type InternalDeparture = MappedDeparture & {
	lineRef: string;
	origin?: string | null;
	journeyRef?: string | null;
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
		origin: readText(service?.OriginText),
		journeyRef: readText(service?.JourneyRef),
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

	// TRIAS sometimes repeats the exact same StopEvent (most notably once with
	// an EstimatedTime and once without). Those repetitions describe one
	// vehicle, not an extra wagon, so collapse them before counting.
	for (const current of removeDuplicateDbDepartures(dedupeIdenticalStopEvents(departures))) {
		const group = groups.find((existing) => isSameDeparture(existing, current));

		if (!group) {
			groups.push({
				departure: cloneDeparture(current),
				lineRefs: new Set([current.lineRef]),
				wagonsByProvider: new Map([[providerOf(current.lineRef), current.departure.wagonCount]])
			});
			continue;
		}

		const existing = group.departure;
		group.lineRefs.add(current.lineRef);

		// Count wagons per provider first. Two entries from the same provider
		// are separate vehicles (for example coupled units), while the same
		// vehicle is reported once by each feed. The final count is therefore
		// the highest total reported by any single feed, not the sum across
		// feeds.
		const provider = providerOf(current.lineRef);
		group.wagonsByProvider.set(
			provider,
			(group.wagonsByProvider.get(provider) ?? 0) + current.departure.wagonCount
		);
		existing.departure.wagonCount = Math.max(...group.wagonsByProvider.values());

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

	// Strip the internal fields before returning.
	return groups.map(({ departure }) => ({
		platform: departure.platform,
		departure: departure.departure
	}));
}

type DepartureGroup = {
	departure: InternalDeparture;
	lineRefs: Set<string>;
	wagonsByProvider: Map<string, number>;
};

/**
 * Collapses repeated StopEvents for the same physical vehicle.
 *
 * The upstream feed can return the same departure more than once (typically
 * once with real-time data and once without). A repeated entry has the same
 * provider, line, planned time, platform, origin, destination and journey;
 * only its ResultId/EstimatedTime differ, so those fields must not be part of
 * the key. Entries that differ in journey or destination are kept separate so
 * that genuinely coupled units still count as more than one vehicle.
 */
function dedupeIdenticalStopEvents(departures: InternalDeparture[]): InternalDeparture[] {
	const unique: InternalDeparture[] = [];
	const bySignature = new Map<string, InternalDeparture[]>();

	for (const current of departures) {
		const signature = stopEventSignature(current);
		const candidates = bySignature.get(signature) ?? [];
		const existing = candidates.find((candidate) => isSameJourney(candidate, current));

		if (!existing) {
			const copy = cloneDeparture(current);
			candidates.push(copy);
			bySignature.set(signature, candidates);
			unique.push(copy);
			continue;
		}

		if (!existing.departure.realTime && current.departure.realTime) {
			existing.departure.realTime = current.departure.realTime;
		}

		existing.departure.wagonCount = Math.max(
			existing.departure.wagonCount,
			current.departure.wagonCount
		);
	}

	return unique;
}

/**
 * A repeated StopEvent carries the same JourneyRef. If both entries name a
 * journey and the names differ, they are two distinct vehicles and must not be
 * collapsed even when line, time, platform and destination happen to match.
 */
function isSameJourney(a: InternalDeparture, b: InternalDeparture): boolean {
	if (!a.journeyRef || !b.journeyRef) return true;
	return a.journeyRef === b.journeyRef;
}

function stopEventSignature(departure: InternalDeparture): string {
	const line = normalizeLineName(departure.departure.lineName) || departure.lineRef;
	const directions = [...departure.departure.direction].map(normalizeDirection).sort().join('|');

	return [
		providerOf(departure.lineRef),
		line,
		departure.departure.plannedTime.toISOString(),
		departure.platform.type,
		departure.platform.name,
		normalizePlaceName(departure.origin),
		directions
	].join('\u0000');
}

function providerOf(lineRef: string): string {
	const separator = lineRef.indexOf(':');
	return separator === -1 ? lineRef : lineRef.slice(0, separator);
}

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

const DUPLICATE_TIME_TOLERANCE_MS = 90_000;

/**
 * DDB mirrors many KVV-operated services. Those entries often omit the platform
 * or use a different label for a short turn, so the normal cross-feed merge
 * cannot recognize them. Drop a DDB entry when a KVV entry for the same line
 * departs within the same time window AND travels in the same direction.
 *
 * Both the origin and the destination must match. A short turn only shares its
 * origin with the KVV departure, so treating it as a duplicate would silently
 * discard the more specific DDB destination. Unique DDB services (for example
 * long-distance trains at a real station) have no KVV counterpart and are kept.
 */
function removeDuplicateDbDepartures(departures: InternalDeparture[]): InternalDeparture[] {
	const kvvDepartures = departures.filter((departure) => providerOf(departure.lineRef) === 'kvv');

	if (kvvDepartures.length === 0) return departures;

	return departures.filter((departure) => {
		if (providerOf(departure.lineRef) !== 'ddb') return true;

		const counterpart = findClosestKvvCounterpart(departure, kvvDepartures);
		if (!counterpart) return true;

		// KVV is authoritative for these services, but keep useful data that
		// only the DDB feed supplied. This only happens for a confident match.
		if (!counterpart.departure.realTime && departure.departure.realTime) {
			counterpart.departure.realTime = departure.departure.realTime;
		}
		if (
			counterpart.platform.type === PlatformType.Unknown &&
			departure.platform.type !== PlatformType.Unknown
		) {
			counterpart.platform = { ...departure.platform };
		}

		return false;
	});
}

function findClosestKvvCounterpart(
	ddb: InternalDeparture,
	kvvDepartures: InternalDeparture[]
): InternalDeparture | null {
	let closest: InternalDeparture | null = null;
	let closestDelta = Number.POSITIVE_INFINITY;

	for (const kvv of kvvDepartures) {
		if (!isDuplicateDbDeparture(ddb, kvv)) continue;

		const delta = Math.abs(
			ddb.departure.plannedTime.getTime() - kvv.departure.plannedTime.getTime()
		);
		if (delta < closestDelta) {
			closest = kvv;
			closestDelta = delta;
		}
	}

	return closest;
}

function isDuplicateDbDeparture(ddb: InternalDeparture, kvv: InternalDeparture): boolean {
	if (!ddb.departure.lineName || !kvv.departure.lineName) return false;
	if (normalizeLineName(ddb.departure.lineName) !== normalizeLineName(kvv.departure.lineName)) {
		return false;
	}

	const timeDelta = Math.abs(
		ddb.departure.plannedTime.getTime() - kvv.departure.plannedTime.getTime()
	);
	if (timeDelta > DUPLICATE_TIME_TOLERANCE_MS) return false;
	if (!platformsAreCompatible(ddb.platform, kvv.platform)) return false;

	// Both endpoints have to agree. Matching only one of them merges real
	// opposite-direction services (same origin/destination swapped) and
	// short turns (different destination) into the wrong KVV departure.
	return (
		placesMatch(ddb.origin, kvv.origin) &&
		sharesPlace(ddb.departure.direction, kvv.departure.direction)
	);
}

function platformsAreCompatible(a: Platform, b: Platform): boolean {
	// A missing platform is not evidence of a different service.
	if (a.type === PlatformType.Unknown || b.type === PlatformType.Unknown) return true;
	return a.type === b.type && a.name === b.name;
}

function sharesPlace(a: string[], b: string[]): boolean {
	return a.some((left) => b.some((right) => placesMatch(left, right)));
}

function placesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
	const left = normalizePlaceName(a);
	const right = normalizePlaceName(b);

	if (!left || !right) return false;

	return left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

function normalizePlaceName(value: string | null | undefined): string {
	return (value ?? '')
		.toLowerCase()
		.replace(/\([^)]*\)/g, ' ')
		.replace(/[^a-z0-9äöüß]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function normalizeLineName(value: string): string {
	return value.trim().toLowerCase();
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
	const trimmed = platformName?.trim() ?? '';

	if (trimmed === '')
		return {
			type: PlatformType.Unknown,
			name: ''
		};

	if (/^Gleis/i.test(trimmed)) {
		return {
			type: PlatformType.Rail,
			name: normalizePlatformName(trimmed.replace(/^Gleis\.?\s*/i, ''))
		};
	} else if (/^Bstg\.?/i.test(trimmed)) {
		return {
			type: PlatformType.Bus,
			name: normalizePlatformName(trimmed.replace(/^Bstg\.?\s*/i, ''))
		};
	}

	return {
		type: PlatformType.Rail,
		name: normalizePlatformName(trimmed)
	};
}

function normalizePlatformName(platformName: string): string {
	const normalized = platformName.trim().replace(/\s+/g, ' ').replace(/\.+$/, '');

	// Different TRIAS producers use different spellings for the same track:
	// KVV sends "Gleis 1b" / "Gleis 1(U)", while DDB sends "1B" / "1U.".
	// Normalize the spacing and suffix case; keep "(U)" for underground tracks.
	const suffix = normalized.match(/^(\d+)\s*([A-Za-z])$/);
	if (suffix) {
		const letter = suffix[2].toUpperCase();
		return letter === 'U' ? `${suffix[1]}(U)` : `${suffix[1]}${letter}`;
	}

	// Normalize whitespace and case inside suffixes such as "1 (b)".
	return normalized.replace(/^(\d+)\s*\(\s*([A-Za-z])\s*\)$/, (_, number, suffix) => {
		return `${number}(${suffix.toUpperCase()})`;
	});
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
