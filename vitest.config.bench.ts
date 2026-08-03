import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib')
		}
	},
	test: {
		name: 'browser-benchmark',
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [
				{
					browser: 'chromium',
					launchOptions: {
						args: ['--no-sandbox', '--disable-setuid-sandbox']
					}
				}
			]
		},
		include: ['src/**/*.bench.ts'],
		setupFiles: ['./src/vitest-setup-client.ts'],
		testTimeout: 120_000,
		hookTimeout: 120_000
	}
});
