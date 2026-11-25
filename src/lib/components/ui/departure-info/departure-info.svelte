<script lang="ts">
import { translations } from '$lib/i18n';
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { isBusLike } from '@/kvv-trias/vehicle';
import {
	statusColorClass,
	countdownColorClass,
	cancelledTimeClass,
	cancelledStrikeClass,
	plannedTimeStrikeClass,
	countdownText,
	accompanyingStatusText
} from './departure-info';
import Bus from '@lucide/svelte/icons/bus';
import TramFront from '@lucide/svelte/icons/tram-front';

let { departure } = $props();
const now = $state(new Date());

// A rail replacement runs as a bus even though the feed reports the mode of the
// replaced line, and `Mode/Name` arrives as `Stadtbus`/`Regionalbus` rather than
// the bare `bus` of `Mode/PtMode` — the shared predicate knows both.
const isBus = $derived(isBusLike(departure.lineName, departure.vehicleType));
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
			{#each departure.direction as direction, index (index)}
				<p class="truncate text-sm leading-tight font-semibold text-slate-800 dark:text-slate-100">
					{direction}
				</p>
			{/each}

			{#if status.text}
				<div class="mt-1 flex items-center gap-1.5 text-[12px] leading-none font-medium">
					<span class={statusColorClass(departure)} data-tone-color="true">{status.text}</span>
					{#if status.plannedTime}
						<span class="relative inline-block font-normal text-slate-600 dark:text-slate-400">
							<span class={plannedTimeStrikeClass} aria-hidden="true"></span>
							{status.plannedTime}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right Section: Departure Countdown / Time -->
	<div class="flex shrink-0 items-center justify-end self-center pt-0.5">
		<p
			class="text-sm font-bold whitespace-nowrap {countdownColorClass(
				departure
			)} {departure.cancelled ? cancelledTimeClass : ''}"
			data-tone-color="true"
			title={departure.cancelled ? $translations.departureInfo.cancelled : undefined}
		>
			{#if departure.cancelled}
				<span class={cancelledStrikeClass} aria-hidden="true"></span>
			{/if}
			{countdownText(departure, now, $translations)}
		</p>
	</div>
</div>
