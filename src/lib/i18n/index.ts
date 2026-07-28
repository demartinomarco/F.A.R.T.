import { writable, derived } from 'svelte/store';
import deutsch from './deutsch.json';
import english from './english.json';

export type Locale = 'de' | 'en';
export type Translations = typeof deutsch;

export const locales: { code: Locale; label: string; flag: string }[] = [
	{ code: 'de', label: 'Deutsch', flag: '🇩🇪' },
	{ code: 'en', label: 'English', flag: '🇬🇧' }
];

const _translations: Record<Locale, typeof deutsch> = {
	de: deutsch,
	en: english
};

export const locale = writable<Locale>('de');

export const translations = derived(locale, ($locale) => _translations[$locale]);

export function setLocale(newLocale: Locale) {
	locale.set(newLocale);
	if (typeof document !== 'undefined') {
		document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
	}
}

export function interpolate(template: string, params: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}
