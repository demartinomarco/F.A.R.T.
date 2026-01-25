import type { ApiResponse, Departure } from '@/types/departure';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	const stationId = url.searchParams.get('stationId') || 'de:08212:89';
	const res = await fetch(`/api/departures?stationId=${stationId}`);

	return { item: parseDatesOfDepartures(await res.json()) };
};

function parseDatesOfDepartures(item: any) {
	return {
		...item,
		departureList: item.departureList.map((d) => ({
			...d,
			plannedTime: toDate(d.plannedTime),
			realTime: toDate(d.realTime)
		}))
	};
}

function toDate(v: any): Date | null {
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
	// Sometimes platforms are just numbers, othertimes they have a prefix, like "Gleis"
	// (I sort them as numbers whenever possible otherwise I would get [1, 10, 2] if I would always sort them as strings)
	return platformSet.sort((a, b) => {
		const na = Number(a),
			nb = Number(b);
		const aNum = !Number.isNaN(na),
			bNum = !Number.isNaN(nb);
		if (aNum && bNum) return na - nb;
		return a.localeCompare(b);
	});
}

export function _filterByPlatformName(
	departures: ApiResponse,
	selectedPlatforms: string[]
): Departure[] {
	return departures.departureList.filter(
		(d) => selectedPlatforms.length === 0 || selectedPlatforms.includes(d.platformName)
	);
}
