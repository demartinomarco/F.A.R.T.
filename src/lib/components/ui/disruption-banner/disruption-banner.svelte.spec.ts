import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { setLocale } from '$lib/i18n';
import DisruptionBanner from './disruption-banner.svelte';
import type { StationBanner } from '@/kvv-trias/disruptions';
import type { Disruption, StationMessage } from '@/kvv-trias/types';

// Situation wording is copied verbatim from the Baden-Baden Festspielhaus
// capture (tests/fixtures/trias/), so this exercises the banner with the text
// lengths and shapes the operator really sends.
function situation(overrides: Partial<Disruption> = {}): Disruption {
	return {
		situationNumber: '100004294_KVV_ICSKVV',
		summary: 'Baden-Baden: Umleitung wegen Baumaßnahme Hindenburgplatz (Phase 2)',
		description: 'Linien 201, 205, 206, 207, 208, 213, 218, 244, X45',
		detail:
			'Wegen Bauarbeiten im Bereich Hindenburgplatz\nbeginnt die Sanierung der Luisenbrücke.\nDie Busverbindung wird umgeleitet.',
		priority: 3,
		scopeType: 'route',
		validFrom: new Date('2026-07-30T01:00:00.000Z'),
		validUntil: new Date('2500-12-30T23:00:59.000Z'),
		affectedStopIds: ['de:08211:32389'],
		...overrides
	};
}

function banner(overrides: Partial<StationBanner> = {}): StationBanner {
	return { messages: [], situations: [], ...overrides };
}

const message = (code: string, text: string): StationMessage => ({ code, text });

describe('DisruptionBanner', () => {
	beforeEach(() => {
		setLocale('en');
	});

	it('renders nothing when the stop has nothing to report', () => {
		const { container } = render(DisruptionBanner, { banner: banner() });

		expect(container.textContent).toBe('');
	});

	it('turns the -4030 machine code into the localized closure copy', async () => {
		render(DisruptionBanner, {
			banner: banner({ messages: [message('-4030', 'STOPEVENT_LOCATIONUNSERVED')] })
		});

		await expect
			.element(page.getByText('This stop is currently not being served (e.g. due to'))
			.toBeVisible();
		// The raw code is machine output and must not reach the passenger.
		expect(page.getByText('STOPEVENT_LOCATIONUNSERVED')).not.toBeInTheDocument();

		setLocale('de');
		await expect
			.element(page.getByText('Die Haltestelle wird derzeit nicht bedient'))
			.toBeVisible();
	});

	it('shows an unknown machine message as the operator notice', async () => {
		render(DisruptionBanner, {
			banner: banner({ messages: [message('-9999', 'INTERN STÖRUNG')] })
		});

		await expect.element(page.getByText('KVV notice: INTERN STÖRUNG')).toBeVisible();
	});

	it('shows the station situation summary', async () => {
		render(DisruptionBanner, { banner: banner({ situations: [situation()] }) });

		await expect
			.element(page.getByText('Baden-Baden: Umleitung wegen Baumaßnahme Hindenburgplatz (Phase 2)'))
			.toBeVisible();
	});

	it('falls back to the description when the operator sent no summary', async () => {
		render(DisruptionBanner, {
			banner: banner({ situations: [situation({ summary: '', description: 'Linie X45' })] })
		});

		await expect.element(page.getByText('Linie X45')).toBeVisible();
	});

	it('keeps the detail hidden until the passenger asks for it', async () => {
		render(DisruptionBanner, { banner: banner({ situations: [situation()] }) });

		// The accessible name flips between Show and Hide, so the locator has to
		// survive the toggle instead of naming one of the two labels.
		const toggle = page.getByRole('button', { name: /details/i });
		await expect.element(toggle).toBeVisible();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(document.body.textContent).not.toContain('Sanierung der Luisenbrücke');

		await userEvent.click(toggle);

		await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByText(/Sanierung der Luisenbrücke/)).toBeVisible();
		await expect.element(toggle).toHaveTextContent('Hide details');

		await userEvent.click(toggle);

		await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(document.body.textContent).not.toContain('Sanierung der Luisenbrücke');
	});

	it('offers no details control for a situation without detail', async () => {
		render(DisruptionBanner, { banner: banner({ situations: [situation({ detail: null })] }) });

		expect(page.getByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
	});

	it('tracks each situation open state on its own', async () => {
		const first = situation({ situationNumber: 'A', detail: 'detail of A' });
		const second = situation({ situationNumber: 'B', detail: 'detail of B' });
		render(DisruptionBanner, { banner: banner({ situations: [first, second] }) });

		await userEvent.click(page.getByRole('button', { name: 'Show details' }).first());

		await expect.element(page.getByText('detail of A')).toBeVisible();
		expect(document.body.textContent).not.toContain('detail of B');
	});
});
