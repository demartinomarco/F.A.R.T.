import { describe, expect, it } from 'vitest';
import { consolidateWagons } from './map';
import { PlatformType } from './types';

type RawDeparture = Parameters<typeof consolidateWagons>[0][number];

function makeDeparture(opts: {
	lineRef: string;
	lineName?: string;
	platform?: string;
	platformType?: PlatformType;
	time?: string;
	direction?: string[];
	realTime?: string | null;
	wagonCount?: number;
}): RawDeparture {
	return {
		lineRef: opts.lineRef,
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
});
