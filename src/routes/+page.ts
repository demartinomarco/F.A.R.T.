import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	const stationId = url.searchParams.get('stationId') || '7000090';
	const res = await fetch(`/departures?stationId=${stationId}`);
	const item = await res.json();

	return { item };
};
