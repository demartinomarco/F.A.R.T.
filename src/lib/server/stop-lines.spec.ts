import { describe, expect, it } from 'vitest';
import { linesForStop, resolveLineRefs } from './stop-lines';
import stopLinesJson from '@/assets/stop-lines.json';
import type { StopLinesData } from './stop-lines';

const data = stopLinesJson as StopLinesData;

describe('stop-lines data (src/lib/assets/stop-lines.json)', () => {
	it('records the generation metadata', () => {
		expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		// Reference date (YYYYMMDD) the bus probe and service windows were based on.
		expect(data.asOf).toMatch(/^\d{8}$/);
	});

	it('keys every stop by a KVV station id and lists only well-formed entries', () => {
		expect(Object.keys(data.stops).length).toBeGreaterThan(1000);

		for (const [id, lines] of Object.entries(data.stops)) {
			// de: regional codes; fr: for the Strasbourg border stops in the
			// KVV tariff area (both appear in kvv_stops.csv).
			expect(id).toMatch(/^(de|fr):\d{5}:/);
			expect(lines.length).toBeGreaterThan(0);

			for (const line of lines) {
				expect(line.name.length).toBeGreaterThan(0);
				expect(line.name.length).toBeLessThanOrEqual(50);
				expect(['tram', 'rail', 'bus']).toContain(line.vehicleType);
			}
		}
	});

	it('keeps line names unique per stop', () => {
		for (const lines of Object.values(data.stops)) {
			const names = lines.map((line) => line.name);
			expect(new Set(names).size).toBe(names.length);
		}
	});

	it('orders each stop: buses last, leading numbers as numbers, prefix lines grouped (S5 < S51 < S7)', () => {
		const isDigit = (c: string) => c >= '0' && c <= '9';
		// Same rule as compareLineNames() in src/routes/+page.ts: only a
		// leading digit run is a line number; digit runs after a letter are
		// compared lexicographically (prefix grouping).
		const natural = (a: string, b: string): number => {
			let i = 0;
			let j = 0;
			while (i < a.length && j < b.length) {
				const ca = a[i];
				const cb = b[j];
				if (isDigit(ca) && isDigit(cb)) {
					let ia = i;
					let ib = j;
					while (ia < a.length && isDigit(a[ia])) ia++;
					while (ib < b.length && isDigit(b[ib])) ib++;
					const ra = a.slice(i, ia);
					const rb = b.slice(j, ib);
					if (i === 0) {
						const diff = Number(ra) - Number(rb);
						if (diff !== 0) return diff;
					} else if (ra !== rb) {
						return ra < rb ? -1 : 1;
					}
					i = ia;
					j = ib;
				} else if (ca !== cb) {
					return ca < cb ? -1 : 1;
				} else {
					i++;
					j++;
				}
			}
			return a.length - b.length;
		};

		for (const lines of Object.values(data.stops)) {
			const sorted = [...lines].sort(
				(a, b) =>
					Number(a.vehicleType === 'bus') - Number(b.vehicleType === 'bus') ||
					natural(a.name, b.name)
			);
			expect(lines, 'stop list not in natural order').toEqual(sorted);
		}
	});

	it('records a global line name -> LineRef map with well-formed refs', () => {
		expect(typeof data.lines).toBe('object');
		expect(Object.keys(data.lines).length).toBeGreaterThan(100);

		for (const [name, refs] of Object.entries(data.lines)) {
			expect(name.length).toBeGreaterThan(0);
			expect(refs.length).toBeGreaterThan(0);
			// Unique per name; TRIAS LineRefs look like "kvv:21003:E:H".
			expect(new Set(refs).size).toBe(refs.length);
			for (const ref of refs) {
				expect(ref).toMatch(/^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/);
			}
		}
	});

	it('maps the Hbf tram line 3 to both direction refs', () => {
		// The exact mapping the server-side LineFilter relies on (observed
		// against the live KVV endpoint).
		expect(data.lines['3']).toContain('kvv:21003:E:H');
		expect(data.lines['3']).toContain('kvv:21003:E:R');
		expect(data.lines['S1']).toContain('kvv:22301:E:H');
		expect(data.lines['S1']).toContain('kvv:22301:E:R');
	});
});

describe('linesForStop', () => {
	it('returns the rail lines of Kronenplatz (U) with their vehicle types', () => {
		const lines = linesForStop('de:08212:1002');

		const byName = new Map(lines.map((line) => [line.name, line.vehicleType]));

		expect(byName.get('1')).toBe('tram');
		expect(byName.get('2')).toBe('tram');
		expect(byName.get('S2')).toBe('rail');
		expect(byName.get('S4')).toBe('rail');
		expect(byName.get('S5')).toBe('rail');
		expect(byName.get('S7')).toBe('rail');
		expect(byName.get('S8')).toBe('rail');
		expect(byName.get('S51')).toBe('rail');
	});

	it('lists rare services that are not in the upcoming departures window', () => {
		// Night trams run a few times per night and are almost never among the
		// next ~20 departures — exactly the case the static list exists for.
		const names = linesForStop('de:08212:1002').map((line) => line.name);

		expect(names).toContain('NL1');
		expect(names).toContain('NL2');
	});

	it('lists bus lines of a bus-only stop', () => {
		const lines = linesForStop('de:07334:1752');
		const byName = new Map(lines.map((line) => [line.name, line.vehicleType]));

		expect(byName.get('593')).toBe('bus');
		expect(byName.get('598')).toBe('bus');
	});

	it('returns an empty list for unknown or blank stops', () => {
		expect(linesForStop('de:00000:123456')).toEqual([]);
		expect(linesForStop('')).toEqual([]);
	});

	it('returns a stable reference for repeated lookups of the same stop', () => {
		expect(linesForStop('de:08212:1002')).toBe(linesForStop('de:08212:1002'));
	});

	it('shares one empty list for unknown stops instead of caching every miss', () => {
		// The station-id space is unbounded and unknown ids are valid input, so
		// misses must not accumulate entries in the module cache.
		expect(linesForStop('de:99999:1')).toBe(linesForStop('de:99999:2'));
		expect(linesForStop('de:99999:3')).toEqual([]);
	});
});

describe('resolveLineRefs', () => {
	it('returns null for an empty selection (no filter)', () => {
		expect(resolveLineRefs([])).toBeNull();
	});

	it('resolves a single known line to its refs', () => {
		const refs = resolveLineRefs(['3']);

		expect(refs).not.toBeNull();
		expect(refs).toContain('kvv:21003:E:H');
		expect(refs).toContain('kvv:21003:E:R');
	});

	it('unions the refs of several lines and keeps them unique', () => {
		const refs = resolveLineRefs(['3', 'S1']);

		expect(refs).not.toBeNull();
		expect(refs).toContain('kvv:21003:E:H');
		expect(refs).toContain('kvv:22301:E:R');
		expect(new Set(refs).size).toBe(refs!.length);
	});

	it('fails open (null) when a selected name is not in the dataset', () => {
		expect(resolveLineRefs(['no-such-line-xyz'])).toBeNull();
	});

	it('fails open (null) when only some of the names are known', () => {
		expect(resolveLineRefs(['3', 'no-such-line-xyz'])).toBeNull();
	});

	it('fails open for prototype-chain names instead of throwing', () => {
		// The names come from the `lines` URL parameter. A plain property
		// lookup would resolve these to inherited members and throw when the
		// pipeline iterates them (HTTP 500).
		for (const name of ['__proto__', 'constructor', 'hasOwnProperty', 'toString']) {
			expect(() => resolveLineRefs([name])).not.toThrow();
			expect(resolveLineRefs([name])).toBeNull();
		}
	});

	it('fails open when a known line is mixed with a prototype-chain name', () => {
		expect(resolveLineRefs(['3', '__proto__'])).toBeNull();
	});
});
