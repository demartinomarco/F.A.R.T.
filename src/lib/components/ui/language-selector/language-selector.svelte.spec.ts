import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import LanguageSelector from './language-selector.svelte';

// bits-ui renders the trigger as a plain button (aria-haspopup=listbox), so the
// panel and its rows are read straight off the DOM once it is open.
async function openPanel() {
	const trigger = page.getByRole('button', { name: /English|Deutsch/ });
	await userEvent.click(trigger);
	const doc = trigger.element().ownerDocument;
	await expect
		.poll(() => doc.querySelector('[data-slot="select-content"]'), { timeout: 4000 })
		.toBeTruthy();
	return doc.querySelector('[data-slot="select-content"]') as HTMLElement;
}

describe('LanguageSelector', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('shows the current language on the trigger', async () => {
		render(LanguageSelector);

		await expect.element(page.getByRole('button', { name: 'English' })).toBeVisible();
	});

	it('opens a panel shaped like the platform selector popover', async () => {
		render(LanguageSelector);
		const panel = await openPanel();

		const cs = getComputedStyle(panel);
		expect(cs.borderTopLeftRadius).toBe('8px');
		expect(cs.borderTopWidth).toBe('1px');

		const rows = [...panel.querySelectorAll<HTMLElement>('[data-slot="select-item"]')];
		expect(rows.map((r) => r.textContent?.trim())).toEqual(['Deutsch', 'English']);
		for (const row of rows) {
			expect(getComputedStyle(row).paddingTop).toBe('6px');
			expect(getComputedStyle(row).paddingLeft).toBe('8px');
		}
	});

	it('marks the current language with a primary-coloured tick', async () => {
		render(LanguageSelector);
		const panel = await openPanel();

		// bits-ui marks the chosen row through the snippet (no data-state
		// attribute), so find it by value and look for its tick.
		const current = [...panel.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].find(
			(r) => r.dataset.value === 'en'
		);
		const tick = current?.querySelector<SVGElement>('svg');
		const values = [...panel.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
			.map((r) => r.dataset.value)
			.join(',');
		expect(tick, `no tick on the current row; rows: ${values}`).toBeTruthy();

		const probe = document.createElement('span');
		probe.className = 'text-primary';
		document.body.appendChild(probe);
		const primary = getComputedStyle(probe).color;
		probe.remove();

		expect(getComputedStyle(tick as SVGElement).color).toBe(primary);
	});
});
