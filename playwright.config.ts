import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	webServer: {
		// Explicitly set host, port, and use pnpm
		command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000 // 120s timeout in case build takes longer
	},
	use: {
		baseURL: 'http://127.0.0.1:4173'
	}
});
