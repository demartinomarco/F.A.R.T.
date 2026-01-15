import type { RequestHandler } from '@sveltejs/kit';

import Fuse from 'fuse.js';
import { parse } from 'csv-parse/sync';

import stopsCsv from '$lib/assets/kvv_stops.csv?raw';

type StopRow = {
	gid: string;
	place_name: string;
	stop_name: string;
	search: string;
};

const STOPS: StopRow[] = parse(stopsCsv, {
	delimiter: ';',
	columns: true,
	skip_empty_lines: true,
	trim: true
}).map((r: any) => ({
	...r,
	search: `${r.place_name} ${r.stop_name} ${r.stop_name} (${r.place_name})`.toLowerCase()
}));

const fuse = new Fuse(STOPS, {
	threshold: 0.35, // lower = stricter, higher = fuzzier
	ignoreLocation: true,
	minMatchCharLength: 2,
	keys: [
		{ name: 'search', weight: 1.0 },
		{ name: 'stop_name', weight: 0.6 },
		{ name: 'place_name', weight: 0.4 }
	]
});

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

	const KARLSRUHE_BONUS = 0.08; // tune: 0.03 subtle, 0.10 strong

	const fuseResults = fuse.search(query, { limit: 50 }); // get more first

	const stops = fuseResults
		.map((r) => {
			const isKarlsruhe =
				r.item.place_name?.toLowerCase() === 'karlsruhe';

			// Fuse score: lower is better
			const boostedScore =
				(r.score ?? 1) - (isKarlsruhe ? KARLSRUHE_BONUS : 0);

			return { ...r, boostedScore };
		})
		.sort((a, b) => a.boostedScore - b.boostedScore)
		.slice(0, 9)
		.map(({ item }) => ({
			value: item.gid,
			label: item.place_name ? `${item.stop_name} (${item.place_name})` : item.stop_name,
			placeName: item.place_name,
			stopName: item.stop_name
		}));


	return new Response(JSON.stringify(stops), {
		headers: { 'Content-Type': 'application/json' }
	});
};
