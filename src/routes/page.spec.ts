import { describe, expect, it } from 'vitest';
import { _getDepartureKey, _getPlatformKey } from './+page';
import { PlatformType, type Departure, type PlatformDepartures } from '@/kvv-trias/types';

function makeDeparture(): Departure {
	return {
		lineName: 'S5',
		direction: ['Pforzheim Hauptbahnhof'],
		plannedTime: new Date('2026-10-30T14:20:00.000Z'),
		vehicleType: 'rail',
		realTime: null,
		wagonCount: 1
	};
}

const platform = { type: PlatformType.Rail, name: '4' };

describe('list keys', () => {
	it('keeps keys unique when identical departures reach the page', () => {
		const departures = [makeDeparture(), makeDeparture()];
		const keys = departures.map((departure, index) => _getDepartureKey(departure, platform, index));

		expect(new Set(keys).size).toBe(2);
	});

	it('keeps keys unique when identical platforms reach the page', () => {
		const platforms: PlatformDepartures[] = [
			{ platform: { ...platform }, departures: [] },
			{ platform: { ...platform }, departures: [] }
		];
		const keys = platforms.map((platformDepartures, index) =>
			_getPlatformKey(platformDepartures, index)
		);

		expect(new Set(keys).size).toBe(2);
	});
});
