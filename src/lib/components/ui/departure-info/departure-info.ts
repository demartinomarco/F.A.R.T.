import { formatTime } from '@/utils';
import { interpolate, type Translations } from '$lib/i18n';
import type { Departure } from '@/kvv-trias/types';

function roundToNearestMinute(date: Date): Date {
	const d = new Date(date);
	const ms = d.getTime();
	const rounded = Math.round(ms / 60000) * 60000;
	return new Date(rounded);
}

export const countdownText = (d: Departure, now: Date, strings: Translations): string => {
	if (d.cancelled) return formatTime(d.plannedTime);

	const tt = d.realTime ?? d.plannedTime;
	if (!tt) return strings.departureInfo.noData;

	if (!d.realTime) return formatTime(d.plannedTime!);

	const diff = calculateDifferenceTime(tt, now);

	if (diff <= 0) return strings.departureInfo.now;
	if (diff > 10) {
		return formatTime(roundToNearestMinute(tt));
	}
	return interpolate(strings.departureInfo.minutes, { diff });
};

export const delayMinutes = (d: Departure): number => {
	if (!d.realTime || !d.plannedTime) return NaN;
	return calculateDifferenceTime(d.realTime, d.plannedTime);
};

export type DepartureTone = 'cancelled' | 'noRealtime' | 'onTime' | 'minorDelay' | 'majorDelay';

export const MINOR_DELAY_LIMIT_MINUTES = 5;

// These tones are checked against WCAG AA (>= 4.5:1) rather than AAA, because
// the semantic green/yellow/red palette cannot reach AAA in light mode.
// Everything else on the page still has to pass AAA.
const STATUS_COLORS: Record<DepartureTone, string> = {
	cancelled: 'text-red-800 dark:text-red-400',
	noRealtime: 'text-slate-700 dark:text-slate-300',
	onTime: 'text-emerald-700 dark:text-emerald-300',
	minorDelay: 'text-orange-700 dark:text-yellow-400',
	majorDelay: 'text-red-800 dark:text-red-400'
};

const COUNTDOWN_COLORS: Record<DepartureTone, string> = {
	cancelled: 'text-red-800 dark:text-red-400',
	noRealtime: 'text-slate-700 dark:text-slate-300',
	onTime: 'text-slate-900 dark:text-white',
	minorDelay: 'text-orange-700 dark:text-yellow-400',
	majorDelay: 'text-red-800 dark:text-red-400'
};

export function departureTone(d: Departure): DepartureTone {
	if (d.cancelled) return 'cancelled';
	if (!d.realTime) return 'noRealtime';

	const delay = delayMinutes(d);
	if (isNaN(delay) || delay <= 0) return 'onTime';
	return delay < MINOR_DELAY_LIMIT_MINUTES ? 'minorDelay' : 'majorDelay';
}

export const statusColorClass = (d: Departure): string => STATUS_COLORS[departureTone(d)];

export const countdownColorClass = (d: Departure): string => COUNTDOWN_COLORS[departureTone(d)];

// A positioned bar is used instead of the native `line-through` decoration.
// Native strike-through follows the font's baseline metrics and sits too low
// on some mobile/font combinations; a bar on the line-box centre stays
// vertically centred everywhere.
export const cancelledTimeClass = 'relative inline-block';

const STRIKE_BAR_CLASS =
	'pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 bg-current';

export const cancelledStrikeClass = `${STRIKE_BAR_CLASS} h-[2px]`;
export const plannedTimeStrikeClass = `${STRIKE_BAR_CLASS} h-px`;

export interface AccompanyingStatus {
	text: string;
	plannedTime?: string;
}

export const accompanyingStatusText = (d: Departure, strings: Translations): AccompanyingStatus => {
	const depString = strings.departureInfo;
	if (d.cancelled) return { text: depString.cancelled };
	if (!d.realTime) return { text: depString.planned };

	const delay = delayMinutes(d);
	if (delay === 0 || isNaN(delay)) return { text: depString.onTime };

	const formattedTime = d.plannedTime ? formatTime(d.plannedTime) : '';
	const absDelay = Math.abs(delay);

	let statusText: string;

	if (delay > 0) {
		const template = delay === 1 ? depString.minuteLate : depString.minutesLate;
		statusText = interpolate(template, { delay });
	} else {
		const template = absDelay === 1 ? depString.minuteEarly : depString.minutesEarly;
		statusText = interpolate(template, { delay: absDelay });
	}

	return {
		text: statusText,
		plannedTime: formattedTime ? `(${formattedTime})` : undefined
	};
};

function calculateDifferenceTime(from: Date, to: Date) {
	return Math.round((from.getTime() - to.getTime()) / 60000);
}
