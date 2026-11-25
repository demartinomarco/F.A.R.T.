import type { Handle, HandleFetch } from '@sveltejs/kit';
import { handle as originalHandle } from '../../src/hooks.server';
import mockDepartures from '../departures.json';

// Mirror the production API: honor the `lines` parameter by filtering the
// mock data to the selected lines. The client-side display filter would hide
// the rest anyway, but this keeps the "no departures for filter" empty state
// and the per-line counts honest in mock mode.
function departuresResponse(url: URL): Response {
	const rawLines = url.searchParams.get('lines');
	let body: unknown = mockDepartures;

	if (rawLines) {
		const wanted = new Set(
			rawLines
				.split(',')
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
		);
		const data = mockDepartures as {
			data: { platforms: { platform: unknown; departures: { lineName: string }[] }[] };
		};

		body = {
			...mockDepartures,
			data: {
				...data.data,
				platforms: data.data.platforms
					.map((platform) => ({
						...platform,
						departures: platform.departures.filter((departure) => wanted.has(departure.lineName))
					}))
					.filter((platform) => platform.departures.length > 0)
			}
		};
	}

	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// Intercept incoming client-side HTTP requests from the browser
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/api/departures') {
		return departuresResponse(event.url);
	}

	return originalHandle({ event, resolve });
};

// Intercept outgoing server-side fetch calls during SSR
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	if (request.url.includes('/api/departures')) {
		return departuresResponse(new URL(request.url));
	}

	return fetch(request);
};
