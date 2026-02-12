import { getDeparturesLib } from '@/kvv-api/kvv-departures';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	// supports:
	// ?stationId=a
	// ?stationId=a&stationId=b
	const stationIds = url.searchParams.getAll('stationId').filter(Boolean) || ['de:08212:89'];

	const eventType: 'dep' | 'arr' = (url.searchParams.get('eventType') as 'dep' | 'arr') ?? 'dep';

	const limit = url.searchParams.get('limit') ?? '20';

	const results = await Promise.all(
		stationIds.map(async (stationId) => {
			try {
				return await getDeparturesLib(stationId, eventType, limit);
			} catch {
				return {
					stationName: '',
					cityName: '',
					departureList: []
				};
			}
		})
	);

	return new Response(JSON.stringify(results), {
		headers: { 'Content-Type': 'application/json' }
	});
};
