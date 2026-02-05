import { getDeparturesLib } from '@/kvv-api/kvv-departures';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('stationId') ?? 'de:08212:89'; // default station
	const eventType: 'dep' | 'arr' = url.searchParams.get('eventType') ?? 'dep';
	const limit = url.searchParams.get('limit') ?? '20';

	const departures = await getDeparturesLib(stationId, eventType, limit);

	return new Response(JSON.stringify(departures), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
