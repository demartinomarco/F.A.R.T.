import { parse } from 'csv-parse/sync';

import stopsCsv from '$lib/assets/kvv_stops.csv?raw';

export type StopRow = {
	gid: string;
	place_name: string;
	stop_name: string;
	lon?: string;
	lat?: string;
};

export const stops: StopRow[] = parse(stopsCsv, {
	delimiter: ';',
	columns: true,
	skip_empty_lines: true,
	trim: true
});

export const stopsIdNameMap = new Map<string, StopRow>(stops.map((s) => [s.gid, s]));