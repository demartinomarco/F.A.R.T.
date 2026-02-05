import Fuse from 'fuse.js';
import { parse } from 'csv-parse/sync';

import stopsCsv from '$lib/assets/kvv_stops.csv?raw';

export type StopRow = {
	gid: string;
	place_name: string;
	stop_name: string;
	search: string;
};

export type SearchResult = {
	value: string;
	label: string;
	placeName: string;
	stopName: string;
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

export const stopsIdNameMap = new Map(
	STOPS.map((s) => [s.gid, s])
);

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

const KARLSRUHE_BONUS = 0.08; // tune: 0.03 subtle, 0.10 strong
export function searchStops(query: string): SearchResult[] {
	const fuseResults = fuse.search(query, { limit: 50 }); // get more first

	return fuseResults
		.map((r) => {
			const isKarlsruhe = r.item.place_name?.toLowerCase() === 'karlsruhe';

			// Fuse score: lower is better
			const boostedScore = (r.score ?? 1) - (isKarlsruhe ? KARLSRUHE_BONUS : 0);

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
}
