import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET } from './+server';

function get(query: string) {
	const url = new URL(`http://localhost/api/stop-lines${query ? `?${query}` : ''}`);
	return GET({ url } as unknown as RequestEvent);
}

describe('GET /api/stop-lines', () => {
	it('returns the static lines of a known stop', async () => {
		const res = await get('stationId=de:08212:1002');

		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toContain('max-age=');

		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.data.stationId).toBe('de:08212:1002');

		const byName = new Map(
			body.data.lines.map((line: { name: string; vehicleType: string }) => [
				line.name,
				line.vehicleType
			])
		);
		expect(byName.get('S4')).toBe('rail');
		expect(byName.get('1')).toBe('tram');
		// Rare services are part of the point of this endpoint.
		expect(byName.get('NL1')).toBe('tram');
	});

	it('returns an empty list for a valid stop the dataset does not know', async () => {
		const res = await get('stationId=de:00000:123456');

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.data.lines).toEqual([]);
	});

	it('rejects a missing stationId with 400', async () => {
		const res = await get('');

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.ok).toBe(false);
		expect(body.error.code).toBe('BAD_PARAMS');
	});

	it('rejects malformed station ids with 400', async () => {
		for (const stationId of ['de:08212', 'de:821:89', 'x:08212:89', '%2A', 'de:08212:89/../']) {
			const res = await get(`stationId=${encodeURIComponent(stationId)}`);
			expect(res.status, stationId).toBe(400);
		}
	});
});
