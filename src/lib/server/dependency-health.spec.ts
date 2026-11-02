import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FAILURE_THRESHOLD,
	DEFAULT_STALE_AFTER_SECONDS,
	DependencyHealthTracker,
	getDependencyHealthConfig,
	type DependencyHealthConfig
} from './dependency-health';

const T0 = Date.UTC(2026, 10, 2, 20, 45, 0);
const config: DependencyHealthConfig = {
	staleAfterMs: 60_000,
	failureThreshold: 3
};

function snapshot(tracker: DependencyHealthTracker, now = T0 + 1_000) {
	return tracker.getSnapshot({ now, config });
}

describe('DependencyHealthTracker', () => {
	it('reports unknown before the first request completes', () => {
		const health = snapshot(new DependencyHealthTracker());

		expect(health.status).toBe('unknown');
		expect(health.trias.status).toBe('unknown');
		expect(health.departureData.status).toBe('unknown');
		expect(health.trias.lastAttempt).toBeNull();
		expect(health.trias.reachable).toBeNull();
		expect(health.trias.lastErrorMessage).toBeNull();
		expect(health.departureData.lastValidation).toBeNull();
	});

	it('reports ok after a successful request and validation', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 120, 120);
		tracker.recordValidationSuccess(T0 + 130);

		const health = snapshot(tracker);

		expect(health.status).toBe('ok');
		expect(health.trias.reachable).toBe(true);
		expect(health.trias.lastAttempt).toBe(new Date(T0).toISOString());
		expect(health.trias.lastSuccess).toBe(new Date(T0 + 120).toISOString());
		expect(health.trias.lastRequestDurationMs).toBe(120);
		expect(health.trias.lastErrorMessage).toBeNull();
		expect(health.departureData.lastValidation).toBe(new Date(T0 + 130).toISOString());
	});

	it('tracks request failures separately from the last success', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 100, 100);
		tracker.recordValidationSuccess(T0 + 110);

		tracker.recordAttempt(T0 + 500);
		tracker.recordRequestFailure(200, 'timeout', 'KVV TRIAS timed out');

		const health = snapshot(tracker, T0 + 800);

		expect(health.trias.status).toBe('degraded');
		expect(health.trias.reachable).toBe(false);
		expect(health.trias.lastSuccess).toBe(new Date(T0 + 100).toISOString());
		expect(health.trias.consecutiveFailures).toBe(1);
		expect(health.trias.lastErrorCategory).toBe('timeout');
		expect(health.trias.lastErrorMessage).toBe('KVV TRIAS timed out');
		expect(health.departureData.status).toBe('ok');
	});

	it('reports TRIAS as unreachable after a network failure', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordRequestFailure(16, 'network', 'fetch failed');

		const health = snapshot(tracker, T0 + 100);

		expect(health.status).toBe('degraded');
		expect(health.trias.reachable).toBe(false);
		expect(health.trias.lastErrorCategory).toBe('network');
		expect(health.trias.lastErrorMessage).toBe('fetch failed');
	});

	it('distinguishes a transport success with invalid data', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 100, 100);
		tracker.recordValidationFailure('invalid_shape', true, 'KVV TRIAS response shape unexpected');

		const health = snapshot(tracker);

		expect(health.trias.reachable).toBe(true);
		expect(health.trias.lastSuccess).toBe(new Date(T0 + 100).toISOString());
		expect(health.trias.lastErrorCategory).toBe('invalid_shape');
		expect(health.trias.lastErrorMessage).toBe('KVV TRIAS response shape unexpected');
		expect(health.departureData.lastValidation).toBeNull();
		expect(health.departureData.invalidResponses).toBe(1);
		expect(health.status).toBe('degraded');
	});

	it('becomes down after consecutive request failures', () => {
		const tracker = new DependencyHealthTracker();

		for (let attempt = 0; attempt < 3; attempt += 1) {
			tracker.recordAttempt(T0 + attempt * 1_000);
			tracker.recordRequestFailure(100, 'http');
		}

		const health = snapshot(tracker, T0 + 3_000);

		expect(health.status).toBe('down');
		expect(health.trias.status).toBe('down');
		expect(health.trias.reachable).toBe(true);
		expect(health.trias.consecutiveFailures).toBe(3);
	});

	it('becomes down after consecutive invalid responses', () => {
		const tracker = new DependencyHealthTracker();

		for (let attempt = 0; attempt < 3; attempt += 1) {
			tracker.recordAttempt(T0 + attempt * 1_000);
			tracker.recordResponseReceived(T0 + attempt * 1_000 + 100, 100);
			tracker.recordValidationFailure('invalid_xml', true);
		}

		const health = snapshot(tracker, T0 + 3_000);

		expect(health.status).toBe('down');
		expect(health.departureData.status).toBe('down');
		expect(health.departureData.invalidResponses).toBe(3);
	});

	it('reports idle data as unknown after the stale window', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 100, 100);
		tracker.recordValidationSuccess(T0 + 110);

		const health = snapshot(tracker, T0 + 110 + config.staleAfterMs + 1);

		expect(health.status).toBe('unknown');
		expect(health.trias.status).toBe('unknown');
		expect(health.departureData.status).toBe('unknown');
	});

	it('reports degraded when the last attempt is recent but the last success is stale', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 100, 100);
		tracker.recordValidationSuccess(T0 + 110);

		const now = T0 + config.staleAfterMs + 200;
		tracker.recordAttempt(now - 100);

		const health = snapshot(tracker, now);

		expect(health.status).toBe('degraded');
		expect(health.trias.status).toBe('degraded');
		expect(health.departureData.status).toBe('degraded');
	});

	it('resets to unknown after a restart', () => {
		const tracker = new DependencyHealthTracker();
		tracker.recordAttempt(T0);
		tracker.recordResponseReceived(T0 + 100, 100);
		tracker.recordValidationSuccess(T0 + 110);
		tracker.reset();

		expect(snapshot(tracker).status).toBe('unknown');
	});
});

describe('getDependencyHealthConfig', () => {
	it('uses defaults for missing or invalid values', () => {
		const healthConfig = getDependencyHealthConfig({
			KVV_HEALTH_STALE_AFTER_SECONDS: 'invalid',
			KVV_HEALTH_FAILURE_THRESHOLD: '0'
		});

		expect(healthConfig.staleAfterMs).toBe(DEFAULT_STALE_AFTER_SECONDS * 1000);
		expect(healthConfig.failureThreshold).toBe(DEFAULT_FAILURE_THRESHOLD);
	});

	it('reads positive integer overrides', () => {
		const healthConfig = getDependencyHealthConfig({
			KVV_HEALTH_STALE_AFTER_SECONDS: '60',
			KVV_HEALTH_FAILURE_THRESHOLD: '5'
		});

		expect(healthConfig.staleAfterMs).toBe(60_000);
		expect(healthConfig.failureThreshold).toBe(5);
	});
});
