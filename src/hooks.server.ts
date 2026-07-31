import type { Handle } from '@sveltejs/kit';
import type { HandleFetch } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
	const cookieLocale = event.cookies.get('locale');

	// Detect browser header if no cookie set
	const acceptLang = event.request.headers.get('accept-language')?.slice(0, 2);

	const validLocale =
		cookieLocale === 'de' || cookieLocale === 'en'
			? cookieLocale
			: acceptLang === 'en'
				? 'en'
				: 'de';

	event.locals.locale = validLocale;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', validLocale)
	});
};
