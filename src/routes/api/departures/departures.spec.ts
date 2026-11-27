import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	getDepartures: vi.fn()
}));

vi.mock('@/kvv-trias', () => ({
	getDepartures: mocks.getDepartures
}));

import { GET } from './+server';

function get(query: string) {
	const url = new URL(`http://localhost/api/departures${query ? `?${query}` : ''}`);
	return GET({ url } as unknown as RequestEvent);
}

describe('GET /api/departures line selection', () => {
	beforeEach(() => {
		mocks.getDepartures.mockReset();
		mocks.getDepartures.mockResolvedValue({
			stationName: 'Hbf',
			cityName: 'Karlsruhe',
			platforms: []
		});
	});

	it('forwards a parsed selection to the pipeline (trimmed, deduplicated)', async () => {
		await get('stationId=de:08212:89&lines=S1,S4,,S1, 2 ');

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, ['S1', 'S4', '2']);
	});

	it('forwards an empty selection when the parameter is absent', async () => {
		await get('stationId=de:08212:89');

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, []);
	});

	it('drops empty and overlong names', async () => {
		const value = `S1,${'a'.repeat(51)},${'b'.repeat(50)}`;

		await get(`stationId=de:08212:89&lines=${encodeURIComponent(value)}`);

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, [
			'S1',
			'b'.repeat(50)
		]);
	});

	it('caps the selection at 100 lines', async () => {
		const names = Array.from({ length: 150 }, (_, i) => `L${i}`);

		await get(`stationId=de:08212:89&lines=${names.join(',')}`);

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, names.slice(0, 100));
	});

	it('strips control, zero-width and bidi characters', async () => {
		const value = ['a\u200b', '\u2066S1\u2069', '\u0000', 'tab\tname'].join(',');

		await get(`stationId=de:08212:89&lines=${encodeURIComponent(value)}`);

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, [
			'a',
			'S1',
			'tabname'
		]);
	});

	it('does not 400 for unknown line names (they fail open in the pipeline)', async () => {
		const res = await get('stationId=de:08212:89&lines=no-such-line');

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, ['no-such-line']);
		expect(res.status).toBe(200);
	});

	it('survives a huge parameter value without materializing an unbounded list', async () => {
		await get(`stationId=de:08212:89&lines=${'x'.repeat(1_000_000)}`);

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, []);
	});

	it('still rejects a malformed stationId', async () => {
		const res = await get('stationId=<script>&lines=S1');

		expect(mocks.getDepartures).not.toHaveBeenCalled();
		expect(res.status).toBe(400);
	});

	// The page and the endpoint share src/lib/lines-param.ts, so a bookmark has
	// to mean the same thing in the address bar and in the upstream LineFilter.
	// The identical input is asserted client-side in src/lib/lines-param.spec.ts.
	it('normalises the selection exactly like the page does', async () => {
		const params = new URLSearchParams({
			stationId: 'de:08212:89',
			lines: [' S1 ', '', 'S4', 'S1', '\u200b2'].join(',')
		});

		const url = new URL(`http://localhost/api/departures?${params}`);
		await GET({ url } as unknown as RequestEvent);

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, ['S1', 'S4', '2']);
	});

	it('forwards an explicit limit to the pipeline', async () => {
		await get('stationId=de:08212:89&limit=42');

		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 42, []);
	});

	// The page sanitises hostile URLs before they ever reach this endpoint
	// (src/lib/limit-param.ts), but the endpoint enforces the same contract for
	// any other caller: no request may make the pipeline over-fetch beyond
	// MAX_LIMIT from TRIAS, and nothing that is not a plain integer inside the
	// bounds becomes a fetch at all.
	it('rejects out-of-range or malformed limits without calling the pipeline', async () => {
		const rejected = [
			'0',
			'-5',
			'101',
			'9999',
			'nope',
			'',
			'1e2',
			'0x10',
			'20.5',
			'+20',
			'Infinity',
			'9'.repeat(1_000)
		];

		for (const value of rejected) {
			const res = await get(`stationId=de:08212:89&limit=${encodeURIComponent(value)}`);

			expect(res.status, `limit=${value}`).toBe(400);
		}
		expect(mocks.getDepartures).not.toHaveBeenCalled();
	});

	it('takes the default limit when the parameter is absent', async () => {
		const res = await get('stationId=de:08212:89');

		expect(res.status).toBe(200);
		expect(mocks.getDepartures).toHaveBeenCalledWith('de:08212:89', 'dep', 20, []);
	});

	it('keeps the invalid-limit error message the page maps to a translation', async () => {
		const res = await get('stationId=de:08212:89&limit=0');
		const body = await res.json();

		expect(body.error).toMatchObject({
			code: 'BAD_PARAMS',
			message: 'Invalid limit (must be 1..100)'
		});
	});
});
