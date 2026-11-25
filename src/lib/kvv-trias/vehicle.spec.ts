import { describe, expect, it } from 'vitest';
import { isBusLike, isBusVehicleType, isReplacementBus } from './vehicle';

describe('isBusVehicleType', () => {
	it('accepts the PtMode vocabulary and the German Mode/Name spellings', () => {
		for (const vehicleType of ['bus', 'Bus', 'BUS', ' Stadtbus ', 'Regionalbus']) {
			expect(isBusVehicleType(vehicleType), vehicleType).toBe(true);
		}
	});

	it('rejects rail modes, empty values and anything unknown', () => {
		for (const vehicleType of ['rail', 'tram', 'Regionalbahn', 'S-Bahn', '', 'unknown']) {
			expect(isBusVehicleType(vehicleType), vehicleType).toBe(false);
		}
	});
});

describe('isReplacementBus', () => {
	it('recognises the SEV names KVV publishes', () => {
		const names = [
			'SEV',
			'SEV S4',
			'SEV S41/S42',
			'SEV S7/S8',
			'SEV RB74',
			'SEV RE10',
			'SEV MEX18',
			'SEV 721',
			'SEV721',
			'SEV-Halt',
			'S4 SEV',
			'sev s4'
		];

		for (const name of names) {
			expect(isReplacementBus(name), name).toBe(true);
		}
	});

	it('does not match SEV inside a longer word', () => {
		for (const name of ['SEVAS', 'SEVIE', 'S7', '__proto__']) {
			expect(isReplacementBus(name), name).toBe(false);
		}
	});
});

describe('isBusLike', () => {
	it('is a bus when the mode says so', () => {
		expect(isBusLike('27', 'bus')).toBe(true);
		expect(isBusLike('1', 'Stadtbus')).toBe(true);
	});

	// TRIAS reports the mode of the replaced line, so a replacement for an
	// S-Bahn arrives as `rail` and the mode alone is not enough.
	it('is a bus when only the name says so', () => {
		expect(isBusLike('SEV S4', 'rail')).toBe(true);
		expect(isBusLike('SEV RB74', '')).toBe(true);
	});

	it('is not a bus for ordinary tram and rail lines', () => {
		expect(isBusLike('S4', 'rail')).toBe(false);
		expect(isBusLike('2', 'tram')).toBe(false);
		expect(isBusLike('', '')).toBe(false);
	});
});
