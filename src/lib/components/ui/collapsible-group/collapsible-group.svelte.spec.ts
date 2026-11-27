import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Harness from './collapsible-group.spec-harness.svelte';

const toggle = () => page.getByTestId('group-toggle');
const child = () => page.getByTestId('group-child');
const applied = () => page.getByTestId('applied-expanded');

describe('CollapsibleGroup', () => {
	it('renders its title as a disclosure wired to the content', async () => {
		render(Harness, { title: 'Filter' });

		await expect.element(toggle()).toHaveTextContent('Filter');
		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(toggle()).toHaveAttribute('aria-controls', 'group');
		await expect.element(child()).toBeVisible();
	});

	it('starts collapsed when the page says so', async () => {
		render(Harness, { expanded: false });

		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'false');
		await expect.element(child()).not.toBeVisible();
	});

	it('collapses and expands on click, through the binding', async () => {
		render(Harness, { expanded: true });

		await userEvent.click(toggle());
		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'false');
		await expect.element(child()).not.toBeVisible();
		await expect.element(applied()).toHaveTextContent('false');

		await userEvent.click(toggle());
		await expect.element(toggle()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(child()).toBeVisible();
		await expect.element(applied()).toHaveTextContent('true');
	});

	it('shows the active-filter count while collapsed', async () => {
		render(Harness, { expanded: false, badge: 2 });

		await expect.element(page.getByTestId('group-toggle-count')).toHaveTextContent('2');
	});

	it('shows no count when nothing is active', async () => {
		render(Harness, { expanded: false, badge: 0 });

		await expect.element(page.getByTestId('group-toggle-count')).not.toBeInTheDocument();
	});

	it('hides the count while the group is open and reveals it on collapse', async () => {
		render(Harness, { expanded: true, badge: 2 });

		await expect.element(page.getByTestId('group-toggle-count')).not.toBeInTheDocument();

		await userEvent.click(toggle());
		await expect.element(page.getByTestId('group-toggle-count')).toHaveTextContent('2');
	});

	it('points the chevron down while collapsed and up once open', async () => {
		render(Harness, { expanded: true });

		expect(toggle().element()?.querySelector('svg')?.getAttribute('class')).toContain('rotate-180');

		await userEvent.click(toggle());

		expect(toggle().element()?.querySelector('svg')?.getAttribute('class')).not.toContain(
			'rotate-180'
		);
	});
});
