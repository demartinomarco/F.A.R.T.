const countdownText = (d: Departure): string => {
	const t = d.realTime ?? d.plannedTime;
	if (!t) return '–';

	const diff = Math.round((t.getTime() - now.getTime()) / 60000);

	if (diff < 0 || diff === 0) return 'Sofort';
	if (diff > 10) return formatTime(t);
	return `${diff} Min`;
};

export const delayMinutes = (d: Departure): number => {
	if (!d.realTime || !d.plannedTime) return 0;
	return Math.round((d.realTime.getTime() - d.plannedTime.getTime()) / 60000);
};

export const delayLabel = (d: Departure, now: Datetime): string | null => {
	const delay = delayMinutes(d);
	if (delay == 0) return '';

	const diff = Math.round((d.realTime!.getTime() - now.getTime()) / 60000);
	if (diff <= 0) return `(${formatTime(d.plannedTime)})`;
	if (diff > 10) return `(${formatTime(d.plannedTime)})`;

	const plannedCountdown = Math.round((d.plannedTime!.getTime() - now.getTime()) / 60000);
	if (plannedCountdown > 0) return `(${plannedCountdown} Min)`;
	else return '(Sofort)';
};

const colorClass = (d: Departure): string => {
	const delay = delayMinutes(d);
	if (delay < 0) return 'text-green-600';
	if (delay > 0) return 'text-[#c30a37]';
	return '';
};