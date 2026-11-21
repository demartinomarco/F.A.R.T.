import { describe, expect, it } from 'vitest';
import { getReadiness } from './readiness';

describe('getReadiness', () => {
	it('is ready when all local initialization checks pass', () => {
		const readiness = getReadiness({
			stopCount: 100,
			getTriasConfig: () => ({ apiUrl: 'https://example.test', requestorRef: 'test' })
		});

		expect(readiness.ready).toBe(true);
		expect(readiness.checks).toEqual([
			{ name: 'stops', ok: true },
			{ name: 'triasConfig', ok: true }
		]);
	});

	it('is not ready when the stops dataset is empty', () => {
		const readiness = getReadiness({
			stopCount: 0,
			getTriasConfig: () => ({ apiUrl: 'https://example.test', requestorRef: 'test' })
		});

		expect(readiness.ready).toBe(false);
		expect(readiness.checks).toContainEqual({ name: 'stops', ok: false });
	});

	it('is not ready when the TRIAS configuration is missing', () => {
		const readiness = getReadiness({
			stopCount: 100,
			getTriasConfig: () => {
				throw new Error('Missing env var');
			}
		});

		expect(readiness.ready).toBe(false);
		expect(readiness.checks).toContainEqual({ name: 'triasConfig', ok: false });
	});

	it('does not treat TRIAS availability as part of readiness', () => {
		const readiness = getReadiness({
			stopCount: 100,
			getTriasConfig: () => ({ apiUrl: 'https://example.test', requestorRef: 'test' })
		});

		expect(readiness.ready).toBe(true);
	});
});
