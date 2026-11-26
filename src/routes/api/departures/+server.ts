import type { RequestHandler } from '@sveltejs/kit';
import { getDepartures } from '@/kvv-trias';
import type { EventType } from '@/kvv-trias/types';
import { isKvvTriasError } from '@/kvv-trias/errors';
import { DEFAULT_LIMIT, LIMIT_PARAM, MAX_LIMIT, MIN_LIMIT } from '@/limit-param';
import { parseLinesParam } from '@/lines-param';

function parseEventType(v: string | null): EventType {
	return v === 'arr' ? 'arr' : 'dep';
}

// Unlike the page (which normalises a hostile URL into a bounded value, so a
// bookmark never breaks), the endpoint rejects out-of-range limits with a 400:
// this bounds the upstream TRIAS request (doubled for the over-fetch) no
// matter who calls it. The bounds themselves live in src/lib/limit-param.ts,
// shared with the page, so the two cannot drift apart.
function parseLimit(v: string | null): number {
	if (v == null) return DEFAULT_LIMIT;
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
	const limit = parseLimit(url.searchParams.get(LIMIT_PARAM));
	// Bounds and normalisation live in src/lib/lines-param.ts, shared with the
	// page. Malformed or unknown names are dropped, never rejected: a bookmarked
	// line KVV renamed must not 400, and a selection the static dataset cannot
	// resolve makes the pipeline fail open (unfiltered fetch).
	const lines = parseLinesParam(url.searchParams);

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

	if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
		return json(
			{
				ok: false,
				error: {
					code: 'BAD_PARAMS',
					message: `Invalid limit (must be ${MIN_LIMIT}..${MAX_LIMIT})`
				}
			},
			400
		);
	}

	try {
		const departures = await getDepartures(stationId, eventType, limit, lines);

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
