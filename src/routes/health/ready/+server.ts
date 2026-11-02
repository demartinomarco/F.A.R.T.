import { json, type RequestHandler } from '@sveltejs/kit';
import { getReadiness } from '@/server/readiness';

/**
 * Readiness probe.
 *
 * Readiness only reflects local application initialization. TRIAS health is
 * reported separately by /health/dependencies so an upstream outage does not
 * make otherwise healthy application instances look unready.
 */
export const GET: RequestHandler = () => {
	const readiness = getReadiness();

	return json(
		{
			status: readiness.ready ? 'ready' : 'not_ready',
			checks: Object.fromEntries(
				readiness.checks.map((check) => [check.name, check.ok ? 'ok' : 'failed'])
			)
		},
		{
			status: readiness.ready ? 200 : 503,
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
