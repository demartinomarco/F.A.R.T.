import type { LineOption } from '@/kvv-trias/types';
import stopLinesJson from '@/assets/stop-lines.json';

// Static stop -> lines mapping, generated offline from KVV data (see
// scripts/stop-lines/generate.mjs): the rail network comes from the KVV GTFS
// feed (all scheduled services, including rare ones), the bus network from a
// TRIAS probe, because KVV's GTFS does not contain bus lines.
//
// Server-only module: the full map never reaches the browser. The client
// queries one stop at a time through GET /api/stop-lines
// (src/routes/api/stop-lines/+server.ts), and the page unions the result with
// the lines visible in the live departures, so a once-daily service can be
// selected even when it is not in the upcoming window.
export type StopLinesEntry = {
	name: string;
	vehicleType: string;
};

export type StopLinesData = {
	generatedAt: string;
	asOf: string;
	sources: {
		gtfs: { url: string; feedVersion: string; note: string } | null;
		trias: { note: string } | null;
	};
	// Published line name -> internal TRIAS LineRefs, global over the whole
	// network. Collected by the generator's line-ref probe (see
	// scripts/stop-lines/generate.mjs): every observed StopEvent contributes
	// its LineRef under its PublishedLineName. KVV encodes the direction in
	// the ref (kvv:21003:E:H / :R) and DDB mirrors KVV services under its own
	// refs, so one line name normally maps to several refs.
	lines: Record<string, string[]>;
	stops: Record<string, StopLinesEntry[]>;
};

const data: StopLinesData = stopLinesJson as StopLinesData;

if (!data || typeof data.stops !== 'object' || data.stops === null) {
	throw new Error('stop-lines.json is malformed');
}

// TRIAS LineRefs look like "kvv:21003:E:H" or "ddb:920S5:D:H". The value is
// embedded in an XML request; the builder escapes it, but this is the
// contract the dataset has to hold regardless.
const LINE_REF_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;

/**
 * Resolves published line names to the union of their internal TRIAS
 * LineRefs, for use in a StopEventRequest LineFilter.
 *
 * Returns null when no server-side filtering should happen: either nothing
 * was selected, or at least one selected name has no known refs (a service
 * the probe never observed, or a dataset that predates the line-ref probe).
 * The caller must then fetch unfiltered — the client-side line filter still
 * keeps the display in sync (fail-open).
 */
export function resolveLineRefs(names: string[]): string[] | null {
	if (names.length === 0) return null;

	// Own-property lookup only: `names` comes from the URL, and a plain
	// `byName[name]` resolves prototype members for names like `constructor`
	// or `__proto__` (a function/object, not an array of refs), which then
	// throws when iterated. Such names are unknown lines, and unknown lines
	// must fail open like any other.
	const byName = data.lines ?? {};
	const refs = new Set<string>();
	for (const name of names) {
		const known = Object.hasOwn(byName, name) ? byName[name] : [];
		if (!Array.isArray(known) || known.length === 0) return null;
		for (const ref of known) {
			if (typeof ref === 'string' && LINE_REF_PATTERN.test(ref)) refs.add(ref);
		}
	}

	return refs.size > 0 ? [...refs] : null;
}

// Unknown station ids are valid input to GET /api/stop-lines (the endpoint
// returns an empty list for them), and the id space is unbounded. Misses must
// therefore not be cached per id, or a client walking the id space would grow
// this map forever; they share one empty array instead. Hits are bounded by
// the dataset.
const EMPTY_LINES: LineOption[] = [];

// The same station id always maps to the same list; cache it so repeated
// requests for the same stop do not rebuild the array.
const byStop = new Map<string, LineOption[]>();

export function linesForStop(stationId: string): LineOption[] {
	const cached = byStop.get(stationId);
	if (cached) return cached;

	const entries = Object.hasOwn(data.stops, stationId) ? data.stops[stationId] : [];
	if (entries.length === 0) return EMPTY_LINES;

	const lines: LineOption[] = entries
		.map((entry) => ({ name: entry.name, vehicleType: entry.vehicleType }))
		.filter((line) => line.name.length > 0);

	byStop.set(stationId, lines);
	return lines;
}
