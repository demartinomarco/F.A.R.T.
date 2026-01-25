<script lang="ts">
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import type { Departure } from '@/types/departure';
import { formatTime } from '@/utils';

let { cityName, departure } = $props();
const now = $state(new Date());

const countdownText = (d: Departure): string => {
	const t = d.realTime ?? d.plannedTime;
	if (!t) return '–';

	const diff = Math.round((t.getTime() - now.getTime()) / 60000);

	if (diff < 0 || diff === 0) return 'Sofort';
	if (diff > 10) return formatTime(t);
	return `${diff} Min`;
};

const delayMinutes = (d: Departure): number => {
	if (!d.realTime || !d.plannedTime) return 0;
	return Math.round((d.realTime.getTime() - d.plannedTime.getTime()) / 60000);
};

const delayLabel = (d: Departure): string | null => {
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
</script>

<div class="flex items-center justify-between py-1">
	<div class="flex items-center gap-2">
		<LineIcon city={cityName} departure={departure} />
		<p class="min-w-1">{departure.direction}</p>
	</div>

	<p class={colorClass(departure)}>
		{#if delayLabel(departure)}
			<span class="text-black opacity-50">{delayLabel(departure)}</span>
		{/if}

		{countdownText(departure)}
	</p>
</div>
