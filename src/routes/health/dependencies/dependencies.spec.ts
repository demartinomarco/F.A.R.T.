import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getSnapshot: vi.fn(),
	config: { staleAfterMs: 300_000, failureThreshold: 3 }
}));

vi.mock('@/server/dependency-health', () => ({
	dependencyHealth: {
		getSnapshot: mocks.getSnapshot
	},
	getDependencyHealthConfig: () => mocks.config
}));

import { GET } from './+server';

function requestEvent() {
	return {} as Parameters<typeof GET>[0];
}

function snapshot(
	status: 'ok' | 'degraded' | 'down' | 'unknown',
	reachable: boolean | null = status === 'unknown' ? null : true
) {
	return {
		status,
		trias: {
			status,
			reachable,
			lastAttempt: '2026-11-02T20:45:00.000Z',
			lastSuccess: '2026-11-02T20:45:00.000Z',
			consecutiveFailures: status === 'down' ? 3 : 0,
			lastRequestDurationMs: 120,
			lastErrorCategory: status === 'degraded' ? 'timeout' : null,
			lastErrorMessage: status === 'degraded' ? 'KVV TRIAS timed out' : null
		},
		departureData: {
			status,
			lastValidation: '2026-11-02T20:45:00.000Z',
			invalidResponses: 0
		}
	};
}

describe('GET /health/dependencies', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		mocks.getSnapshot.mockReset();
	});

	it('returns 200 for healthy dependencies', async () => {
		const body = snapshot('ok');
		mocks.getSnapshot.mockReturnValue(body);

		const response = await GET(requestEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual(body);
		expect(mocks.getSnapshot).toHaveBeenCalledWith({
			config: mocks.config
		});
	});

	it('returns 200 with unknown before health has been established', async () => {
		mocks.getSnapshot.mockReturnValue(snapshot('unknown'));

		const response = await GET(requestEvent());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ status: 'unknown' });
	});

	it('returns 200 for a non-critical degraded state', async () => {
		mocks.getSnapshot.mockReturnValue(snapshot('degraded', false));

		const response = await GET(requestEvent());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ status: 'degraded' });
	});

	it('returns 503 when the critical failure threshold is exceeded', async () => {
		mocks.getSnapshot.mockReturnValue(snapshot('down'));

		const response = await GET(requestEvent());

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({ status: 'down' });
	});

	it('does not trigger a TRIAS request when polled', async () => {
		mocks.getSnapshot.mockReturnValue(snapshot('ok'));
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await GET(requestEvent());

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
