import type { Handle } from '@sveltejs/kit';

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

	// If explicit cookie is set, pass class 'dark', otherwise pass empty string (default)
	const cookieTheme = event.cookies.get('theme');
	const themeClass = cookieTheme === 'dark' ? 'dark' : '';

	event.locals.locale = validLocale;
	event.locals.theme = cookieTheme === 'dark' ? 'dark' : 'light';

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%lang%', validLocale).replace('%theme%', themeClass)
	});
};
