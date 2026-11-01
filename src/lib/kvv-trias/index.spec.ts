import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	postXml: vi.fn(),
	extractStopEventResults: vi.fn()
}));

vi.mock('./http', () => ({
	postXml: mocks.postXml
}));

vi.mock('./parse', () => ({
	parseTriasXml: vi.fn((xml: string) => xml),
	extractStopEventResults: mocks.extractStopEventResults
}));

vi.mock('./env', () => ({
	getKvvTriasConfig: () => ({
		apiUrl: 'https://trias.example.test',
		requestorRef: 'test-requestor'
	})
}));

import { getDepartures } from './index';

type RawEventOptions = {
	lineRef?: string;
	lineName?: string;
	time: string;
	realTime?: string;
	bay?: string;
	origin?: string;
	destination?: string;
};

function rawEvent(opts: RawEventOptions) {
	return {
		StopEvent: {
			ThisCall: {
				CallAtStop: {
					PlannedBay: { Text: opts.bay ?? 'Gleis 1' },
					ServiceDeparture: {
						TimetabledTime: opts.time,
						...(opts.realTime ? { EstimatedTime: opts.realTime } : {})
					}
				}
			},
			Service: {
				LineRef: opts.lineRef ?? 'kvv:22305:E:H',
				PublishedLineName: { Text: opts.lineName ?? 'S5' },
				OriginText: { Text: opts.origin ?? 'Pforzheim Hauptbahnhof' },
				DestinationText: { Text: opts.destination ?? 'Wörth, Badepark' },
				Mode: { PtMode: 'rail' }
			}
		}
	};
}

function departuresOf(result: Awaited<ReturnType<typeof getDepartures>>) {
	return result.platforms.flatMap((platform) => platform.departures);
}

describe('getDepartures', () => {
	beforeEach(() => {
		mocks.postXml.mockReset();
		mocks.extractStopEventResults.mockReset();
		mocks.postXml.mockResolvedValue('<Trias />');
	});

	it('over-fetches, merges duplicate StopEvents and slices after sorting', async () => {
		mocks.extractStopEventResults.mockReturnValue([
			// Planned earlier, but real-time estimate pushes it behind the rest.
			rawEvent({ time: '2026-10-31T12:00:00Z', realTime: '2026-10-31T12:30:00Z', bay: '1' }),
			// Same StopEvent once more, without real-time data.
			rawEvent({ time: '2026-10-31T12:00:00Z', bay: '1' }),
			rawEvent({ time: '2026-10-31T12:05:00Z', bay: '1' }),
			rawEvent({ time: '2026-10-31T12:10:00Z', bay: '2' }),
			rawEvent({ time: '2026-10-31T12:15:00Z', bay: '2' }),
			rawEvent({ time: '2026-10-31T12:20:00Z', bay: '2' })
		]);

		const result = await getDepartures('de:08212:89', 'dep', 3);

		const requestXml = mocks.postXml.mock.calls[0]?.[1] as string;
		expect(requestXml).toContain('<NumberOfResults>6</NumberOfResults>');

		const departures = departuresOf(result);
		expect(departures).toHaveLength(3);
		expect(departures.map((departure) => departure.plannedTime.toISOString())).toEqual([
			'2026-10-31T12:05:00.000Z',
			'2026-10-31T12:10:00.000Z',
			'2026-10-31T12:15:00.000Z'
		]);
	});

	it('fills the requested limit from an over-fetched response containing duplicates', async () => {
		const events = Array.from({ length: 10 }, (_, index) => {
			const minutes = String(index * 5).padStart(2, '0');
			return rawEvent({ time: `2026-10-31T12:${minutes}:00Z`, bay: '1' });
		});

		// Every departure is reported twice (with and without EstimatedTime).
		mocks.extractStopEventResults.mockReturnValue([
			...events,
			...events.map((event) => {
				const copy = structuredClone(event);
				copy.StopEvent.ThisCall.CallAtStop.ServiceDeparture.EstimatedTime =
					copy.StopEvent.ThisCall.CallAtStop.ServiceDeparture.TimetabledTime;
				return copy;
			})
		]);

		const result = await getDepartures('de:08212:89', 'dep', 5);

		expect(departuresOf(result)).toHaveLength(5);
	});

	it('limits the total number of departures, not the number per platform', async () => {
		mocks.extractStopEventResults.mockReturnValue([
			rawEvent({ time: '2026-10-31T12:00:00Z', bay: '1' }),
			rawEvent({ time: '2026-10-31T12:01:00Z', bay: '2' }),
			rawEvent({ time: '2026-10-31T12:02:00Z', bay: '3' }),
			rawEvent({ time: '2026-10-31T12:03:00Z', bay: '4' })
		]);

		const result = await getDepartures('de:08212:89', 'dep', 2);

		expect(departuresOf(result)).toHaveLength(2);
		expect(result.platforms).toHaveLength(2);
	});
});
