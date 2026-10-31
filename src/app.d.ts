declare global {
	namespace App {
		interface Locals {
			locale: 'de' | 'en';
			/** Explicit user preference, or null when the OS setting decides */
			theme: 'light' | 'dark' | null;
		}
	}
}

export {};
