import { env } from '$env/dynamic/private';
import { isKvvTriasError } from '@/kvv-trias/errors';

export type DependencyHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export type DependencyErrorCategory =
	'timeout' | 'http' | 'network' | 'invalid_xml' | 'invalid_shape' | 'normalization' | 'internal';

export type DependencyHealthConfig = {
	staleAfterMs: number;
	failureThreshold: number;
};

export type DependencyHealthSnapshot = {
	status: DependencyHealthStatus;
	trias: {
		status: DependencyHealthStatus;
		reachable: boolean | null;
		lastAttempt: string | null;
		lastSuccess: string | null;
		consecutiveFailures: number;
		lastRequestDurationMs: number | null;
		lastErrorCategory: DependencyErrorCategory | null;
		lastErrorMessage: string | null;
	};
	departureData: {
		status: DependencyHealthStatus;
		lastValidation: string | null;
		invalidResponses: number;
	};
};

type HealthState = {
	reachable: boolean | null;
	lastAttempt: number | null;
	lastSuccess: number | null;
	lastRequestDurationMs: number | null;
	consecutiveFailures: number;
	lastErrorCategory: DependencyErrorCategory | null;
	lastErrorMessage: string | null;

	lastValidation: number | null;
	validationOk: boolean | null;
	consecutiveInvalidResponses: number;
	invalidResponses: number;
};

export const DEFAULT_STALE_AFTER_SECONDS = 300;
export const DEFAULT_FAILURE_THRESHOLD = 3;

export function getDependencyHealthConfig(
	source: Record<string, string | undefined> = env
): DependencyHealthConfig {
	const staleSeconds = parsePositiveInteger(
		source.KVV_HEALTH_STALE_AFTER_SECONDS,
		DEFAULT_STALE_AFTER_SECONDS
	);
	const failureThreshold = parsePositiveInteger(
		source.KVV_HEALTH_FAILURE_THRESHOLD,
		DEFAULT_FAILURE_THRESHOLD
	);

	return { staleAfterMs: staleSeconds * 1000, failureThreshold };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
	if (!value) return fallback;

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Tracks TRIAS health in process memory. After a restart the state starts as
 * unknown until the first request has completed.
 */
export class DependencyHealthTracker {
	private state = initialState();

	recordAttempt(at = Date.now()): void {
		this.state.lastAttempt = at;
	}

	recordResponseReceived(at: number, durationMs: number): void {
		this.state.lastSuccess = at;
		this.state.lastRequestDurationMs = durationMs;
		this.state.reachable = true;
	}

	recordValidationSuccess(at = Date.now()): void {
		this.state.lastValidation = at;
		this.state.validationOk = true;
		this.state.consecutiveFailures = 0;
		this.state.consecutiveInvalidResponses = 0;
		this.state.lastErrorCategory = null;
		this.state.lastErrorMessage = null;
	}

	recordRequestFailure(
		durationMs: number,
		category: DependencyErrorCategory,
		message: string | null = null
	): void {
		this.state.lastRequestDurationMs = durationMs;
		this.state.consecutiveFailures += 1;
		this.state.lastErrorCategory = category;
		this.state.lastErrorMessage = message;

		if (category === 'network' || category === 'timeout') {
			this.state.reachable = false;
		} else if (category === 'http') {
			this.state.reachable = true;
		} else {
			this.state.reachable = null;
		}
	}

	recordValidationFailure(
		category: DependencyErrorCategory,
		invalidResponse: boolean,
		message: string | null = null
	): void {
		this.state.validationOk = false;
		this.state.consecutiveFailures += 1;
		this.state.lastErrorCategory = category;
		this.state.lastErrorMessage = message;

		if (invalidResponse) {
			this.state.invalidResponses += 1;
			this.state.consecutiveInvalidResponses += 1;
		}
	}

	getSnapshot(
		args: {
			now?: number;
			config?: DependencyHealthConfig;
		} = {}
	): DependencyHealthSnapshot {
		const now = args.now ?? Date.now();
		const config = args.config ?? getDependencyHealthConfig();
		const triasStatus = this.getTriasStatus(now, config);
		const departureDataStatus = this.getDepartureDataStatus(now, config);

		return {
			status: worstStatus(triasStatus, departureDataStatus),
			trias: {
				status: triasStatus,
				reachable: this.state.reachable,
				lastAttempt: toIsoString(this.state.lastAttempt),
				lastSuccess: toIsoString(this.state.lastSuccess),
				consecutiveFailures: this.state.consecutiveFailures,
				lastRequestDurationMs: this.state.lastRequestDurationMs,
				lastErrorCategory: this.state.lastErrorCategory,
				lastErrorMessage: this.state.lastErrorMessage
			},
			departureData: {
				status: departureDataStatus,
				lastValidation: toIsoString(this.state.lastValidation),
				invalidResponses: this.state.invalidResponses
			}
		};
	}

	reset(): void {
		this.state = initialState();
	}

	private getTriasStatus(now: number, config: DependencyHealthConfig): DependencyHealthStatus {
		if (this.state.lastAttempt === null) return 'unknown';
		if (this.state.consecutiveFailures >= config.failureThreshold) return 'down';
		if (this.state.consecutiveFailures > 0) return 'degraded';
		if (this.state.lastSuccess === null) return 'unknown';
		if (isStale(this.state.lastAttempt, now, config.staleAfterMs)) return 'unknown';
		if (isStale(this.state.lastSuccess, now, config.staleAfterMs)) return 'degraded';
		return 'ok';
	}

	private getDepartureDataStatus(
		now: number,
		config: DependencyHealthConfig
	): DependencyHealthStatus {
		if (this.state.validationOk === null) return 'unknown';
		if (this.state.consecutiveInvalidResponses >= config.failureThreshold) return 'down';
		if (this.state.validationOk !== true) return 'degraded';
		if (isStale(this.state.lastAttempt, now, config.staleAfterMs)) return 'unknown';
		if (isStale(this.state.lastValidation, now, config.staleAfterMs)) return 'degraded';
		return 'ok';
	}
}

export function classifyRequestFailure(error: unknown): DependencyErrorCategory {
	if (isKvvTriasError(error)) {
		switch (error.code) {
			case 'UPSTREAM_TIMEOUT':
				return 'timeout';
			case 'UPSTREAM_HTTP':
				return 'http';
			case 'UPSTREAM_INVALID_XML':
				return 'invalid_xml';
			case 'UPSTREAM_INVALID_SHAPE':
				return 'invalid_shape';
			default:
				return 'internal';
		}
	}

	// Node's fetch reports network failures as TypeError.
	return error instanceof TypeError ? 'network' : 'internal';
}

export function classifyValidationFailure(error: unknown): {
	category: DependencyErrorCategory;
	invalidResponse: boolean;
} {
	if (isKvvTriasError(error)) {
		if (error.code === 'UPSTREAM_INVALID_XML') {
			return { category: 'invalid_xml', invalidResponse: true };
		}
		if (error.code === 'UPSTREAM_INVALID_SHAPE') {
			return { category: 'invalid_shape', invalidResponse: true };
		}
		return {
			category: error.code === 'UPSTREAM_TIMEOUT' ? 'timeout' : 'internal',
			invalidResponse: false
		};
	}

	return { category: 'normalization', invalidResponse: false };
}

function initialState(): HealthState {
	return {
		reachable: null,
		lastAttempt: null,
		lastSuccess: null,
		lastRequestDurationMs: null,
		consecutiveFailures: 0,
		lastErrorCategory: null,
		lastErrorMessage: null,
		lastValidation: null,
		validationOk: null,
		consecutiveInvalidResponses: 0,
		invalidResponses: 0
	};
}

function isStale(timestamp: number | null, now: number, staleAfterMs: number): boolean {
	return timestamp !== null && now - timestamp > staleAfterMs;
}

function toIsoString(timestamp: number | null): string | null {
	return timestamp === null ? null : new Date(timestamp).toISOString();
}

const STATUS_SEVERITY: Record<DependencyHealthStatus, number> = {
	ok: 0,
	unknown: 1,
	degraded: 2,
	down: 3
};

function worstStatus(a: DependencyHealthStatus, b: DependencyHealthStatus): DependencyHealthStatus {
	return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

export const dependencyHealth = new DependencyHealthTracker();
