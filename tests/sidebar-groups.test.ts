import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';

const filterToggle = (page: Page) => page.getByTestId('filter-group-toggle');
const settingsToggle = (page: Page) => page.getByTestId('settings-group-toggle');

// The hooks detect the locale from `accept-language` when no cookie is set —
// Chromium's default would make that English. Pin German explicitly so the
// label assertions test the catalogue, not the browser.
test.beforeEach(async ({ context }) => {
	await context.addCookies([{ name: 'locale', value: 'de', url: BASE_URL }]);
});

// The sidebar itself starts closed; see the same helper in limit.test.ts for
// why the wrapper's `data-state` is checked instead of visibility.
async function openSidebar(page: Page) {
	const wrapper = page.locator('[data-slot="sidebar"]');
	if ((await wrapper.getAttribute('data-state')) !== 'expanded') {
		await page.locator('[data-sidebar="trigger"]').click();
	}
	await expect(wrapper).toHaveAttribute('data-state', 'expanded');
}

async function gotoWithOpenSidebar(page: Page, url = '/') {
	await page.goto(url);
	await openSidebar(page);
}

// Inside the Filter group, the line badge list is a disclosure of its own that
// also starts collapsed.
async function ensureLineBadgesVisible(page: Page) {
	if ((await filterToggle(page).getAttribute('aria-expanded')) !== 'true') {
		await filterToggle(page).click();
	}

	const lineToggle = page.getByTestId('line-filter-toggle');
	if ((await lineToggle.getAttribute('aria-expanded')) !== 'true') {
		await lineToggle.click();
	}
	await expect(lineToggle).toHaveAttribute('aria-expanded', 'true');
}

test.describe('Sidebar groups', () => {
	test('the filter group starts closed and the settings group open', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await expect(filterToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(settingsToggle(page)).toHaveAttribute('aria-expanded', 'true');

		// The rails and their rules stay visible while collapsed.
		await expect(filterToggle(page)).toBeVisible();
		await expect(settingsToggle(page)).toBeVisible();

		// Closed group: its controls are not in the accessibility tree at all.
		await expect(page.getByTestId('limit-input')).toBeHidden();
		// Open group: its controls are.
		await expect(page.locator('[data-slot="select-trigger"]')).toBeVisible();
	});

	test('the filter header reveals and hides its controls', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await filterToggle(page).click();
		await expect(filterToggle(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByTestId('limit-input')).toBeVisible();
		await expect(page.getByTestId('line-filter-toggle')).toBeVisible();

		await filterToggle(page).click();
		await expect(filterToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByTestId('limit-input')).toBeHidden();
	});

	test('the settings header collapses its own group, not the other one', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await settingsToggle(page).click();
		await expect(settingsToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('[data-slot="select-trigger"]')).toBeHidden();
		await expect(filterToggle(page)).toHaveAttribute('aria-expanded', 'false');

		await settingsToggle(page).click();
		await expect(page.locator('[data-slot="select-trigger"]')).toBeVisible();
	});

	// A filter must never be invisible: with the group closed, the count of
	// active filters is shown on the rail instead of the controls.
	test('a collapsed filter group still shows the active filter count', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await ensureLineBadgesVisible(page);
		await page.getByTestId('line-option-S1').click();

		await filterToggle(page).click();
		await expect(page.getByTestId('filter-group-toggle-count')).toHaveText('1');

		// Clearing the selection takes the count away again.
		await filterToggle(page).click();
		await page.getByTestId('line-option-S1').click();
		await filterToggle(page).click();
		await expect(page.getByTestId('filter-group-toggle-count')).toBeHidden();
	});

	test('the count carries over a reload, the open state does not', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await ensureLineBadgesVisible(page);
		await page.getByTestId('line-option-S1').click();
		await expect.poll(() => new URL(page.url()).searchParams.get('lines')).toBe('S1');

		await page.reload();
		// No `goto` here: reloading must keep the bookmarked selection, and
		// navigating to `/` would drop it.
		await openSidebar(page);

		// The selection is bookmarked, so the rail announces it right away...
		await expect(filterToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByTestId('filter-group-toggle-count')).toHaveText('1');
	});
});
