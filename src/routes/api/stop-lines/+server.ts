import type { RequestHandler } from '@sveltejs/kit';
import { linesForStop } from '@/server/stop-lines';

// Same station id grammar as /api/departures (de: region codes, fr: the
// Strasbourg border stops in the KVV tariff area, NL: border stops).
const STATION_ID_PATTERN = /^(de|fr|NL):(\d{5}|S):\d{1,8}$/;

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers
		}
	});
}

// GET /api/stop-lines?stationId=… -> { ok, data: { stationId, lines } }
// `lines` is the static per-stop line list (KVV GTFS rail + TRIAS bus probe,
// see src/lib/server/stop-lines.ts); stops that the dataset does not know
// (including valid but unserved ids) yield an empty list — the page then just
// offers the lines from the live departures.
export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('stationId') ?? '';

	if (!STATION_ID_PATTERN.test(stationId)) {
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

	return json({ ok: true, data: { stationId, lines: linesForStop(stationId) } }, 200, {
		// The dataset is static per build; browsers can hold it long and
		// refresh in the background after the freshness window.
		'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
	});
};
