import type { RequestHandler } from '@sveltejs/kit';
import { getDepartures } from '@/kvv-trias';
import type { EventType } from '@/kvv-trias/types';
import { isKvvTriasError } from '@/kvv-trias/errors';

function parseEventType(v: string | null): EventType {
	return v === 'arr' ? 'arr' : 'dep';
}

function parseLimit(v: string | null): number {
	if (v == null) return 20;
	const n = Number(v);
	if (!Number.isFinite(n)) return NaN;
	return Math.trunc(n);
}

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers
		}
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('stationId') ?? 'de:08212:89';
	const eventType = parseEventType(url.searchParams.get('eventType'));
	const limit = parseLimit(url.searchParams.get('limit'));

	if (!stationId.match(/^(de|fr|NL):(\d{5}|S):\d{1,8}$/)) {
		return json(
			{
				ok: false,
				error: {
					code: 'BAD_PARAMS',
					message: 'Invalid stationId'
				}
			},
			400
		);
	}

	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		return json(
			{
				ok: false,
				error: {
					code: 'BAD_PARAMS',
					message: 'Invalid limit (must be 1..100)'
				}
			},
			400
		);
	}

	try {
		const departures = await getDepartures(stationId, eventType, limit);

		return json({ ok: true, data: departures }, 200);
	} catch (e) {
		if (isKvvTriasError(e)) {
			// Let client know it can retry (your client retries in 15s)
			const headers: HeadersInit =
				e.code === 'UPSTREAM_TIMEOUT' || e.code.startsWith('UPSTREAM_')
					? { 'Retry-After': '15' }
					: {};

			return json(
				{
					ok: false,
					error: {
						code: e.code,
						message: e.message
					}
				},
				e.status,
				headers
			);
		}

		// Unknown error
		console.error('[departures route] Unhandled error:', e);
		return json(
			{
				ok: false,
				error: {
					code: 'INTERNAL',
					message: 'Internal server error'
				}
			},
			500
		);
	}
};
