import type { PageLoad } from './$types';
import {
	isApiEnvelope,
	type ApiResponse,
	type Departure,
	type DeparturesByPlatform
} from '@/types/departure';

const DEFAULT_STATION = 'de:08212:89';

export type UiModel = {
	stationId: string;
	eventType: 'dep' | 'arr';
	item: ApiResponse | null;
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

function normalize(item: ApiResponse): ApiResponse {
	return {
		stationName: item?.stationName ?? '',
		cityName: item?.cityName ?? '',
		departureList: Array.isArray(item?.departureList)
			? item.departureList
					.map((d) => ({
						...d,
						platformName: formatPlatformName(d.platformName ?? ''),
						plannedTime: safeDate(d.plannedTime),
						realTime: safeDate(d.realTime)
					}))
					.filter((d) => d.plannedTime)
			: []
	};
}

function safeDate(v: unknown): Date | null {
	if (!v) return null;
	const d = new Date(v as any);
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatPlatformName(platformName: string): string {
	const p = platformName.trim();
	if (p === '') return 'Unbekanntes Gleis';
	if (!Number.isNaN(Number(p))) return `Gleis ${p}`;
	return p;
}

export async function _fetchDepartures(
	fetchFn: typeof fetch,
	stationId: string,
	eventType: 'dep' | 'arr'
): Promise<UiModel> {
	try {
		const res = await fetchFn(
			`/api/departures?stationId=${encodeURIComponent(stationId)}&eventType=129`
		);

		const text = await res.text();

		let json: unknown = null;
		try {
			json = text ? JSON.parse(text) : null;
		} catch {
			return errorModel(stationId, eventType, 'BAD_RESPONSE', 'Ungültige Serverantwort.');
		}

		if (isApiEnvelope<ApiResponse>(json)) {
			if (json.ok) {
				return { stationId, eventType, item: normalize(json.data), error: null };
			}
			return { stationId, eventType, item: null, error: json.error };
		}

		return errorModel(stationId, eventType, 'BAD_RESPONSE', 'Unerwartetes Antwortformat.');
	} catch {
		return errorModel(stationId, eventType, 'NETWORK', 'Keine Verbindung zum Server.');
	}
}

export function _extractPlatformNames(departures: ApiResponse | null): string[] {
	if (!departures) return [];
	const platformSet = [
		...new Set((departures.departureList ?? []).map((d) => d.platformName).filter(Boolean))
	];
	return sortPlatforms(platformSet);
}

export function _filterByPlatformName(
	departures: ApiResponse | null,
	selectedPlatforms: string[]
): DeparturesByPlatform[] {
	if (!departures) return [];

	const list = Array.isArray(departures.departureList) ? departures.departureList : [];
	if (list.length === 0) return [];

	const selected = (Array.isArray(selectedPlatforms) ? selectedPlatforms : [])
		.map((s) => s.trim())
		.filter(Boolean);

	// Clamp selection to available platforms; if none valid -> show all
	const available = new Set(list.map((d) => (d.platformName ?? '').trim()).filter(Boolean));
	const selectedValid = selected.filter((p) => available.has(p));

	const filtered =
		selectedValid.length === 0
			? list
			: list.filter((d) => selectedValid.includes((d.platformName ?? '').trim()));

	const grouped = filtered.reduce<Record<string, Departure[]>>((acc, dep) => {
		const platform = (dep.platformName ?? '').trim() || 'Unbekanntes Gleis';
		(acc[platform] ??= []).push(dep);
		return acc;
	}, {});

	const sortedPlatformNames = sortPlatforms(Object.keys(grouped));
	return sortedPlatformNames.map((platformName) => ({
		platformName,
		departures: grouped[platformName] ?? []
	}));
}

function sortPlatforms(platforms: string[]): string[] {
	return platforms.sort((a, b) => {
		const aIsGleis = a.startsWith('Gleis ');
		const bIsGleis = b.startsWith('Gleis ');
		if (aIsGleis && bIsGleis) {
			const aNum = parseInt(a.substring(6));
			const bNum = parseInt(b.substring(6));
			if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
		}
		if (aIsGleis && !bIsGleis) return -1;
		if (!aIsGleis && bIsGleis) return 1;
		return a.localeCompare(b);
	});
}
