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

const themes = ['light', 'dark'] as const;

for (const theme of themes) {
	test.describe(`Accessibility (WCAG AAA - ${theme.toUpperCase()} mode)`, () => {
		test.beforeEach(async ({ context, page }) => {
			await context.addCookies([
				{
					name: 'theme',
					value: theme,
					domain: 'localhost',
					path: '/'
				}
			]);

			await page.emulateMedia({ colorScheme: theme });
		});

		test(`main page meets WCAG AAA standard (${theme})`, async ({ page }) => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');

			const results = await new AxeBuilder({ page })
				.withTags(WCAG_AAA_TAGS)
				// Excludes official line icons from axe analysis
				.exclude('.line-badge')
				.analyze();

			expect(results.violations).toEqual([]);
		});

		test(`about page meets WCAG AAA standard (${theme})`, async ({ page }) => {
			await page.goto('/about');
			await page.waitForLoadState('networkidle');

			const results = await new AxeBuilder({ page }).withTags(WCAG_AAA_TAGS).analyze();

			expect(results.violations).toEqual([]);
		});
	});
}
