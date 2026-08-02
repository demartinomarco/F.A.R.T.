import uFuzzy from '@leeoniya/ufuzzy';
import stopsCsvUrl from '$lib/assets/kvv_stops.csv?url';
import type { StopRow } from './types';

export type SearchIndex = {
	stops: StopRow[];
	haystack: string[];
	uf: uFuzzy;
};

let indexPromise: Promise<SearchIndex> | undefined;

function parseStopsCsv(csv: string): StopRow[] {
	const [header, ...lines] = csv.trim().split(/\r?\n/);
	const keys = header.split(';');

	return lines.map((line) => {
		const cols = line.split(';');
		const row = Object.fromEntries(keys.map((k, i) => [k, cols[i] ?? '']));
		return {
			gid: row.gid,
			place_name: row.place_name,
			stop_name: row.stop_name,
			lon: Number(row.lon),
			lat: Number(row.lat)
		};
	});
}

/**
 * Expands German umlauts prior to latinization (e.g. "Süd" -> "Sued")
 */
function expandUmlauts(str: string): string {
	return str.replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/gi, 'ss');
}

function buildHaystack(place: string, stop: string): string {
	const full = place ? `${place} ${stop}` : stop;
	const reverse = place ? `${stop} ${place}` : stop;

	const expanded = expandUmlauts(full); // "Hagsfeld Süd" -> "Hagsfeld Sued"
	const latin = uFuzzy.latinize(full); // "Hagsfeld Süd" -> "Hagsfeld Sud"

	// Combine unique variants into a single searchable string
	const variants = Array.from(new Set([full, reverse, expanded, latin]));
	return variants.join(' | ');
}

export async function getSearchIndex(): Promise<SearchIndex> {
	if (indexPromise) return indexPromise;

	indexPromise = fetch(stopsCsvUrl).then(async (res) => {
		if (!res.ok) throw new Error(`Could not load stops CSV: ${res.status}`);
		const csv = await res.text();
		const stops = parseStopsCsv(csv);
		const haystack = stops.map((s) => buildHaystack(s.place_name, s.stop_name));

		const uf = new uFuzzy({
			alpha: 'a-zäöüß',
			intraMode: 1,
			intraIns: 1
		});

		return { stops, haystack, uf };
	});

	return indexPromise;
}
