import type { Handle, HandleFetch } from '@sveltejs/kit';
import { handle as originalHandle } from '../../src/hooks.server';
import mockDepartures from '../departures.json';

// Intercept incoming client-side HTTP requests from the browser
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/api/departures') {
		return new Response(JSON.stringify(mockDepartures), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return originalHandle({ event, resolve });
};

// Intercept outgoing server-side fetch calls during SSR
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	if (request.url.includes('/api/departures')) {
		return new Response(JSON.stringify(mockDepartures), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return fetch(request);
};
