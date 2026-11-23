import { describe, expect, it } from 'vitest';
import { getLineStyle } from './lines';
import type { Departure } from '@/kvv-trias/types';

function makeDeparture(overrides: Partial<Departure> = {}): Departure {
	return {
		lineName: 'S5',
		direction: ['Pforzheim Hauptbahnhof'],
		plannedTime: new Date('2026-01-01T12:00:00'),
		vehicleType: 'rail',
		realTime: null,
		wagonCount: 1,
		cancelled: false,
		...overrides
	};
}

describe('getLineStyle', () => {
	const unknownStyle = getLineStyle(makeDeparture({ lineName: 'NotARealLine' }));

	it('falls back to the default style for prototype-chain names', () => {
		// LINE_STYLES is a plain object: a naive `LINE_STYLES[name] ?? fallback`
		// returns the truthy prototype for `__proto__`/`constructor`, producing
		// `background-color: undefined`. Ghost badges from `?lines=` URLs make
		// line names attacker-controlled, so the lookup must stay on own props.
		expect(getLineStyle(makeDeparture({ lineName: '__proto__', vehicleType: '' }))).toEqual(
			unknownStyle
		);
		expect(getLineStyle(makeDeparture({ lineName: 'constructor', vehicleType: '' }))).toEqual(
			unknownStyle
		);
		expect(getLineStyle(makeDeparture({ lineName: 'toString', vehicleType: '' }))).toEqual(
			unknownStyle
		);
	});

	it('still resolves known lines', () => {
		expect(getLineStyle(makeDeparture({ lineName: 'S1' })).background).toBe('#008256');
		expect(getLineStyle(makeDeparture({ lineName: '27', vehicleType: 'bus' })).background).toBe(
			'#882287'
		);
	});
});
