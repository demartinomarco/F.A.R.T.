import { test } from '@playwright/test';

// Manual showcase for the departure label tones. Normal test runs skip this
// file; `pnpm test:labels` opens it in a headed Chromium window and pauses so
// the different colours and strike-throughs can be inspected.
test.skip(
	process.env.SHOW_LABEL_STATES !== '1',
	'Run `pnpm test:labels` to open the departure label showcase'
);

test('departure label states', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.pause();
});
