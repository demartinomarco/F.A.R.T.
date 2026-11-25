import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import MultiSelect from './multi-select.svelte';

const trigger = () => page.getByRole('button', { name: 'Platforms' });

describe('MultiSelect (platform field)', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('shows the placeholder while nothing is selected', async () => {
		render(MultiSelect, { platformNames: ['1', '2'] });

		await expect.element(page.getByText('Select a platform...')).toBeVisible();
		await expect.element(trigger()).toHaveAttribute('aria-expanded', 'false');
	});

	it('renders one chip per selected platform and no nested button in the trigger', async () => {
		// A <button> inside the trigger button is invalid HTML and breaks the
		// keyboard path, so the chip's × must not be a control.
		render(MultiSelect, { platformNames: ['1', '2'], selectedPlatforms: ['1', '2'] });

		await expect.element(page.getByTestId('chip-remove-1')).toBeVisible();
		await expect.element(page.getByTestId('chip-remove-2')).toBeVisible();
		expect(trigger().element()?.querySelectorAll('button')).toHaveLength(0);
	});

	it('dismisses a chip when the × is clicked, without opening the popover', async () => {
		render(MultiSelect, { platformNames: ['1', '2'], selectedPlatforms: ['1', '2'] });

		await userEvent.click(page.getByTestId('chip-remove-2'));

		await expect.element(page.getByTestId('chip-remove-2')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('chip-remove-1')).toBeVisible();
		await expect.element(trigger()).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens the option list when the trigger itself is clicked', async () => {
		render(MultiSelect, { platformNames: ['1', '2'] });

		await userEvent.click(trigger());

		await expect.element(trigger()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
		await expect.element(page.getByRole('button', { name: '2', exact: true })).toBeVisible();

		// The rows have to highlight for the keyboard as well as for the mouse,
		// otherwise tabbing the list is a blind jump.
		expect(
			page.getByRole('button', { name: '1', exact: true }).element()?.className ?? ''
		).toContain('focus-visible:bg-accent');
	});

	it('draws the app-wide focus halo (3px ring at 50%), never a ring-offset halo', () => {
		render(MultiSelect, { platformNames: ['1'] });

		const cls = trigger().element()?.className ?? '';
		expect(cls).toMatch(/focus-visible:ring-(\[3px\]|3)/);
		expect(cls).toContain('focus-visible:ring-ring/50');
		expect(cls).not.toMatch(/ring-offset/);
	});
});
