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
import * as Dialog from '@/components/ui/dialog/index.js';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Ban from '@lucide/svelte/icons/ban';
import Bus from '@lucide/svelte/icons/bus';
import TramFront from '@lucide/svelte/icons/tram-front';
import type { Departure } from '@/kvv-trias/types';

let { departure }: { departure: Departure } = $props();
const now = $state(new Date());

// A rail replacement runs as a bus even though the feed reports the mode of the
// replaced line, and `Mode/Name` arrives as `Stadtbus`/`Regionalbus` rather than
// the bare `bus` of `Mode/PtMode` — the shared predicate knows both.
const isBus = $derived(isBusLike(departure.lineName, departure.vehicleType));
const count = $derived(departure.wagonCount);
const status = $derived(accompanyingStatusText(departure, $translations));

// Departure-level situations only; the backend already removes
// station-level ones from the rows (they live in the banner).
// Defensive access: older payloads (e.g. mocked data) may not carry
// the field at all.
const rowSituations = $derived((departure.situations ?? []).filter((s) => !!s?.situationNumber));

const warningLabel = $derived(
	rowSituations[0]?.summary || $translations.disruption.warningAriaLabel
);
</script>

<div
	class="flex items-start justify-between gap-3 px-1 py-2.5 transition-colors hover:bg-slate-200/30 dark:hover:bg-slate-800/40 {departure.notServiced
		? 'opacity-60 saturate-50'
		: ''}"
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

			{#if departure.notServiced}
				<!-- Same metrics as the status line above, so the baseline lines up. -->
				<span
					class="mt-1 flex items-center gap-1.5 text-[11px] leading-none font-medium text-slate-600"
				>
					<Ban class="h-3 w-3 shrink-0" aria-hidden="true" />
					{$translations.disruption.notServiced}
				</span>
			{/if}
		</div>
	</div>

	<!-- Right Section: Departure Countdown / Time + optional warning dialog -->
	<!-- The countdown column has a fixed width so the warning icon sits at the
	     same x position in every row, regardless of the countdown string. -->
	<div class="flex shrink-0 items-center justify-end gap-1.5 self-center pt-0.5">
		{#if rowSituations.length > 0}
			<Dialog.Root>
				<Dialog.Trigger class="block cursor-pointer align-middle" aria-label={warningLabel}>
					<TriangleAlert
						class="h-4 w-4 text-amber-600 transition-colors hover:text-amber-800"
						aria-hidden="true"
					/>
				</Dialog.Trigger>
				<Dialog.Content class="max-h-[80svh] overflow-y-auto">
					<Dialog.Header>
						<Dialog.Title class="text-base">
							{$translations.disruption.warningAriaLabel}
						</Dialog.Title>
						<Dialog.Description class="sr-only">
							{$translations.disruption.dialogFallback}
						</Dialog.Description>
					</Dialog.Header>
					<div class="flex flex-col gap-3 text-sm text-slate-700">
						{#each rowSituations as situation (situation.situationNumber)}
							<div class="rounded-md border border-amber-200 bg-amber-50 p-3">
								<p class="font-semibold text-amber-900">
									{situation.summary || situation.description || ''}
								</p>
								{#if situation.description && situation.summary}
									<p class="mt-0.5 text-xs text-amber-800/80">{situation.description}</p>
								{/if}
								{#if situation.detail}
									<!-- plain text, converted server side -->
									<span class="mt-1.5 block text-xs whitespace-pre-line text-amber-900/90">
										{situation.detail}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</Dialog.Content>
			</Dialog.Root>
		{/if}

		<p
			class="w-14 text-right text-sm font-bold whitespace-nowrap tabular-nums {countdownColorClass(
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
