import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { countdownText, delayMinutes, plannedTimeLabel, colorClass } from './departure-info';

// Mock formatTime so tests are deterministic and not locale dependent
vi.mock('@/utils', () => ({
	formatTime: (d: Date) => d.toISOString().slice(11, 16) // "HH:mm" in UTC
}));

describe('departure-info', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('delayMinutes', () => {
		it('returns NaN when plannedTime missing', () => {
			expect(delayMinutes({ plannedTime: null, realTime: new Date() } as any)).toBeNaN();
		});

		it('returns NaN when realTime missing', () => {
			expect(delayMinutes({ plannedTime: new Date(), realTime: null } as any)).toBeNaN();
		});

		it('calculates positive delay', () => {
			const departure = {
				realTime: new Date('2024-06-01T12:00:00Z'),
				plannedTime: new Date('2024-06-01T11:58:00Z')
			};
			expect(delayMinutes(departure as any)).toBe(2);
		});

		it('calculates negative delay', () => {
			const departure = {
				realTime: new Date('2024-06-01T12:00:00Z'),
				plannedTime: new Date('2024-06-01T12:05:00Z')
			};
			expect(delayMinutes(departure as any)).toBe(-5);
		});

		it('rounds to nearest minute (up)', () => {
			const departure = {
				realTime: new Date('2024-06-01T12:05:30Z'),
				plannedTime: new Date('2024-06-01T12:00:00Z')
			};
			expect(delayMinutes(departure as any)).toBe(6);
		});

		it('rounds to nearest minute (down)', () => {
			const departure = {
				realTime: new Date('2024-06-01T12:05:29Z'),
				plannedTime: new Date('2024-06-01T12:00:00Z')
			};
			expect(delayMinutes(departure as any)).toBe(5);
		});
	});

	describe('countdownText', () => {
		it('returns "keine Angabe" when both times null', () => {
			const d = { plannedTime: null, realTime: null } as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('keine Angabe');
		});

		it('uses realTime when present', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:20:00Z'),
				realTime: new Date('2024-06-01T12:12:00Z')
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('7 Min'); // real - now = 7
		});

		it('returns "Sofort" when tram should be arriving now', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:05:00Z'),
				realTime: new Date('2024-06-01T12:06:00Z')
			} as any;
			const now = new Date('2024-06-01T12:06:00Z');
			expect(countdownText(d, now)).toBe('Sofort');
		});

		it('returns "hh:mm" when no real-time data is present and tram should be arriving now', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:05:00Z'),
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('12:05');
		});

		it('returns "hh:mm" when no real-time data is present and tram is scheduled in the future', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:15:00Z'),
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('12:15');
		});

		it('returns formatted time when diff > 10 and no real-time data is present', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:22:00Z'), // 17 min away
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('12:22');
		});

		it('returns formatted time when diff > 10', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:22:00Z'), // 17 min away
				realTime: new Date('2024-06-01T12:22:00Z')
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('12:22');
		});

		it('rounds diff before branching (10.5 -> 11 => formatted)', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:15:30Z'), // 10.5 away => round 11
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now)).toBe('12:15');
		});

		it('rounds realTime to nearest minute when diff > 10 so planned and real can differ by seconds', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:38:00Z'),
				realTime: new Date('2024-06-01T12:38:42Z') // -> should format as 12:39 after rounding to nearest minute
			} as any;

			// Make sure we hit the "diff > 10 => formatted time" branch:
			// real(12:38:42) - now(12:20:00) = 18.7 min -> rounds to 19 (>10)
			const now = new Date('2024-06-01T12:20:00Z');

			expect(plannedTimeLabel(d, now)).toBe('(12:38)');
			expect(countdownText(d, now)).toBe('12:39');
		});
	});

	describe('plannedTimeLabel', () => {
		it('returns null when times null (delayMinutes NaN)', () => {
			const d = { realTime: null, plannedTime: null } as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(plannedTimeLabel(d, now)).toBe(null);
		});

		it('returns null when no delay', () => {
			const d = {
				realTime: new Date('2024-06-01T12:00:00Z'),
				plannedTime: new Date('2024-06-01T12:00:00Z')
			} as any;
			const now = new Date('2024-06-01T11:59:00Z');
			expect(plannedTimeLabel(d, now)).toBe(null);
		});

		it('returns planned countdown when plannedCountdown is 1..9 (even if delay is negative)', () => {
			const d = {
				// Early vehicle: real earlier than planned
				realTime: new Date('2024-06-01T12:07:00Z'),
				plannedTime: new Date('2024-06-01T12:10:00Z') // plannedCountdown will be 5
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(plannedTimeLabel(d, now)).toBe('(5 Min)');
		});

		it('returns formatted planned time when plannedCountdown <= 0 (planned time is now/past)', () => {
			const d = {
				realTime: new Date('2024-06-01T12:12:00Z'),
				plannedTime: new Date('2024-06-01T12:03:00Z')
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(plannedTimeLabel(d, now)).toBe('(12:03)');
		});

		it('returns formatted planned time when plannedCountdown >= 10', () => {
			const d = {
				realTime: new Date('2024-06-01T12:12:00Z'), // early vs planned
				plannedTime: new Date('2024-06-01T12:25:00Z') // 20 min away => formatted branch
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(plannedTimeLabel(d, now)).toBe('(12:25)');
		});
	});

	describe('colorClass', () => {
		it('returns "" when delay is NaN', () => {
			const d = { plannedTime: null, realTime: null } as any;
			expect(colorClass(d)).toBe('text-yellow-500');
		});

		it('returns "" when delay is 0', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:00:00Z'),
				realTime: new Date('2024-06-01T12:00:00Z')
			} as any;
			expect(colorClass(d)).toBe('');
		});

		it('returns green when delay negative (early)', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:10:00Z'),
				realTime: new Date('2024-06-01T12:05:00Z')
			} as any;
			expect(colorClass(d)).toBe('text-green-600');
		});

		it('returns red when delay positive (late)', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:05:00Z'),
				realTime: new Date('2024-06-01T12:10:00Z')
			} as any;
			expect(colorClass(d)).toBe('text-[#c30a37]');
		});
	});
});
