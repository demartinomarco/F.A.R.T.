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

export interface AccompanyingStatus {
	text: string;
	plannedTime?: string;
}

export const accompanyingStatusText = (d: Departure, strings: Translations): AccompanyingStatus => {
	const depString = strings.departureInfo;
	if (!d.realTime) return { text: depString.planned };

	const delay = delayMinutes(d);
	if (delay === 0 || isNaN(delay)) return { text: depString.onTime };

	const formattedTime = d.plannedTime ? formatTime(d.plannedTime) : '';
	const absDelay = Math.abs(delay);

	let statusText = '';

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

export const colorClass = (d: Departure): string => {
	const delay = delayMinutes(d);
	if (isNaN(delay)) return 'text-yellow-500';
	if (delay < 0) return 'text-green-600';
	if (delay > 0) return 'text-[#c30a37]';
	return '';
};

function calculateDifferenceTime(from: Date, to: Date) {
	return Math.round((from.getTime() - to.getTime()) / 60000);
}
