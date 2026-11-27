import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import DepartureInfo from './departure-info.svelte';
import type { Departure, Disruption } from '@/kvv-trias/types';

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

	// The wording below is copied verbatim from the Karlsruhe Ebertstraße capture
	// (tests/fixtures/trias/), including the operator's HTML and abbreviations,
	// because that is what the row has to render without leaking markup.
	function lineSituation(overrides: Partial<Disruption> = {}): Disruption {
		return {
			situationNumber: '100004572_KVV_ICSKVV',
			summary: 'Karlsruhe: Bauarbeiten zwischen Weinbrennerplatz und Mathystraße',
			description: 'Linien: 2, 5, 17, NL2',
			detail:
				'(sie) Bauarbeiten zwischen Weinbrennerplatz und Mathystraße\nUmleitung ab 23. November 2026',
			priority: 3,
			scopeType: 'line',
			validFrom: new Date('2026-11-23T02:07:00.000Z'),
			validUntil: new Date('2027-03-08T02:00:59.000Z'),
			affectedStopIds: [],
			...overrides
		};
	}

	it('marks a ride that carries a warning and names the icon after the situation', async () => {
		// The trigger is an icon only, so its accessible name has to say which
		// warning it opens, not just "warning".
		render(DepartureInfo, { departure: departure({ situations: [lineSituation()] }) });

		await expect
			.element(
				page.getByRole('button', {
					name: 'Karlsruhe: Bauarbeiten zwischen Weinbrennerplatz und Mathystraße'
				})
			)
			.toBeVisible();
	});

	it('shows no warning icon for a ride the feed says nothing about', async () => {
		render(DepartureInfo, { departure: departure() });

		expect(page.getByRole('button')).not.toBeInTheDocument();
	});

	it('falls back to a generic label when the operator sent no summary', async () => {
		render(DepartureInfo, {
			departure: departure({ situations: [lineSituation({ summary: '' })] })
		});

		await expect
			.element(page.getByRole('button', { name: 'Notice for this service' }))
			.toBeVisible();
	});

	it('opens the warning in a dialog with the full operator text', async () => {
		const situation = lineSituation();
		render(DepartureInfo, { departure: departure({ situations: [situation] }) });

		const dialog = page.getByRole('dialog');
		expect(dialog).not.toBeInTheDocument();

		await userEvent.click(
			page.getByRole('button', {
				name: 'Karlsruhe: Bauarbeiten zwischen Weinbrennerplatz und Mathystraße'
			})
		);

		await expect.element(dialog).toBeVisible();
		await expect.element(page.getByText(situation.summary!)).toBeVisible();
		await expect.element(page.getByText('Linien: 2, 5, 17, NL2')).toBeVisible();
		await expect.element(page.getByText(/Umleitung ab 23\. November 2026/)).toBeVisible();

		// The feed delivered this Detail as escaped HTML with named entities; the
		// row dialog must show the decoded wording, never the markup or the raw
		// entities, whichever way the decoding broke.
		expect(page.getByText(/&lt;|&szlig;|&nbsp;/)).not.toBeInTheDocument();
	});

	it('lists every situation of a ride in the one dialog', async () => {
		const second = lineSituation({
			situationNumber: '100004573_KVV_ICSKVV',
			summary: 'Karlsruhe: Straßensperrung Durlacher Allee',
			description: 'Linie 1',
			detail: null
		});
		render(DepartureInfo, { departure: departure({ situations: [lineSituation(), second] }) });

		await userEvent.click(page.getByRole('button'));

		await expect
			.element(page.getByText('Karlsruhe: Straßensperrung Durlacher Allee'))
			.toBeVisible();
		await expect.element(page.getByText('Linien: 2, 5, 17, NL2')).toBeVisible();
	});
});
