<script lang="ts">
import { translations } from '$lib/i18n';
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { colorClass, countdownText, accompanyingStatusText } from './departure-info';
import Bus from '@lucide/svelte/icons/bus';
import TramFront from '@lucide/svelte/icons/tram-front';

let { departure } = $props();
const now = $state(new Date());

const isBus = $derived(departure.vehicleType?.toLowerCase() === 'bus');
const count = $derived(departure.wagonCount);
const status = $derived(accompanyingStatusText(departure, $translations));
</script>

<div
	class="flex items-start justify-between gap-3 px-1 py-2.5 transition-colors hover:bg-slate-200/30 dark:hover:bg-slate-800/40"
>
	<!-- Left Section: Vehicle Icon, Line Badge & Destination Info -->
	<div class="flex min-w-0 items-start gap-2.5">
		<!-- Vehicle Type Indicator with 2x Badge Bubble -->
		<div
			class="relative flex h-7 w-5 shrink-0 items-center justify-center text-slate-600 dark:text-slate-400"
			title={isBus ? 'Bus' : `${count} Wagon Tram`}
		>
			{#if isBus}
				<Bus class="h-4 w-4 opacity-60 dark:opacity-80" />
			{:else}
				<TramFront class="h-4 w-4 opacity-60 dark:opacity-80" />
				{#if count > 1}
					<span
						class="absolute -right-1.5 -bottom-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-600 px-1 text-[8px] leading-none font-bold text-white shadow-xs dark:bg-slate-400 dark:text-slate-950"
					>
						{count}x
					</span>
				{/if}
			{/if}
		</div>

		<!-- Line Badge -->
		<div class="shrink-0">
			<LineIcon departure={departure} />
		</div>

		<!-- Destination Name + Status Text -->
		<div class="flex min-w-0 flex-1 flex-col">
			{#each departure.direction as direction (direction)}
				<p class="truncate text-sm leading-tight font-semibold text-slate-800 dark:text-slate-100">
					{direction}
				</p>
			{/each}

			{#if status.text}
				<div class="mt-1 flex items-center gap-1.5 text-[11px] leading-none font-medium">
					<span class={colorClass(departure) || 'text-slate-600 dark:text-slate-400'}
						>{status.text}</span
					>
					{#if status.plannedTime}
						<span class="font-normal text-slate-600 line-through dark:text-slate-400">
							{status.plannedTime}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right Section: Departure Countdown / Time -->
	<div class="flex shrink-0 items-center justify-end self-center pt-0.5">
		<p class="text-sm font-bold whitespace-nowrap {colorClass(departure)}">
			{countdownText(departure, now, $translations)}
		</p>
	</div>
</div>
