import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import LimitInput from './limit-input.svelte';

// The committed value is observable from the field itself: on commit the
// component writes the applied (bounded) value back into the input, so what
// the field shows after blur or Enter is exactly what was handed to the page.
// Matching by label also pins the <Label for>/id association screen readers
// need.
const field = () => page.getByLabelText('Number of departures');

async function typeAndCommit(value: string) {
	const input = field().element() as HTMLInputElement;
	input.focus();
	await userEvent.clear(input);
	if (value) await userEvent.type(input, value);
	await userEvent.tab();
}

describe('LimitInput', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('renders a labelled number input bounded to 1..100', async () => {
		render(LimitInput, { limit: 20 });

		await expect.element(field()).toBeVisible();
		await expect.element(field()).toHaveAttribute('type', 'number');
		await expect.element(field()).toHaveAttribute('min', '1');
		await expect.element(field()).toHaveAttribute('max', '100');
		await expect.element(field()).toHaveAttribute('step', '1');
	});

	it('shows the limit the page passes in', async () => {
		render(LimitInput, { limit: 42 });

		await expect.element(field()).toHaveValue(42);
	});

	it('falls back to the default when the page passes no limit', async () => {
		render(LimitInput);

		await expect.element(field()).toHaveValue(20);
	});

	it('keeps a partial entry as a draft while typing', async () => {
		// "1" on the way to "15" must not be clamped or refetched mid-word:
		// only blur or Enter commits.
		render(LimitInput, { limit: 20 });

		const input = field().element() as HTMLInputElement;
		input.focus();
		await userEvent.clear(input);
		await userEvent.type(input, '15');

		await expect.element(field()).toHaveValue(15);
	});

	it('commits the typed value on blur', async () => {
		render(LimitInput, { limit: 20 });

		await typeAndCommit('15');

		await expect.element(field()).toHaveValue(15);
	});

	it('commits the typed value on Enter', async () => {
		render(LimitInput, { limit: 20 });

		const input = field().element() as HTMLInputElement;
		input.focus();
		await userEvent.clear(input);
		await userEvent.type(input, '7');
		await userEvent.keyboard('{Enter}');

		await expect.element(field()).toHaveValue(7);
	});

	it('clamps an out-of-range value into the bounds on commit', async () => {
		render(LimitInput, { limit: 20 });

		await typeAndCommit('999');
		await expect.element(field()).toHaveValue(100);

		await typeAndCommit('0');
		await expect.element(field()).toHaveValue(1);
	});

	it('reverts a malformed value typed into the number field', async () => {
		render(LimitInput, { limit: 42 });

		// A number input happily accepts exponent notation, but it is not a
		// plain integer: committing must revert to the applied value.
		const input = field().element() as HTMLInputElement;
		input.focus();
		await userEvent.type(input, 'e5');
		expect(input.value).toBe('42e5');

		await userEvent.tab();

		await expect.element(field()).toHaveValue(42);
	});

	it('reverts an emptied field instead of committing anything', async () => {
		render(LimitInput, { limit: 42 });

		await typeAndCommit('');

		await expect.element(field()).toHaveValue(42);
	});

	it('renders the German label from the i18n catalogue', async () => {
		setLocale('de');
		render(LimitInput, { limit: 20 });

		await expect.element(page.getByLabelText('Anzahl der Abfahrten')).toBeVisible();
	});
});

describe('LimitInput spinner arrows', () => {
	const increase = () => page.getByTestId('limit-increase');
	const decrease = () => page.getByTestId('limit-decrease');

	beforeEach(() => {
		setLocale('en');
	});

	it('steps the applied value by one, immediately (no blur needed)', async () => {
		render(LimitInput, { limit: 20 });

		await userEvent.click(increase());
		await expect.element(field()).toHaveValue(21);

		await userEvent.click(decrease());
		await userEvent.click(decrease());
		await expect.element(field()).toHaveValue(19);
	});

	it('steps from the value being typed, not from the applied one', async () => {
		render(LimitInput, { limit: 20 });

		const input = field().element() as HTMLInputElement;
		input.focus();
		await userEvent.clear(input);
		await userEvent.type(input, '50');

		await userEvent.click(increase());

		await expect.element(field()).toHaveValue(51);
	});

	it('disables the increase arrow at the maximum, draft included', async () => {
		render(LimitInput, { limit: 100 });
		await expect.element(increase()).toBeDisabled();
		await expect.element(decrease()).toBeEnabled();

		// A draft beyond the bound disables it too (it is what the user sees).
		const input = field().element() as HTMLInputElement;
		input.focus();
		await userEvent.clear(input);
		await userEvent.type(input, '101');
		await expect.element(increase()).toBeDisabled();
	});

	it('disables the decrease arrow at the minimum', async () => {
		render(LimitInput, { limit: 1 });

		await expect.element(decrease()).toBeDisabled();
		await expect.element(increase()).toBeEnabled();
	});

	it('labels the arrows through the i18n catalogue, in both locales', async () => {
		render(LimitInput, { limit: 20 });

		await expect.element(increase()).toHaveAccessibleName('More departures');
		await expect.element(decrease()).toHaveAccessibleName('Fewer departures');

		setLocale('de');

		await expect.element(increase()).toHaveAccessibleName('Mehr Abfahrten');
		await expect.element(decrease()).toHaveAccessibleName('Weniger Abfahrten');
	});
});
