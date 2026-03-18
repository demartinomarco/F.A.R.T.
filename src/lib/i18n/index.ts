import { writable, derived } from 'svelte/store';
import deutsch from './deutsch.json';
import english from './english.json';

export type Locale = 'de' | 'en';

export const locales: { code: Locale; label: string; flag: string }[] = [
	{ code: 'de', label: 'Deutsch', flag: '🇩🇪' },
	{ code: 'en', label: 'English', flag: '🇬🇧' }
];

const _translations: Record<Locale, typeof deutsch> = {
	de: deutsch,
	en: english
};

function getInitialLocale(): Locale {
	if (typeof window !== 'undefined') {
		const saved = localStorage.getItem('locale');
		if (saved === 'de' || saved === 'en') return saved;
	}
	return 'de';
}

export const locale = writable<Locale>(getInitialLocale());

if (typeof window !== 'undefined') {
	locale.subscribe((val) => {
		localStorage.setItem('locale', val);
	});
}

export const translations = derived(locale, ($locale) => _translations[$locale]);

/**
 * Interpolate placeholders like {key} in a template string.
 */
export function interpolate(template: string, params: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}
