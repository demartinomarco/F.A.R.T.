import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	countdownText,
	delayMinutes,
	statusColorClass,
	countdownColorClass,
	cancelledTimeClass,
	cancelledStrikeClass,
	plannedTimeStrikeClass,
	accompanyingStatusText,
	departureTone
} from './departure-info';
import { translations } from '$lib/i18n';
import { get } from 'svelte/store';

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
		const strings = get(translations);

		it('returns "keine Angabe" when both times null', () => {
			const d = { plannedTime: null, realTime: null } as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('keine Angabe');
		});

		it('uses realTime when present', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:20:00Z'),
				realTime: new Date('2024-06-01T12:12:00Z')
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('7 Min'); // real - now = 7
		});

		it('returns "Sofort" when tram should be arriving now', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:05:00Z'),
				realTime: new Date('2024-06-01T12:06:00Z')
			} as any;
			const now = new Date('2024-06-01T12:06:00Z');
			expect(countdownText(d, now, strings)).toBe('Sofort');
		});

		it('returns "hh:mm" when no real-time data is present and tram should be arriving now', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:05:00Z'),
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('12:05');
		});

		it('returns "hh:mm" when no real-time data is present and tram is scheduled in the future', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:15:00Z'),
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('12:15');
		});

		it('returns formatted time when diff > 10 and no real-time data is present', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:22:00Z'), // 17 min away
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('12:22');
		});

		it('returns formatted time when diff > 10', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:22:00Z'), // 17 min away
				realTime: new Date('2024-06-01T12:22:00Z')
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('12:22');
		});

		it('rounds diff before branching (10.5 -> 11 => formatted)', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:15:30Z'), // 10.5 away => round 11
				realTime: null
			} as any;
			const now = new Date('2024-06-01T12:05:00Z');
			expect(countdownText(d, now, strings)).toBe('12:15');
		});

		it('rounds realTime to nearest minute when diff > 10 so planned and real can differ by seconds', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:38:00Z'),
				realTime: new Date('2024-06-01T12:38:42Z') // -> should format as 12:39 after rounding to nearest minute
			} as any;

			// Make sure we hit the "diff > 10 => formatted time" branch:
			// real(12:38:42) - now(12:20:00) = 18.7 min -> rounds to 19 (>10)
			const now = new Date('2024-06-01T12:20:00Z');

			expect(countdownText(d, now, strings)).toBe('12:39');
		});
	});

	describe('cancelled departures', () => {
		const strings = get(translations);

		it('shows the planned time instead of a countdown', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:20:00Z'),
				realTime: new Date('2024-06-01T12:22:00Z'),
				cancelled: true
			} as any;

			expect(countdownText(d, new Date('2024-06-01T12:05:00Z'), strings)).toBe('12:20');
		});

		it('labels the accompanying status as cancelled', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:20:00Z'),
				realTime: null,
				cancelled: true
			} as any;

			expect(accompanyingStatusText(d, strings)).toEqual({
				text: strings.departureInfo.cancelled
			});
		});

		it('uses the red tone for the label and the countdown', () => {
			const d = {
				plannedTime: new Date('2024-06-01T12:00:00Z'),
				realTime: new Date('2024-06-01T12:00:00Z'),
				cancelled: true
			} as any;

			expect(departureTone(d)).toBe('cancelled');
			expect(statusColorClass(d)).toBe('text-red-800 dark:text-red-400');
			expect(countdownColorClass(d)).toBe('text-red-800 dark:text-red-400');
		});

		it('uses a centered bar for the cancellation strike-through', () => {
			expect(cancelledTimeClass).toContain('relative');
			expect(cancelledTimeClass).toContain('inline-block');
			expect(cancelledStrikeClass).toContain('top-1/2');
			expect(cancelledStrikeClass).toContain('-translate-y-1/2');
			expect(cancelledStrikeClass).toContain('h-[2px]');
			expect(cancelledStrikeClass).toContain('bg-current');
		});

		it('centers the strike-through on the delayed planned time as well', () => {
			expect(plannedTimeStrikeClass).toContain('top-1/2');
			expect(plannedTimeStrikeClass).toContain('-translate-y-1/2');
			expect(plannedTimeStrikeClass).toContain('h-px');
			expect(plannedTimeStrikeClass).toContain('bg-current');
		});
	});

	describe('departureTone', () => {
		const plannedTime = new Date('2024-06-01T12:00:00Z');

		it('classifies a missing realtime estimate as noRealtime', () => {
			expect(departureTone({ plannedTime, realTime: null } as any)).toBe('noRealtime');
		});

		it('classifies zero delay and early arrivals as onTime', () => {
			expect(
				departureTone({ plannedTime, realTime: new Date('2024-06-01T12:00:00Z') } as any)
			).toBe('onTime');
			expect(
				departureTone({ plannedTime, realTime: new Date('2024-06-01T11:58:00Z') } as any)
			).toBe('onTime');
		});

		it('classifies delays below five minutes as minorDelay', () => {
			expect(
				departureTone({ plannedTime, realTime: new Date('2024-06-01T12:04:00Z') } as any)
			).toBe('minorDelay');
		});

		it('classifies delays of five minutes or more as majorDelay', () => {
			expect(
				departureTone({ plannedTime, realTime: new Date('2024-06-01T12:05:00Z') } as any)
			).toBe('majorDelay');
		});
	});

	describe('statusColorClass', () => {
		const plannedTime = new Date('2024-06-01T12:00:00Z');

		it('uses green for on-time departures', () => {
			const d = { plannedTime, realTime: new Date('2024-06-01T12:00:00Z') } as any;
			expect(statusColorClass(d)).toBe('text-emerald-700 dark:text-emerald-300');
		});

		it('uses orange for delays below five minutes', () => {
			const d = { plannedTime, realTime: new Date('2024-06-01T12:03:00Z') } as any;
			expect(statusColorClass(d)).toBe('text-orange-700 dark:text-yellow-400');
		});

		it('uses red for delays of five minutes or more', () => {
			const d = { plannedTime, realTime: new Date('2024-06-01T12:10:00Z') } as any;
			expect(statusColorClass(d)).toBe('text-red-800 dark:text-red-400');
		});

		it('uses gray when no realtime estimate is available', () => {
			const d = { plannedTime, realTime: null } as any;
			expect(statusColorClass(d)).toBe('text-slate-700 dark:text-slate-300');
		});
	});

	describe('countdownColorClass', () => {
		const plannedTime = new Date('2024-06-01T12:00:00Z');

		it('keeps an on-time countdown neutral instead of coloring it green', () => {
			const d = { plannedTime, realTime: new Date('2024-06-01T12:00:00Z') } as any;
			expect(countdownColorClass(d)).toBe('text-slate-900 dark:text-white');
		});

		it('matches the status color for delayed departures', () => {
			const minor = { plannedTime, realTime: new Date('2024-06-01T12:03:00Z') } as any;
			const major = { plannedTime, realTime: new Date('2024-06-01T12:10:00Z') } as any;

			expect(countdownColorClass(minor)).toBe('text-orange-700 dark:text-yellow-400');
			expect(countdownColorClass(major)).toBe('text-red-800 dark:text-red-400');
		});
	});
});
