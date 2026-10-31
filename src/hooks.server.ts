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

	// Theme is only rendered server-side when the user made an explicit choice.
	// Without a cookie the inline script in app.html follows prefers-color-scheme.
	const cookieTheme = event.cookies.get('theme');
	const theme = cookieTheme === 'dark' || cookieTheme === 'light' ? cookieTheme : null;

	event.locals.locale = validLocale;
	event.locals.theme = theme;

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%lang%', validLocale).replace('%theme%', theme === 'dark' ? 'dark' : '')
	});
};
