import { describe, expect, it } from 'vitest';
import { consolidateWagons, mapStopEventResultToDeparture } from './map';
import { PlatformType } from './types';

type RawDeparture = Parameters<typeof consolidateWagons>[0][number];

function makeDeparture(opts: {
	lineRef: string;
	lineName?: string;
	platform?: string;
	platformType?: PlatformType;
	time?: string;
	direction?: string[];
	origin?: string;
	realTime?: string | null;
	wagonCount?: number;
}): RawDeparture {
	return {
		lineRef: opts.lineRef,
		origin: opts.origin,
		platform: {
			type: opts.platformType ?? PlatformType.Rail,
			name: opts.platform ?? '4'
		},
		departure: {
			lineName: opts.lineName ?? 'S5',
			direction: opts.direction ?? ['Pforzheim Hauptbahnhof'],
			plannedTime: new Date(opts.time ?? '2026-10-30T14:20:00.000Z'),
			realTime: opts.realTime ? new Date(opts.realTime) : null,
			vehicleType: 'rail',
			wagonCount: opts.wagonCount ?? 1
		}
	};
}

function rawStopEvent(opts: {
	plannedBay: string;
	lineRef?: string;
	lineName?: string;
	destination?: string;
	time?: string;
	realTime?: string;
}) {
	return {
		StopEvent: {
			ThisCall: {
				CallAtStop: {
					PlannedBay: { Text: opts.plannedBay },
					ServiceDeparture: {
						TimetabledTime: opts.time ?? '2026-10-31T12:15:00Z',
						...(opts.realTime ? { EstimatedTime: opts.realTime } : {})
					}
				}
			},
			Service: {
				LineRef: opts.lineRef ?? 'kvv:22305:E:H',
				PublishedLineName: { Text: opts.lineName ?? 'S5' },
				DestinationText: { Text: opts.destination ?? 'Wörth, Badepark' },
				Mode: { PtMode: 'rail' }
			}
		}
	};
}

describe('consolidateWagons', () => {
	it('merges the same train reported by different feeds without double counting wagons', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R' }),
			makeDeparture({
				lineRef: 'ddb:920S5:D:H',
				realTime: '2026-10-30T14:21:00.000Z'
			})
		]);

		expect(result).toHaveLength(1);
		expect(result[0].departure.wagonCount).toBe(1);
		expect(result[0].departure.realTime?.toISOString()).toBe('2026-10-30T14:21:00.000Z');
	});

	it('adds up wagons that share a line ref, even when their destinations differ', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:21001:E:H', direction: ['Heide'], wagonCount: 1 }),
			makeDeparture({ lineRef: 'kvv:21001:E:H', direction: ['Durlach'], wagonCount: 2 })
		]);

		expect(result).toHaveLength(1);
		expect(result[0].departure.wagonCount).toBe(3);
		expect(result[0].departure.direction).toEqual(['Heide', 'Durlach']);
	});

	it('counts coupled wagons once when both feeds report them', () => {
		const sameTrain = [
			makeDeparture({ lineRef: 'kvv:22305:E:R' }),
			makeDeparture({ lineRef: 'kvv:22305:E:R' }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H' }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H' })
		];

		for (const departures of [sameTrain, [...sameTrain].reverse()]) {
			const result = consolidateWagons(departures);

			expect(result).toHaveLength(1);
			expect(result[0].departure.wagonCount).toBe(2);
		}
	});

	it('merges coupled wagons with different destinations when the feeds are interleaved', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', direction: ['A'] }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', direction: ['A'] }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', direction: ['B'] }),
			makeDeparture({ lineRef: 'kvv:22305:E:R', direction: ['B'] })
		]);

		expect(result).toHaveLength(1);
		expect(result[0].departure.wagonCount).toBe(2);
		expect(result[0].departure.direction).toEqual(['A', 'B']);
	});

	it('deduplicates destinations that only differ in case or whitespace', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', direction: ['Pforzheim Hauptbahnhof'] }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', direction: ['  pforzheim hauptbahnhof  '] })
		]);

		expect(result).toHaveLength(1);
		expect(result[0].departure.direction).toEqual(['Pforzheim Hauptbahnhof']);
	});

	it('keeps opposite directions on the same line, time and platform separate', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', direction: ['Pforzheim Hauptbahnhof'] }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', direction: ['Söllingen'] })
		]);

		expect(result).toHaveLength(2);
	});

	it('keeps departures on different platforms separate', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', platform: '4' }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', platform: '3' })
		]);

		expect(result).toHaveLength(2);
	});

	it('keeps departures at different times separate', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', time: '2026-10-30T14:20:00.000Z' }),
			makeDeparture({ lineRef: 'ddb:920S5:D:H', time: '2026-10-30T14:25:00.000Z' })
		]);

		expect(result).toHaveLength(2);
	});

	it('keeps different lines on the same platform and time separate', () => {
		const result = consolidateWagons([
			makeDeparture({ lineRef: 'kvv:22305:E:R', lineName: 'S5' }),
			makeDeparture({ lineRef: 'ddb:920S4:D:H', lineName: 'S4' })
		]);

		expect(result).toHaveLength(2);
	});

	it('drops a DDB short-turn entry when a KVV departure shares the origin', () => {
		const result = consolidateWagons([
			makeDeparture({
				lineRef: 'kvv:21012:E:H',
				lineName: 'S2',
				platform: '3',
				direction: ['Rheinstrandsiedlung'],
				origin: 'Hagsfeld Reitschulschlag',
				time: '2026-10-31T12:44:00.000Z',
				realTime: '2026-10-31T12:44:36.000Z'
			}),
			makeDeparture({
				lineRef: 'ddb:920S2::H',
				lineName: 'S2',
				platform: '',
				platformType: PlatformType.Unknown,
				direction: ['Daxlanden Dornröschenweg'],
				origin: 'Hagsfeld Reitschulschlag (Schleife), Karlsruhe',
				time: '2026-10-31T12:44:18.000Z'
			})
		]);

		expect(result).toHaveLength(1);
		expect(result[0].platform).toEqual({ type: PlatformType.Rail, name: '3' });
		expect(result[0].departure.direction).toEqual(['Rheinstrandsiedlung']);
		expect(result[0].departure.realTime?.toISOString()).toBe('2026-10-31T12:44:36.000Z');
	});

	it('keeps DDB entries that only share the line and time', () => {
		const result = consolidateWagons([
			makeDeparture({
				lineRef: 'kvv:21012:E:H',
				lineName: 'S2',
				platform: '3',
				direction: ['Rheinstrandsiedlung'],
				origin: 'Hagsfeld Reitschulschlag',
				time: '2026-10-31T12:44:00.000Z'
			}),
			makeDeparture({
				lineRef: 'ddb:920S2::H',
				lineName: 'S2',
				platform: '',
				platformType: PlatformType.Unknown,
				direction: ['Somewhere Else'],
				origin: 'Different Origin',
				time: '2026-10-31T12:44:18.000Z'
			})
		]);

		expect(result).toHaveLength(2);
	});

	it('keeps a unique DDB departure without a KVV counterpart', () => {
		const result = consolidateWagons([
			makeDeparture({
				lineRef: 'kvv:21012:E:H',
				lineName: 'S2',
				time: '2026-10-31T12:44:00.000Z'
			}),
			makeDeparture({
				lineRef: 'ddb:EVS31/S3',
				lineName: 'EVS31/S3',
				platform: '',
				platformType: PlatformType.Unknown,
				direction: ['Bruchsal'],
				origin: 'Karlsruhe',
				time: '2026-10-31T12:58:00.000Z'
			})
		]);

		expect(result).toHaveLength(2);
	});
});

describe('mapStopEventResultToDeparture', () => {
	it.each([
		['Gleis 1(U)', PlatformType.Rail, '1(U)'],
		['1U.', PlatformType.Rail, '1(U)'],
		['1 U', PlatformType.Rail, '1(U)'],
		['1u.', PlatformType.Rail, '1(U)'],
		['1 (U)', PlatformType.Rail, '1(U)'],
		['Gleis 1b', PlatformType.Rail, '1B'],
		['1B', PlatformType.Rail, '1B'],
		['1 b', PlatformType.Rail, '1B'],
		['Gleis 2b', PlatformType.Rail, '2B'],
		['Gleis 4', PlatformType.Rail, '4'],
		['Bstg. 3', PlatformType.Bus, '3'],
		['Bstg.3', PlatformType.Bus, '3']
	])('normalizes platform %s to %s', (plannedBay, type, name) => {
		const mapped = mapStopEventResultToDeparture(rawStopEvent({ plannedBay }));

		expect(mapped?.platform).toEqual({ type, name });
	});

	it('merges the same train from two feeds when only the platform spelling differs', () => {
		const kvv = mapStopEventResultToDeparture(
			rawStopEvent({
				plannedBay: 'Gleis 1(U)',
				lineRef: 'kvv:22305:E:H',
				realTime: '2026-10-31T12:15:12Z'
			})
		);
		const ddb = mapStopEventResultToDeparture(
			rawStopEvent({ plannedBay: '1U.', lineRef: 'ddb:920S5:D:H' })
		);

		const result = consolidateWagons([ddb!, kvv!]);

		expect(result).toHaveLength(1);
		expect(result[0].platform).toEqual({ type: PlatformType.Rail, name: '1(U)' });
		expect(result[0].departure.realTime?.toISOString()).toBe('2026-10-31T12:15:12.000Z');
	});

	it('merges platform suffix case differences such as "Gleis 1b" and "1B"', () => {
		const kvv = mapStopEventResultToDeparture(
			rawStopEvent({
				plannedBay: 'Gleis 1b',
				lineRef: 'kvv:22305:E:H',
				realTime: '2026-10-31T12:31:12Z'
			})
		);
		const ddb = mapStopEventResultToDeparture(
			rawStopEvent({ plannedBay: '1B', lineRef: 'ddb:920S5:D:H' })
		);

		const result = consolidateWagons([kvv!, ddb!]);

		expect(result).toHaveLength(1);
		expect(result[0].platform).toEqual({ type: PlatformType.Rail, name: '1B' });
		expect(result[0].departure.realTime?.toISOString()).toBe('2026-10-31T12:31:12.000Z');
	});
});
