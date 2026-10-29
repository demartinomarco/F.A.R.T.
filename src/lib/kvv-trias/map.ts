import type { Departure, Disruption, Platform, StationMessage } from './types';
import { PlatformType } from './types';
import { utcIsoToBerlinDate } from './time';
import { collectNodes } from './parse';

export type MappedDeparture = {
	platform: Platform;
	departure: Departure;
};

type InternalDeparture = MappedDeparture & {
	lineRef: string;
};

export function mapStopEventResultToDeparture(
	r: any,
	situationsByNumber: Map<string, Disruption> = new Map()
): InternalDeparture | null {
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
			wagonCount: 1,
			situations: resolveSituationRefs(
				[callAtStop?.SituationFullRef, service?.SituationFullRef],
				situationsByNumber
			),
			notServiced: isFlagTrue(callAtStop?.NotServicedStop)
		}
	};
}

/**
 * Resolves SituationFullRef nodes ({ParticipantRef, SituationNumber}) against the
 * delivered situation map. Refs may come from CallAtStop, Service or both, singly
 * or repeated; unknown/unresolvable refs are skipped silently.
 */
function resolveSituationRefs(
	refNodes: unknown,
	situationsByNumber: Map<string, Disruption>
): Disruption[] {
	const resolved = new Map<string, Disruption>();

	for (const group of collectNodes(refNodes)) {
		for (const ref of collectNodes(group)) {
			const number = readText((ref as any)?.SituationNumber);
			if (!number) continue;

			const situation = situationsByNumber.get(number);
			// Dedupe: the same situation is usually referenced by both wagons of
			// a multiple-unit and by Service *and* CallAtStop.
			if (situation && !resolved.has(number)) {
				resolved.set(number, situation);
			}
		}
	}

	return [...resolved.values()];
}

function isFlagTrue(v: unknown): boolean {
	return v === true || v === 'true' || v === 1 || v === '1';
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
				existing.platform.type === current.platform.type &&
				existing.platform.name === current.platform.name
		);

		if (match) {
			match.departure.wagonCount += current.departure.wagonCount;
			mergeSituationState(match.departure, current.departure);

			// Prefer non-null realTime
			if (!match.departure.realTime && current.departure.realTime) {
				match.departure.realTime = current.departure.realTime;
			}

			// Combine directions without duplicates
			for (const dir of current.departure.direction) {
				if (!match.departure.direction.includes(dir)) {
					match.departure.direction.push(dir);
				}
			}
		} else {
			uniqueDepartures.push({
				...current,
				departure: {
					...current.departure,
					direction: [...current.departure.direction]
				}
			});
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

// ---------------------------------------------------------------------------
// Situations (warnings / info messages) and ErrorMessages
// ---------------------------------------------------------------------------

export function mapSituationNode(node: any): Disruption | null {
	if (!node || typeof node !== 'object') return null;

	const situationNumber = readText(node.SituationNumber);
	if (!situationNumber) return null; // unusable without an identity

	const validityPeriod = collectNodes(node.ValidityPeriod)[0] as
		| { StartTime?: unknown; EndTime?: unknown }
		| undefined;

	return {
		situationNumber,
		summary: htmlToPlainText(readText(node.Summary)) ?? '',
		description: htmlToPlainText(readText(node.Description)),
		detail: htmlToPlainText(readText(node.Detail)),
		priority: parseIntStrict(node.Priority),
		scopeType: readText(node.ScopeType),
		validFrom: parseTriasDate(validityPeriod?.StartTime),
		validUntil: parseTriasDate(validityPeriod?.EndTime),
		affectedStopIds: extractAffectedStopRefs(node.Affects)
	};
}

export function mapErrorMessageNode(node: any): StationMessage | null {
	if (!node || typeof node !== 'object') return null;

	const text = readText(node.Text);
	if (!text) return null;

	return {
		code: readText(node.Code) ?? '',
		text
	};
}

function extractAffectedStopRefs(affects: unknown): string[] {
	const ids: string[] = [];

	for (const affect of collectNodes(affects)) {
		for (const stopPoints of collectNodes((affect as any)?.StopPoints)) {
			for (const affected of collectNodes((stopPoints as any)?.AffectedStopPoint)) {
				const ref = readText((affected as any)?.StopPointRef);
				if (ref && !ids.includes(ref)) ids.push(ref);
			}
		}
	}

	return ids;
}

/** TRIAS dates can be ISO strings or epoch values; both are tolerated. */
function parseTriasDate(v: unknown): Date | null {
	if (typeof v === 'number') {
		const d = new Date(v);
		return Number.isNaN(d.getTime()) ? null : d;
	}

	if (typeof v !== 'string' || v === '') return null;

	return utcIsoToBerlinDate(v);
}

function parseIntStrict(v: unknown): number | null {
	const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
	return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Operator HTML -> safe plain text
// ---------------------------------------------------------------------------

// Entities the KVV likes to use that fast-xml-parser does not decode.
const NAMED_ENTITIES: Record<string, string> = {
	nbsp: ' ',
	ndash: '–',
	mdash: '—',
	hellip: '…',
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	auml: 'ä',
	ouml: 'ö',
	uuml: 'ü',
	Auml: 'Ä',
	Ouml: 'Ö',
	Uuml: 'Ü',
	szlig: 'ß',
	laquo: '«',
	raquo: '»',
	deg: '°',
	micro: 'µ',
	bull: '•',
	plusmn: '±',
	sect: '§',
	agrave: 'à',
	aacute: 'á',
	acirc: 'â',
	ccedil: 'ç',
	egrave: 'è',
	eacute: 'é',
	ecirc: 'ê',
	ograve: 'ò',
	oacute: 'ó',
	ugrave: 'ù'
};

/**
 * Converts the operator's HTML fragments (with HTML entities) into plain text,
 * so the frontend never has to render markup from a third party. Unknown
 * entities are left as-is; malformed input degrades to the raw string.
 */
export function htmlToPlainText(s: string | null): string | null {
	if (s == null) return null;
	if (typeof s !== 'string') return null;

	let text = s
		// Block-ish structure first
		.replace(/&nbsp;/g, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|h[1-6]|tr|li|ul|ol|table)>/gi, '\n')
		.replace(/<li[^>]*>/gi, '• ')
		// Everything else that looks like a tag goes away
		.replace(/<[^>]*>/g, '');

	text = text
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
		.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (whole, name) => NAMED_ENTITIES[name] ?? whole);

	return (
		text
			.split('\n')
			.map((line) => line.replace(/[ \t]+/g, ' ').trim())
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim() || null
	);
}

function safeCodePoint(code: number): string {
	return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

/**
 * Merges situation/flag state when consolidating duplicate wagon entries of the
 * same journey: situations are combined without duplicates, "not serviced" wins
 * if any of the merged entries carries the flag.
 */
export function mergeSituationState(target: Departure, source: Departure): void {
	target.notServiced = target.notServiced || source.notServiced;

	const seen = new Set(target.situations.map((s) => s.situationNumber));
	for (const situation of source.situations ?? []) {
		if (!seen.has(situation.situationNumber)) {
			seen.add(situation.situationNumber);
			target.situations.push(situation);
		}
	}
}
