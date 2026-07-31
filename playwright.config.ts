import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	webServer: {
		// Run preview only (expects build from CI or local step)
		command: 'pnpm preview --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 60 * 1000,
		env: {
			MOCK_API: 'true'
		}
	},
	use: {
		baseURL: 'http://127.0.0.1:4173'
	}
});
