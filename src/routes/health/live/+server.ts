import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * Liveness probe.
 *
 * This endpoint only proves that the SvelteKit server process is alive and
 * responding to HTTP requests. It must stay deliberately free of TRIAS calls,
 * dependency checks and other work so that it remains healthy even when
 * upstream services are unavailable.
 */
export const GET: RequestHandler = () => {
	return json(
		{ status: 'ok' },
		{
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
