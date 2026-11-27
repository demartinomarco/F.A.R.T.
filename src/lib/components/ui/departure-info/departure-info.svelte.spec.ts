import { beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import DepartureInfo from './departure-info.svelte';
import type { Departure } from '@/kvv-trias/types';

function departure(overrides: Partial<Departure> = {}): Departure {
	return {
		lineName: 'S5',
		direction: ['Bretten'],
		plannedTime: new Date('2026-11-27T12:00:00.000Z'),
		realTime: null,
		vehicleType: 'rail',
		wagonCount: 1,
		cancelled: false,
		situations: [],
		notServiced: false,
		...overrides
	};
}

describe('DepartureInfo', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('says only "Cancelled" when a cancelled service is also flagged not served', async () => {
		// TRIAS reports the two separately (Cancelled on the Service,
		// NotServicedStop on this CallAtStop), and a cancelled service always
		// skips the stop too. Two labels for one fact just crowd the row, so the
		// stronger claim is the one that stays.
		render(DepartureInfo, { departure: departure({ cancelled: true, notServiced: true }) });

		await expect.element(page.getByText('Cancelled')).toBeVisible();
		await expect.element(page.getByText('Does not stop here')).not.toBeInTheDocument();
	});

	it('still says "Does not stop here" for a service that runs but skips the stop', async () => {
		render(DepartureInfo, { departure: departure({ notServiced: true }) });

		await expect.element(page.getByText('Does not stop here')).toBeVisible();
		await expect.element(page.getByText('Cancelled')).not.toBeInTheDocument();
	});

	it('draws the cancellation strike as wide as the countdown, not as wide as the column', async () => {
		// The bar is positioned with inset-x-0, so whatever box carries
		// `relative` defines its length: it has to be the span around the text,
		// not the fixed-width countdown column.
		const { container } = render(DepartureInfo, { departure: departure({ cancelled: true }) });

		const column = container.querySelector('p.w-14');
		const text = column?.querySelector('span.inline-block');
		const bar = text?.querySelector('span[aria-hidden="true"].inset-x-0');
		expect(column, 'fixed-width countdown column').toBeTruthy();
		expect(text, 'inline box around the countdown text').toBeTruthy();
		expect(bar, 'strike bar inside the text box').toBeTruthy();

		const barWidth = bar!.getBoundingClientRect().width;
		const textWidth = text!.getBoundingClientRect().width;
		const columnWidth = column!.getBoundingClientRect().width;

		expect(Math.abs(barWidth - textWidth)).toBeLessThan(1);
		expect(barWidth).toBeLessThan(columnWidth);
	});
});
