import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	readiness: {
		ready: true,
		checks: [
			{ name: 'stops', ok: true },
			{ name: 'triasConfig', ok: true }
		]
	}
}));

vi.mock('@/server/readiness', () => ({
	getReadiness: () => mocks.readiness
}));

import { GET } from './+server';

function requestEvent() {
	return {} as Parameters<typeof GET>[0];
}

describe('GET /health/ready', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 200 when the application is ready', async () => {
		mocks.readiness = {
			ready: true,
			checks: [
				{ name: 'stops', ok: true },
				{ name: 'triasConfig', ok: true }
			]
		};

		const response = await GET(requestEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({
			status: 'ready',
			checks: {
				stops: 'ok',
				triasConfig: 'ok'
			}
		});
	});

	it('returns 503 when essential initialization is incomplete', async () => {
		mocks.readiness = {
			ready: false,
			checks: [
				{ name: 'stops', ok: true },
				{ name: 'triasConfig', ok: false }
			]
		};

		const response = await GET(requestEvent());

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			status: 'not_ready',
			checks: {
				stops: 'ok',
				triasConfig: 'failed'
			}
		});
	});

	it('does not contact any external service', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await GET(requestEvent());

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
