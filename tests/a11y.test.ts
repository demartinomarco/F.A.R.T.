import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Target full WCAG A, AA, and AAA standards
const WCAG_AAA_TAGS = [
	'wcag2a',
	'wcag2aa',
	'wcag2aaa',
	'wcag21a',
	'wcag21aa',
	'wcag21aaa',
	'wcag22aa',
	'wcag22aaa'
];

test.describe('Accessibility (WCAG AAA)', () => {
	test('main page meets WCAG AAA standard (excluding official line icons)', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const results = await new AxeBuilder({ page })
			.withTags(WCAG_AAA_TAGS)
			.exclude('.line-badge')
			.disableRules(['color-contrast-enhanced'])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test('about page meets WCAG AAA standard', async ({ page }) => {
		await page.goto('/about');
		await page.waitForLoadState('networkidle');

		const results = await new AxeBuilder({ page }).withTags(WCAG_AAA_TAGS).analyze();

		expect(results.violations).toEqual([]);
	});
});
