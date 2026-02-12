import type { ApiResponse, Departure, DeparturesByPlatform } from '@/types/departure';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	const stationIds = readStationIds(url);
	const res = await fetch(buildDeparturesUrl(stationIds));
	const items = (await res.json()) as ApiResponse[];

	return { item: items.map(parseDatesOfDepartures) };
};

function readStationIds(url: URL): string[] {
	const ids = url.searchParams.getAll('stationId').filter(Boolean);
	return ids.length ? ids : ['de:08212:89'];
}

function buildDeparturesUrl(stationIds: string[], eventType?: 'dep' | 'arr', limit?: string) {
	const params = new URLSearchParams();
	for (const id of stationIds) params.append('stationId', id);
	if (eventType) params.set('eventType', eventType);
	if (limit) params.set('limit', limit);
	return `/api/departures?${params.toString()}`;
}

function parseDatesOfDepartures(item: ApiResponse): ApiResponse {
	return {
		...item,
		departureList: (item.departureList ?? []).map((d: Departure) => ({
			...d,
			platformName: formatPlatformName(d.platformName),
			plannedTime: toDate(d.plannedTime)!,
			realTime: toDate(d.realTime)
		}))
	};
}

function formatPlatformName(platformName: string): string {
	if (platformName === '') return 'Unbekannter Gleis';
	if (!isNaN(Number(platformName))) return `Gleis ${platformName}`;
	return platformName;
}

function toDate(v: Date | null): Date | null {
	return v ? new Date(v) : null;
}

export async function _fetchDepartures(stationIds: string[], eventType: 'dep' | 'arr') {
	const res = await fetch(buildDeparturesUrl(stationIds, eventType));
	const items = (await res.json()) as ApiResponse[];
	return items.map(parseDatesOfDepartures);
}

/**
 * Helper: builds the platform label shown in the sidebar / used for filtering.
 * - If there is only 1 station in the response: "3"
 * - If there are multiple stations: "3 (Hauptbahnhof)"
 */
function platformLabel(
	platformName: string | null | undefined,
	stationName: string,
	multiStation: boolean
): string | null {
	if (!platformName) return null;
	return multiStation ? `${platformName} (${stationName})` : platformName;
}

/**
 * Union of platform names across ALL stations (for sidebar filter).
 */
export function _extractPlatformNames(departures: ApiResponse[]): string[] {
	const multiStation = departures.length > 1;

	const platformSet = [
		...new Set(
			departures
				.flatMap((station) =>
					station.departureList
						.map((dep) => platformLabel(dep.platformName, station.stationName, multiStation))
						.filter(Boolean)
				)
				.filter(Boolean) as string[]
		)
	];

	return sortPlatforms(platformSet);
}

/**
 * Returns per-station grouped departures, filtered by selectedPlatforms.
 * NOTE: When multi-station, selectedPlatforms contains labels like "3 (StationName)".
 */
export function _filterByPlatformName(
	departures: ApiResponse[],
	selectedPlatforms: string[]
): Array<{ stationName: string; cityName: string; platforms: DeparturesByPlatform[] }> {
	const multiStation = departures.length > 1;

	return departures.map((station) => {
		const filtered = station.departureList.filter((d) => {
			if (selectedPlatforms.length === 0) return true;

			// In multi-station mode, match against the decorated label.
			// In single-station mode, this is just the plain platform name.
			const label = platformLabel(d.platformName, station.stationName, multiStation);
			return !!label && selectedPlatforms.includes(label);
		});

		const grouped = filtered.reduce<Record<string, Departure[]>>((acc, departure) => {
			const label = platformLabel(departure.platformName, station.stationName, multiStation);
			if (!label) return acc;

			if (!acc[label]) acc[label] = [];
			acc[label].push(departure);
			return acc;
		}, {});

		const sortedPlatformNames = sortPlatforms(Object.keys(grouped));

		return {
			stationName: station.stationName,
			cityName: station.cityName,
			platforms: sortedPlatformNames.map((platformName) => ({
				platformName, // will include "(stationName)" only when multiStation=true
				departures: grouped[platformName]
			}))
		};
	});
}


function sortPlatforms(platforms: string[]): string[] {
	return platforms.sort((a, b) => {
		const aIsGleis = a.startsWith('Gleis ');
		const bIsGleis = b.startsWith('Gleis ');

		if (aIsGleis && bIsGleis) {
			const aNum = parseInt(a.substring(6));
			const bNum = parseInt(b.substring(6));
			if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
		}

		if (aIsGleis && !bIsGleis) return -1;
		if (!aIsGleis && bIsGleis) return 1;

		return a.localeCompare(b);
	});
}
