import type { PageLoad } from './$types';
import { get } from 'svelte/store';
import { translations } from '$lib/i18n';
import { normalizeLines, parseLinesParam } from '@/lines-param';
import { isBusLike } from '@/kvv-trias/vehicle';
import { PlatformType, isApiEnvelope } from '@/kvv-trias/types';
import type {
	StationDepartures,
	PlatformDepartures,
	Departure,
	LineOption
} from '@/kvv-trias/types';

const DEFAULT_STATION = 'de:08212:89';

export type UiModel = {
	stationId: string;
	eventType: 'dep' | 'arr';
	item: StationDepartures | null;
	error: { code: string; message: string } | null;
};

export const load: PageLoad = async ({ url, fetch }) => {
	const stationId = url.searchParams.get('stationId') ?? DEFAULT_STATION;
	const eventType = url.searchParams.get('eventType') === 'arr' ? 'arr' : 'dep';

	// The static line list is fetched per stop (GET /api/stop-lines) so the
	// full stop -> lines dataset stays out of the client bundle. A failure
	// here is not fatal: the filter just degrades to the live lines.
	//
	// The selected lines are passed to GET /api/departures so TRIAS only
	// returns the selected lines server-side; the client-side display filter
	// stays as a safety net (and as the fallback when the server cannot
	// resolve a selection). Later selections are shallow-routed with
	// `replaceState` and refetched by an effect (see +page.svelte) to keep
	// bookmarks working.
	const lines = parseLinesParam(url.searchParams);
	const [model, stationLines] = await Promise.all([
		_fetchDepartures(fetch, stationId, eventType, lines),
		_fetchStopLines(fetch, stationId)
	]);

	return { model, lines, stationLines };
};

// Fetches the static lines serving one stop from /api/stop-lines. Never
// throws — an unavailable or malformed response simply means "no static
// lines", leaving the filter to the live departures.
export async function _fetchStopLines(
	fetchFn: typeof fetch,
	stationId: string
): Promise<LineOption[]> {
	try {
		const res = await fetchFn(`/api/stop-lines?stationId=${encodeURIComponent(stationId)}`);
		if (!res.ok) return [];

		const json: unknown = await res.json();
		if (!isApiEnvelope<{ lines?: unknown }>(json) || !json.ok) return [];
		if (!Array.isArray(json.data.lines)) return [];

		return json.data.lines
			.filter(
				(line): line is LineOption =>
					!!line &&
					typeof line === 'object' &&
					typeof (line as LineOption).name === 'string' &&
					typeof (line as LineOption).vehicleType === 'string'
			)
			.map((line) => ({ name: line.name, vehicleType: line.vehicleType }));
	} catch {
		return [];
	}
}

function errorModel(
	stationId: string,
	eventType: 'dep' | 'arr',
	code: string,
	message: string
): UiModel {
	return { stationId, eventType, item: null, error: { code, message } };
}

export async function _fetchDepartures(
	fetchFn: typeof fetch,
	stationId: string,
	eventType: 'dep' | 'arr',
	lines: string[] = []
): Promise<UiModel> {
	try {
		let query = `stationId=${encodeURIComponent(stationId)}&eventType=${eventType}`;

		// The server resolves the selection to TRIAS LineRefs; an empty
		// selection omits the parameter so no filter is applied at all.
		if (lines.length > 0) {
			query += `&lines=${encodeURIComponent(lines.join(','))}`;
		}

		const res = await fetchFn(`/api/departures?${query}`);

		const text = await res.text();

		let json: unknown = null;
		try {
			json = text ? JSON.parse(text) : null;
		} catch {
			const strings = get(translations);
			return errorModel(stationId, eventType, 'BAD_RESPONSE', strings.error.invalidServerResponse);
		}

		if (isApiEnvelope<StationDepartures>(json)) {
			if (json.ok) {
				return { stationId, eventType, item: reviveDates(json.data), error: null };
			}
			return { stationId, eventType, item: null, error: json.error };
		}

		return errorModel(
			stationId,
			eventType,
			'BAD_RESPONSE',
			get(translations).error.unexpectedResponseFormat
		);
	} catch {
		return errorModel(stationId, eventType, 'NETWORK', get(translations).error.noConnectionShort);
	}
}

function reviveDates(data: StationDepartures): StationDepartures {
	for (const platform of data.platforms) {
		for (const departure of platform.departures) {
			departure.plannedTime = new Date(departure.plannedTime);
			departure.realTime = departure.realTime ? new Date(departure.realTime) : null;
		}
	}

	return data;
}

export function _extractPlatformNames(departures: StationDepartures | null): string[] {
	if (!departures) return [];

	return sortPlatforms(departures.platforms)
		.map((p) => p.platform.name)
		.filter((name) => name.trim().length > 0);
}

// Union of two platform-name lists, keeping the order of the first one.
// The sidebar options are remembered this way because a line-filtered refetch
// only contains the platforms of the selected lines; without the union the
// dropdown would shrink to those and the user could not add a conflicting
// platform filter any more.
export function _mergePlatformNames(current: string[], incoming: string[]): string[] {
	return [...new Set([...current, ...incoming])];
}

// Serializes query parameters for the address bar. `:` and `,` are legal
// unencoded in a query string, so they are un-escaped again to keep URLs like
// `stationId=de:08212:89&lines=S1,S4` readable and bookmarkable.
export function _serializeQuery(params: string[][]): string {
	return new URLSearchParams(params).toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}

// Comparison for line names: a leading digit run is the line number and
// compares numerically (1 < 2 < 11 < 12); a digit run after a letter is a
// prefix extension and compares lexicographically, so a line sorts next to
// its family (S5 < S51 < S7, S1 < S11 < S12 < S2). All other characters
// compare lexicographically.
function compareLineNames(a: string, b: string): number {
	let i = 0;
	let j = 0;

	while (i < a.length && j < b.length) {
		const ca = a[i];
		const cb = b[j];
		const aDigit = ca >= '0' && ca <= '9';
		const bDigit = cb >= '0' && cb <= '9';

		if (aDigit && bDigit) {
			let ia = i;
			let ib = j;
			while (ia < a.length && a[ia] >= '0' && a[ia] <= '9') ia++;
			while (ib < b.length && b[ib] >= '0' && b[ib] <= '9') ib++;

			const ra = a.slice(i, ia);
			const rb = b.slice(j, ib);

			if (i === 0) {
				const diff = Number(ra) - Number(rb);
				if (diff !== 0) return diff;
			} else if (ra !== rb) {
				return ra < rb ? -1 : 1;
			}
			i = ia;
			j = ib;
		} else if (ca !== cb) {
			return ca < cb ? -1 : 1;
		} else {
			i++;
			j++;
		}
	}

	return a.length - b.length;
}

// Sort order for the line filter: non-bus lines (trams, S-Bahn, regional)
// first, buses at the end — a rail replacement with them, because it runs as a
// bus even though the feed reports the replaced line's mode. Within a group,
// natural name comparison (1 < 2 < 17 < S1 < S11 < S2).
function compareLineOptions(a: LineOption, b: LineOption): number {
	const typeCmp =
		Number(isBusLike(a.name, a.vehicleType)) - Number(isBusLike(b.name, b.vehicleType));
	if (typeCmp !== 0) return typeCmp;

	return compareLineNames(a.name, b.name);
}

export function _extractLineOptions(departures: StationDepartures | null): LineOption[] {
	if (!departures) return [];

	// One entry per unique line name. The same name can serve as tram and bus
	// (e.g. "1"), so keep a non-bus representative when possible: rail colors
	// are the distinguishing ones on this site.
	const representatives = new Map<string, LineOption>();

	for (const platform of departures.platforms) {
		for (const departure of platform.departures) {
			const name = departure.lineName.trim();
			if (!name) continue;

			const current = representatives.get(name);
			if (
				!current ||
				(isBusLike(name, current.vehicleType) && !isBusLike(name, departure.vehicleType))
			) {
				representatives.set(name, { name, vehicleType: departure.vehicleType });
			}
		}
	}

	return [...representatives.values()].sort(compareLineOptions);
}

// Union of the static per-stop line list (GET /api/stop-lines, backed by
// src/lib/server/stop-lines.ts) and the lines visible in the live departures.
// The live data can add lines the static map does not know (new services,
// detours), and the static data adds lines that are not in the upcoming
// window (rare services) — that is the point of the static list. When both
// know a line, the non-bus representative wins, same rule as
// _extractLineOptions.
export function _mergeLineOptions(
	staticOptions: LineOption[],
	liveOptions: LineOption[]
): LineOption[] {
	const merged = new Map<string, LineOption>();

	for (const option of staticOptions) {
		merged.set(option.name, option);
	}

	for (const option of liveOptions) {
		const existing = merged.get(option.name);
		if (
			!existing ||
			(isBusLike(option.name, existing.vehicleType) && !isBusLike(option.name, option.vehicleType))
		) {
			merged.set(option.name, option);
		}
	}

	return [...merged.values()].sort(compareLineOptions);
}

// The filter keeps a badge for every selected line, even when that line has
// no departures right now (e.g. a once-a-day service the user bookmarked). Such
// a line has no known vehicle type, so its badge uses the default style unless
// the name identifies it (a replacement bus sorts and colours with the buses).
// It can still be toggled off or cleared from the URL.
export function _lineFilterOptions(options: LineOption[], selectedLines: string[]): LineOption[] {
	const known = new Set(options.map((option) => option.name));

	const missing = normalizeLines(selectedLines)
		.filter((name) => !known.has(name))
		.map((name) => ({ name, vehicleType: '' }));

	return [...options, ...missing].sort(compareLineOptions);
}

export function _filterByLineName(
	departures: StationDepartures | null,
	selectedLines: string[]
): PlatformDepartures[] {
	if (!departures) return [];

	const selected = normalizeLines(selectedLines);

	if (selected.length === 0) {
		return departures.platforms;
	}

	// No "nothing matched, show all" fallback: a selected line without current
	// departures (rare service) keeps the filter active and yields an empty
	// list, which the page renders as "no departures match this filter".
	const wanted = new Set(selected);

	return departures.platforms
		.map((platform) => ({
			...platform,
			departures: platform.departures.filter((departure) => wanted.has(departure.lineName.trim()))
		}))
		.filter((platform) => platform.departures.length > 0);
}

// Applies both sidebar filters to the station data.
export function _filterDepartures(
	departures: StationDepartures | null,
	selectedLines: string[],
	selectedPlatforms: string[]
): PlatformDepartures[] {
	if (!departures) return [];

	const hasLineFilter = normalizeLines(selectedLines).length > 0;
	const lineFiltered = _filterByLineName(departures, selectedLines);
	const sorted = sortPlatforms(lineFiltered);

	const selected = selectedPlatforms.map((s) => s.trim()).filter(Boolean);

	if (selected.length === 0) {
		return sorted;
	}

	// `departures` may already be the line-filtered server response, so a
	// selected platform that serves only other lines is simply absent from it.
	// When none of the selected platforms is served, the result is the empty
	// intersection — except without a line filter, where an unserved platform
	// means the live data changed and the stale selection is ignored so the
	// user is never stranded on a blank page.
	const served = new Set(departures.platforms.map((p) => p.platform.name));
	const selectedValid = selected.filter((p) => served.has(p));

	if (selectedValid.length === 0) {
		return hasLineFilter ? [] : sorted;
	}

	return sorted.filter((p) => selectedValid.includes(p.platform.name));
}

function sortPlatforms(platforms: PlatformDepartures[]): PlatformDepartures[] {
	const order = {
		[PlatformType.Rail]: 0,
		[PlatformType.Bus]: 1,
		[PlatformType.Unknown]: 2
	};

	return [...platforms].sort((a, b) => {
		const typeCmp = order[a.platform.type] - order[b.platform.type];
		if (typeCmp !== 0) return typeCmp;

		return a.platform.name.localeCompare(b.platform.name, undefined, {
			numeric: true,
			sensitivity: 'base'
		});
	});
}

export function _getPlatformKey(platformDep: PlatformDepartures, index: number): string {
	return `${platformDep.platform.type}-${platformDep.platform.name}-${index}`;
}

export function _getDepartureKey(
	departure: Departure,
	platform: PlatformDepartures['platform'],
	index: number
): string {
	const time = departure.plannedTime.getTime();

	// Upstream TRIAS sometimes returns several entries with the same line, time
	// and direction (e.g. duplicated StopEvents), so the index is needed to keep
	// keyed each blocks unique. Platform is included because the same vehicle
	// can appear on more than one platform.
	return `${platform.type}-${platform.name}-${departure.lineName}-${time}-${departure.direction.join('-')}-${index}`;
}
