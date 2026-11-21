import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent() {
	return {} as Parameters<typeof GET>[0];
}

describe('GET /health/live', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 200 with a small alive response', async () => {
		const response = await GET(requestEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({ status: 'ok' });
	});

	it('does not contact any external service', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await GET(requestEvent());

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
