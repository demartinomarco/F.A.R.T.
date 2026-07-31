import type { PageLoad } from './$types';
import { get } from 'svelte/store';
import { translations } from '$lib/i18n';
import { PlatformType, isApiEnvelope } from '@/kvv-trias/types';
import type { StationDepartures, PlatformDepartures, Departure } from '@/kvv-trias/types';

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

	const model = await _fetchDepartures(fetch, stationId, eventType);

	return { model };
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

export function _filterByPlatformName(
	departures: StationDepartures | null,
	selectedPlatforms: string[]
): PlatformDepartures[] {
	if (!departures) return [];

	const platforms = sortPlatforms(departures.platforms);

	const selected = selectedPlatforms.map((s) => s.trim()).filter(Boolean);

	if (selected.length === 0) {
		return platforms;
	}

	const available = new Set(platforms.map((p) => p.platform.name));
	const selectedValid = selected.filter((p) => available.has(p));

	if (selectedValid.length === 0) {
		return platforms;
	}

	return platforms.filter((p) => selectedValid.includes(p.platform.name));
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

export function _getPlatformKey(platformDep: PlatformDepartures): string {
	return `${platformDep.platform.type}-${platformDep.platform.name}`;
}

export function _getDepartureKey(departure: Departure): string {
	const time = departure.plannedTime.getTime();

	return `${departure.lineName}-${time}-${departure.direction.join('-')}`;
}
