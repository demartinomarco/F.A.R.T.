import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import LineFilter from './line-filter.svelte';
import type { LineOption } from '@/kvv-trias/types';

const options: LineOption[] = [
	{ name: 'S1', vehicleType: 'rail' },
	{ name: '2', vehicleType: 'tram' },
	{ name: '27', vehicleType: 'bus' }
];

const badge = (line: string) => page.getByTestId(`line-option-${line}`);
const toggle = () => page.getByTestId('line-filter-toggle');
const count = () => page.getByTestId('line-filter-selected-count');

describe('LineFilter', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('shows an empty state when the station has no lines', async () => {
		render(LineFilter, { options: [] });

		await expect.element(page.getByText('No lines available')).toBeVisible();
	});

	it('starts collapsed: the header is visible, the badge list is hidden', async () => {
		render(LineFilter, { options });

		await expect.element(toggle()).toBeVisible();
		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'false');
		await expect.element(toggle()).toHaveAttribute('aria-controls', 'line-filter-options');
		await expect.element(count()).not.toBeInTheDocument();
		for (const line of ['S1', '2', '27']) {
			await expect.element(badge(line)).not.toBeVisible();
		}
	});

	it('expands the badge list on the first click and collapses it on the second', async () => {
		render(LineFilter, { options });

		await userEvent.click(toggle());

		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'true');
		for (const line of ['S1', '2', '27']) {
			await expect.element(badge(line)).toBeVisible();
		}

		await userEvent.click(toggle());

		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'false');
		for (const line of ['S1', '2', '27']) {
			await expect.element(badge(line)).not.toBeVisible();
		}
	});

	it('renders each line as a badge with a toggle button', async () => {
		render(LineFilter, { options });

		await userEvent.click(toggle());

		for (const line of ['S1', '27']) {
			await expect.element(badge(line)).toBeVisible();
			await expect.element(badge(line)).toHaveAttribute('aria-pressed', 'false');
			expect(badge(line).element().querySelector('.line-badge')?.textContent?.trim()).toBe(line);
		}
	});

	it('fades every other badge once a line is selected', async () => {
		render(LineFilter, { options });

		await userEvent.click(toggle());
		await userEvent.click(badge('S1'));

		await expect.element(badge('S1')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(badge('S1')).toHaveClass('opacity-100');
		await expect.element(badge('2')).toHaveClass('opacity-40');
		await expect.element(badge('27')).toHaveClass('opacity-40');
	});

	it('supports selecting multiple lines', async () => {
		render(LineFilter, { options });

		await userEvent.click(toggle());
		await userEvent.click(badge('S1'));
		await userEvent.click(badge('27'));

		await expect.element(badge('S1')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(badge('27')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(badge('2')).toHaveClass('opacity-40');
	});

	it('restores full color for every badge once the last selection is removed', async () => {
		render(LineFilter, { options, selectedLines: ['S1', '27'] });

		await userEvent.click(toggle());
		await userEvent.click(badge('S1'));
		await expect.element(badge('S1')).toHaveAttribute('aria-pressed', 'false');
		await expect.element(badge('27')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(badge('2')).toHaveClass('opacity-40');

		await userEvent.click(badge('27'));

		for (const line of ['S1', '2', '27']) {
			await expect.element(badge(line)).toHaveAttribute('aria-pressed', 'false');
			await expect.element(badge(line)).toHaveClass('opacity-100');
		}
	});

	it('clears the whole selection with the clear-all button', async () => {
		render(LineFilter, { options, selectedLines: ['S1', '27'] });

		await userEvent.click(toggle());
		const clearAll = page.getByTestId('line-filter-clear-all');
		await expect.element(clearAll).toBeVisible();
		await userEvent.click(clearAll);

		for (const line of ['S1', '2', '27']) {
			await expect.element(badge(line)).toHaveAttribute('aria-pressed', 'false');
			await expect.element(badge(line)).toHaveClass('opacity-100');
		}
		await expect.element(clearAll).not.toBeInTheDocument();
	});

	it('hides the clear-all button while nothing is selected', async () => {
		render(LineFilter, { options });

		await expect.element(page.getByTestId('line-filter-clear-all')).not.toBeInTheDocument();
	});

	it('shows the selected-line count while collapsed instead of the badges', async () => {
		render(LineFilter, { options, selectedLines: ['S1', '27'] });

		// Collapsed by default: the count is visible immediately, the badges
		// are not.
		await expect.element(count()).toBeVisible();
		await expect.element(count()).toHaveTextContent('2');
		await expect.element(badge('S1')).not.toBeVisible();
		await expect.element(page.getByTestId('line-filter-clear-all')).not.toBeInTheDocument();

		// Expanding hides the count again and shows the badges.
		await userEvent.click(toggle());
		await expect.element(count()).not.toBeInTheDocument();
		await expect.element(badge('S1')).toBeVisible();
		await expect.element(page.getByTestId('line-filter-clear-all')).toBeVisible();

		// Deselect one line and collapse again: the count follows the
		// selection. With nothing left selected it disappears entirely.
		await userEvent.click(badge('27'));
		await userEvent.click(toggle());
		await expect.element(count()).toHaveTextContent('1');

		await userEvent.click(toggle());
		await userEvent.click(badge('S1'));
		await userEvent.click(toggle());
		await expect.element(count()).not.toBeInTheDocument();
	});

	it('keeps the header and the toggle hidden-free when there are no lines', async () => {
		render(LineFilter, { options: [] });

		await expect.element(page.getByText('No lines available')).toBeVisible();
		await expect.element(page.getByTestId('line-filter-toggle')).not.toBeInTheDocument();
	});
});
