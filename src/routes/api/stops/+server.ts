import type { RequestHandler } from '@sveltejs/kit';

import { searchStops } from '@/server/stops-search.server';

function normalizeQuery(q: string) {
	return q.trim().replace(/\s+/g, ' ');
}

export const GET: RequestHandler = async ({ url }) => {
	const query = normalizeQuery(url.searchParams.get('name') ?? '');

	if (query.length < 2) {
		return new Response(JSON.stringify([]), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const stops = searchStops(query);

	return new Response(JSON.stringify(stops), {
		headers: { 'Content-Type': 'application/json' }
	});
};
