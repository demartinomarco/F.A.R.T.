import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	test: {
		projects: [
			{
				// Client-side tests (Svelte components)
				extends: true,
				test: {
					name: 'client',
					// Timeout for browser tests - prevent hanging on element lookups
					testTimeout: 2000,
					browser: {
						enabled: true,
						provider: playwright(),
						// Multiple browser instances for better performance
						// Uses single Vite server with shared caching
						instances: [
							{ browser: 'chromium' }
							// { browser: 'firefox' },
							// { browser: 'webkit' },
						]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**', 'src/**/*.ssr.{test,spec}.{js,ts}'],
					setupFiles: ['./src/vitest-setup-client.ts']
				}
			},
			{
				// SSR tests (Server-side rendering)
				extends: true,
				test: {
					name: 'ssr',
					environment: 'node',
					include: ['src/**/*.ssr.{test,spec}.{js,ts}']
				}
			},
			{
				// Server-side tests (Node.js utilities)
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.ssr.{test,spec}.{js,ts}']
				}
			}
		],
		coverage: {
			enabled: true,
			include: ['src'],
			provider: 'v8' // or 'istanbul'

			// Improved performance: Vitest only checks files in src/
			// instead of scanning the entire project
		}
	}
});
