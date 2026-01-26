import type { ApiResponse, Departure, DeparturesByPlatform } from '@/types/departure';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	const stationId = url.searchParams.get('stationId') || 'de:08212:89';
	const res = await fetch(`/api/departures?stationId=${stationId}`);

	return { item: parseDatesOfDepartures(await res.json()) };
};

function parseDatesOfDepartures(item: ApiResponse) {
	return {
		...item,
		departureList: item.departureList.map((d: Departure) => ({
			...d,
			platformName: formatPlatformName(d.platformName),
			plannedTime: toDate(d.plannedTime),
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

export async function _fetchDepartures(stationId: string) {
	const res = await fetch(`/api/departures?stationId=${stationId}`);
	const item = await res.json();
	return parseDatesOfDepartures(item);
}

export function _extractPlatformNames(departures: ApiResponse): string[] {
	const platformSet = [
		...new Set(departures.departureList.map((dep) => dep.platformName).filter(Boolean))
	];

	return sortPlatforms(platformSet);
}

export function _filterByPlatformName(
	departures: ApiResponse,
	selectedPlatforms: string[]
): DeparturesByPlatform[] {
	const filtered = departures.departureList.filter(
		(d) => selectedPlatforms.length === 0 || selectedPlatforms.includes(d.platformName)
	);

	// TODO: add "Gleis" to platformName if it is only a number
	const grouped = filtered.reduce<Record<string, Departure[]>>((acc, departure) => {
		const platform = departure.platformName;

		if (!acc[platform]) {
			acc[platform] = [];
		}

		acc[platform].push(departure);
		return acc;
	}, {});

	const sortedPlatformNames = sortPlatforms(Object.keys(grouped));

	return sortedPlatformNames.map((platformName) => ({
		platformName,
		departures: grouped[platformName]
	}));
}

function sortPlatforms(platforms: string[]): string[] {
	return platforms.sort((a, b) => {
		const aIsGleis = a.startsWith('Gleis ');
		const bIsGleis = b.startsWith('Gleis ');

		// If both start with "Gleis", extract and compare numbers
		if (aIsGleis && bIsGleis) {
			// Extract the numeric part (e.g., "Gleis 1 (U)" -> "1")
			const aNum = parseInt(a.substring(6));
			const bNum = parseInt(b.substring(6));

			if (!isNaN(aNum) && !isNaN(bNum)) {
				return aNum - bNum;
			}
		}

		// If only one starts with "Gleis", it comes first
		if (aIsGleis && !bIsGleis) return -1;
		if (!aIsGleis && bIsGleis) return 1;

		// For everything else (including non-Gleis platforms), sort lexicographically
		return a.localeCompare(b);
	});
}
