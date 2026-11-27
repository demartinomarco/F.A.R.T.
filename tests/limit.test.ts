import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';

const input = (page: Page) => page.getByTestId('limit-input');

// The hooks detect the locale from `accept-language` when no cookie is set —
// Chromium's default would make that English. Pin German explicitly so the
// label assertions test the catalogue, not the browser.
test.beforeEach(async ({ context }) => {
	await context.addCookies([{ name: 'locale', value: 'de', url: BASE_URL }]);
});

// The sidebar is a slide-in panel that starts closed (`sidebarOpen` in
// +page.svelte is `$state(false)`). Toggle through the vendored trigger's
// stable data attribute when the wrapper says `collapsed`; Playwright's
// visibility checks cannot distinguish the off-canvas position.
async function ensureSidebarOpen(page: Page) {
	const wrapper = page.locator('[data-slot="sidebar"]');
	if ((await wrapper.getAttribute('data-state')) !== 'expanded') {
		await page.locator('[data-sidebar="trigger"]').click();
	}
	await expect(wrapper).toHaveAttribute('data-state', 'expanded');
}

// The Filter group is a disclosure that starts closed; its controls (the
// limit input included) are only visible once it is expanded.
async function ensureFilterGroupOpen(page: Page) {
	const toggle = page.getByTestId('filter-group-toggle');
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
		await toggle.click();
	}
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function gotoWithOpenSidebar(page: Page, url = '/') {
	await page.goto(url);
	await ensureSidebarOpen(page);
	await ensureFilterGroupOpen(page);
}

// `displayed` is what the field shows after commit: usually the typed value,
// but an out-of-range entry is replaced by the bounded value it committed to.
async function commit(page: Page, typed: string, displayed = typed) {
	const field = input(page);
	await field.click();
	await field.fill(typed);
	await field.blur();
	await expect(field).toHaveValue(displayed);
}

test.describe('Sidebar limit input', () => {
	test('shows the bounded input, labelled and ready to use', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await expect(page.getByRole('spinbutton', { name: 'Anzahl der Abfahrten' })).toBeVisible();
		await expect(input(page)).toHaveAttribute('min', '1');
		await expect(input(page)).toHaveAttribute('max', '100');
		await expect(input(page)).toHaveValue('20');
		await expect(page.url()).not.toContain('limit=');
	});

	test('stores a changed limit in the URL and restores it on reload', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await commit(page, '42');

		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('42');

		// SSR hydration: the server parses the URL, the sidebar starts from it.
		await page.reload();
		await ensureSidebarOpen(page);
		await ensureFilterGroupOpen(page);

		await expect(input(page)).toHaveValue('42');
	});

	test('clamps out-of-range input into 1..100 (input and URL)', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await commit(page, '999', '100');
		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('100');

		await commit(page, '0', '1');
		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('1');
	});

	test('a malicious bookmark cannot break the page', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(String(error)));

		// No interaction needed — the hydrated input already shows the value
		// the page actually works with. The address bar keeps the raw value
		// until something changes it (see `urlSerializedLimit` in +page.svelte:
		// rewriting it during hydration throws inside SvelteKit's router).
		await page.goto('/?limit=99999');
		await expect(input(page)).toHaveValue('100');

		await page.goto('/?limit=%3Cscript%3Ealert(1)%3C/script%3E');
		await expect(input(page)).toHaveValue('20');
		await expect(page.locator('body')).not.toContainText('Fehler');

		// ...and once the user does change it, the bounded value is what lands
		// in the address bar.
		await ensureSidebarOpen(page);
		await ensureFilterGroupOpen(page);
		await commit(page, '75');
		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('75');

		expect(errors).toEqual([]);
	});

	test('the limit survives the departure/arrival switch', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await commit(page, '42');
		await page.getByRole('radio', { name: 'Ankunft' }).click();

		await expect
			.poll(() => {
				const params = new URL(page.url()).searchParams;
				return `${params.get('eventType')}|${params.get('limit')}`;
			})
			.toBe('arr|42');
		await expect(input(page)).toHaveValue('42');
	});

	// The field must be indistinguishable from the other sidebar fields
	// (platforms select, language select): same box — height, card colour,
	// border, radius, shadow, type size. The trailing spinner column is its
	// own (native-spinner) affordance, not a field chevron, so it is checked
	// functionally below instead of for icon parity.
	for (const theme of ['light', 'dark'] as const) {
		test(`looks exactly like the other sidebar fields (${theme})`, async ({ page, context }) => {
			await context.addCookies([{ name: 'theme', value: theme, url: BASE_URL }]);
			await page.emulateMedia({ colorScheme: theme });
			await gotoWithOpenSidebar(page);

			const boxes = await page.evaluate(() => {
				const box = (el: Element) => {
					const cs = getComputedStyle(el);
					return {
						height: el.getBoundingClientRect().height,
						bg: cs.backgroundColor,
						border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
						radius: cs.borderTopLeftRadius,
						shadow: cs.boxShadow,
						font: cs.fontSize
					};
				};

				const platforms = document.querySelector('#platform-select-input');
				const language = document.querySelector('[data-slot="select-trigger"]');
				const limit = document.querySelector('[data-testid="limit-input"]');
				if (!platforms || !language || !limit) return null;

				return {
					platforms: box(platforms),
					language: box(language),
					limit: box(limit)
				};
			});

			if (!boxes) throw new Error('sidebar fields not found');

			expect(boxes.limit).toEqual(boxes.platforms);
			expect(boxes.limit).toEqual(boxes.language);
		});
	}

	test('the spinner arrows step the value by one and reach the URL', async ({ page }) => {
		await gotoWithOpenSidebar(page);

		await page.getByTestId('limit-increase').click();
		await page.getByTestId('limit-increase').click();
		await expect(input(page)).toHaveValue('22');
		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('22');

		await page.getByTestId('limit-decrease').click();
		await expect(input(page)).toHaveValue('21');
		await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('21');
	});
});
