import { formatTime } from '@/utils';
import type { Departure } from '@/types/departure';

export const countdownText = (d: Departure, now: Date): string => {
	const t = d.realTime ?? d.plannedTime;
	if (!t) return 'keine Angabe';

	if (!d.realTime) return formatTime(d.plannedTime!);

	const diff = calculateDifferenceTime(t, now);

	if (diff <= 0) return 'Sofort';
	if (diff > 10) return formatTime(t);
	return `${diff} Min`;
};

export const delayMinutes = (d: Departure): number => {
	if (!d.realTime || !d.plannedTime) return NaN;
	return calculateDifferenceTime(d.realTime, d.plannedTime);
};

export const plannedTimeLabel = (d: Departure, now: Date): string | null => {
	const delay = delayMinutes(d);
	if (delay === 0 || isNaN(delay)) return null;

	const plannedCountdown = calculateDifferenceTime(d.plannedTime!, now);
	// Planned arrival is in the near future, so return countdown in minutes
	if (plannedCountdown > 0 && plannedCountdown < 10) return `(${plannedCountdown} Min)`;
	// In this case, the tram actual arrival either was in the past
	// OR it was expected to arrive in more than 10 minutes.
	// In both cases, show the formatted planned time.
	return `(${formatTime(d.plannedTime)})`;
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
