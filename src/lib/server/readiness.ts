import { getKvvTriasConfig } from '@/kvv-trias/env';
import { stops } from './stops';

export type ReadinessCheckName = 'stops' | 'triasConfig';

export type ReadinessCheck = {
	name: ReadinessCheckName;
	ok: boolean;
};

export type ReadinessResult = {
	ready: boolean;
	checks: ReadinessCheck[];
};

type ReadinessDependencies = {
	stopCount: number;
	getTriasConfig: () => unknown;
};

const defaultDependencies: ReadinessDependencies = {
	stopCount: stops.length,
	getTriasConfig: getKvvTriasConfig
};

/**
 * Evaluates the application's local initialization state.
 *
 * Readiness deliberately excludes TRIAS network availability. It only checks
 * that the data and configuration required to serve requests are present, so
 * an upstream outage cannot take healthy application instances out of service.
 */
export function getReadiness(deps: ReadinessDependencies = defaultDependencies): ReadinessResult {
	const checks: ReadinessCheck[] = [
		{ name: 'stops', ok: deps.stopCount > 0 },
		{ name: 'triasConfig', ok: hasTriasConfig(deps.getTriasConfig) }
	];

	return {
		ready: checks.every((check) => check.ok),
		checks
	};
}

function hasTriasConfig(getTriasConfig: () => unknown): boolean {
	try {
		getTriasConfig();
		return true;
	} catch {
		return false;
	}
}
