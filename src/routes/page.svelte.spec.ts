import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { ApiResponse } from '@/types/departure';

const mockItem: ApiResponse = {
	stationName: 'Hauptbahnhof (Karlsruhe)',
	cityName: 'Karlsruhe',
	departureList: [
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: null,
			type: 'S-Bahn',
			realTime: null
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:03:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:05:00')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:10:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:10:30')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:10:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:15:30')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:03:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:12:00')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:20:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:12:00')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:25:00'),
			type: 'S-Bahn',
			realTime: new Date('2024-06-01T12:22:00')
		},
		{
			lineName: 'S1',
			direction: 'Karlsruhe Hbf',
			platformName: 'Gleis 1',
			plannedTime: new Date('2024-06-01T12:25:00'),
      type: 'S-Bahn',
      realTime: null
		}
	]
};

vi.mock('./+page', async () => {
	// If +page.ts has other exports that Page relies on, spread the real module:
	const actual = await vi.importActual<typeof import('./+page')>('./+page');

	return {
		...actual,
		_fetchDepartures: vi.fn(async () => mockItem)
	};
});

describe('/+page.svelte', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-01T12:05:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should render h1', async () => {
		render(Page, {
			props: {
				data: { item: mockItem }
			}
		});

		const heading = page.getByText(/Hauptbahnhof/i);
		await expect.element(heading).toBeInTheDocument();
	});
});
