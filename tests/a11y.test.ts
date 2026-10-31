import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://127.0.0.1:4173';

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

// Official KVV line colours are fixed by the operator and cannot reach AAA,
// so line badges are checked against WCAG AA contrast instead (see below)
const MIN_AA_CONTRAST = 4.5;

const themes = ['light', 'dark'] as const;

function hasDarkClass(htmlClass: string | null | undefined): boolean {
	return (htmlClass ?? '').split(/\s+/).includes('dark');
}

function relativeLuminance([r, g, b]: number[]): number {
	const channel = (value: number) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};

	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: number[], background: number[]): number {
	const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
		(a, b) => b - a
	);

	return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(color: string): number[] {
	return (color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

// axe reports single-character text as "incomplete", so badge contrast is
// measured directly from the computed colours
async function expectLineBadgesMeetAA(page: Page) {
	const badges = await page.locator('.line-badge').evaluateAll((elements) =>
		elements.map((element) => {
			const style = getComputedStyle(element);
			return {
				text: element.textContent?.trim() ?? '',
				color: style.color,
				backgroundColor: style.backgroundColor
			};
		})
	);

	expect(badges.length).toBeGreaterThan(0);

	for (const badge of badges) {
		expect(
			contrastRatio(parseRgb(badge.color), parseRgb(badge.backgroundColor)),
			`line badge "${badge.text}" (${badge.color} on ${badge.backgroundColor})`
		).toBeGreaterThanOrEqual(MIN_AA_CONTRAST);
	}
}

for (const theme of themes) {
	test.describe(`Accessibility (WCAG AAA - ${theme.toUpperCase()} mode)`, () => {
		test.beforeEach(async ({ context, page }) => {
			// Must match the preview host, otherwise the cookie never reaches the server
			await context.addCookies([
				{
					name: 'theme',
					value: theme,
					url: `${BASE_URL}/`
				}
			]);

			await page.emulateMedia({ colorScheme: theme });
		});

		test(`server renders the ${theme} theme from the cookie`, async ({ browser }) => {
			// JavaScript disabled: the class can only come from the SSR response
			const context = await browser.newContext({ javaScriptEnabled: false, baseURL: BASE_URL });
			await context.addCookies([{ name: 'theme', value: theme, url: `${BASE_URL}/` }]);

			const page = await context.newPage();
			await page.goto('/');

			const htmlClass = await page.locator('html').getAttribute('class');

			await context.close();

			expect(hasDarkClass(htmlClass)).toBe(theme === 'dark');
		});

		test(`main page meets WCAG AAA standard (${theme})`, async ({ page }) => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');

			expect(hasDarkClass(await page.locator('html').getAttribute('class'))).toBe(theme === 'dark');

			const results = await new AxeBuilder({ page })
				.withTags(WCAG_AAA_TAGS)
				// Official line icons are checked at AA below, not AAA
				.exclude('.line-badge')
				.analyze();

			expect(results.violations).toEqual([]);

			await expectLineBadgesMeetAA(page);
		});

		test(`about page meets WCAG AAA standard (${theme})`, async ({ page }) => {
			await page.goto('/about');
			await page.waitForLoadState('networkidle');

			const results = await new AxeBuilder({ page }).withTags(WCAG_AAA_TAGS).analyze();

			expect(results.violations).toEqual([]);
		});
	});
}
