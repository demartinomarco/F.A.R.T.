import type { PageLoad } from './$types';
import { translations } from '$lib/i18n';
import { get } from 'svelte/store';

export const load: PageLoad = () => {
	const $translations = get(translations);

	return {
		title: $translations.about.pageTitle
	};
};
