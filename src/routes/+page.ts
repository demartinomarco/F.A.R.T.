import type { PageLoad } from './$types';
import { get } from 'svelte/store';
import { translations } from '$lib/i18n';
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

export const _LINES_PARAM = 'lines';

export const load: PageLoad = async ({ url, fetch }) => {
	const stationId = url.searchParams.get('stationId') ?? DEFAULT_STATION;
	const eventType = url.searchParams.get('eventType') === 'arr' ? 'arr' : 'dep';

	const model = await _fetchDepartures(fetch, stationId, eventType);

	// The line filter is display-only: `load` parses it so SSR and hydration
	// render pre-filtered, but it never reaches the API. Later selections are
	// synced with `replaceState` (see +page.svelte) to keep bookmarks working
	// without refetching on every toggle.
	return { model, lines: _parseLinesParam(url.searchParams) };
};

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
	eventType: 'dep' | 'arr'
): Promise<UiModel> {
	try {
		const res = await fetchFn(
			`/api/departures?stationId=${encodeURIComponent(stationId)}&eventType=${eventType}`
		);

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

const BUS_VEHICLE_TYPES = new Set(['bus', 'Regionalbus', 'Stadtbus']);

function isBusLike(vehicleType: string): boolean {
	return BUS_VEHICLE_TYPES.has(vehicleType);
}

// The `lines` parameter is attacker-controlled (bookmarked/typed URLs). Keep
// parsing bounded so a hostile value cannot blow up memory, freeze the
// selection state, or force the page to render an unbounded badge list.
const MAX_LINES_PARAM_LENGTH = 8192;
const MAX_LINES = 100;
const MAX_LINE_NAME_LENGTH = 50;

// Parses the `lines` GET parameter: comma-separated line names. Invalid or
// empty input yields an empty selection. Overlong values are truncated before
// splitting, because the split is the only step that scales with the raw
// input length.
export function _parseLinesParam(searchParams: URLSearchParams): string[] {
	const raw = searchParams.get(_LINES_PARAM);
	if (!raw) return [];

	return normalizeLines(raw.slice(0, MAX_LINES_PARAM_LENGTH).split(','));
}

// Serializes the selection for the URL. Empty selection becomes the empty
// string, which means the parameter should be removed entirely.
export function _serializeLines(lines: string[]): string {
	return normalizeLines(lines).join(',');
}

// Serializes query parameters for the address bar. `:` and `,` are legal
// unencoded in a query string, so they are un-escaped again to keep URLs like
// `stationId=de:08212:89&lines=S1,S4` readable and bookmarkable.
export function _serializeQuery(params: string[][]): string {
	return new URLSearchParams(params).toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}

// Control characters (NUL, tabs) and format characters (zero-width spaces,
// bidi overrides) have no business in a line name. Stripping them from URL
// input keeps badges from rendering browser-mangled or visually spoofed text.
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu;

function normalizeLines(lines: string[]): string[] {
	const seen = new Set<string>();

	for (const line of lines) {
		const name = line.replace(INVISIBLE_CHARS, '').trim();
		// Names longer than a plausible line name are never a real service and
		// would otherwise become oversized ghost badges.
		if (!name || name.length > MAX_LINE_NAME_LENGTH) continue;
		seen.add(name);
		if (seen.size >= MAX_LINES) break;
	}

	return [...seen];
}

// Sort order for the line filter: non-bus lines (trams, S-Bahn, regional)
// first, buses at the end. Within a group, plain name comparison (1 < 2 <
// S1 < S11 < S2).
function compareLineOptions(a: LineOption, b: LineOption): number {
	const typeCmp = Number(isBusLike(a.vehicleType)) - Number(isBusLike(b.vehicleType));
	if (typeCmp !== 0) return typeCmp;

	return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
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
			if (!current || (isBusLike(current.vehicleType) && !isBusLike(departure.vehicleType))) {
				representatives.set(name, { name, vehicleType: departure.vehicleType });
			}
		}
	}

	return [...representatives.values()].sort(compareLineOptions);
}

// The filter keeps a badge for every selected line, even when that line has
// no departures right now (e.g. a once-a-day service the user bookmarked).
// Such lines render with the default badge style and can still be toggled
// off or cleared from the URL.
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

	const lineFiltered = _filterByLineName(departures, selectedLines);
	const sorted = sortPlatforms(lineFiltered);

	const selected = selectedPlatforms.map((s) => s.trim()).filter(Boolean);

	if (selected.length === 0) {
		return sorted;
	}

	// Platform staleness is judged against the station's full platform list,
	// not the line-filtered subset: a platform the station serves but that
	// none of the selected lines call at stays filtered out (empty result),
	// while a platform that vanished from the live data entirely is ignored so
	// the user is never stranded on a blank page.
	const served = new Set(departures.platforms.map((p) => p.platform.name));
	const selectedValid = selected.filter((p) => served.has(p));

	if (selectedValid.length === 0) {
		return sorted;
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
