import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	optimizeDeps: {
		exclude: ['bits-ui', '@lucide/svelte']
	},

	ssr: {
		noExternal: ['bits-ui', '@lucide/svelte']
	},

	test: {
		projects: [
			{
				name: 'client',
				test: {
					testTimeout: 2000,
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['**/*.bench.ts'],
					setupFiles: ['./src/vitest-setup-client.ts']
				}
			},
			{
				name: 'ssr',
				test: {
					environment: 'node',
					include: ['src/**/*.ssr.{test,spec}.{js,ts}'],
					exclude: ['**/*.bench.ts']
				}
			},
			{
				name: 'server',
				test: {
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: [
						'**/*.bench.ts',
						'src/**/*.svelte.{test,spec}.{js,ts}',
						'src/**/*.ssr.{test,spec}.{js,ts}'
					]
				}
			}
		]
	}
});
