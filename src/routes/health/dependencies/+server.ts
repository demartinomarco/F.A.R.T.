import { json, type RequestHandler } from '@sveltejs/kit';
import { dependencyHealth, getDependencyHealthConfig } from '@/server/dependency-health';

/**
 * Dependency health probe.
 *
 * This reads the in-memory state maintained by the existing TRIAS request and
 * data-processing pipeline. It never initiates an upstream request, so polling
 * this endpoint does not create additional TRIAS traffic.
 */
export const GET: RequestHandler = () => {
	const health = dependencyHealth.getSnapshot({
		config: getDependencyHealthConfig()
	});

	return json(health, {
		status: health.status === 'down' ? 503 : 200,
		headers: {
			'cache-control': 'no-store'
		}
	});
};
