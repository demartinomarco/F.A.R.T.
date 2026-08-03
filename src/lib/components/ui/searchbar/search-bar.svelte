<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import MapPinIcon from '@lucide/svelte/icons/map-pin';
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import * as Command from '@/components/ui/command';
import * as Popover from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils.js';
import { Spinner } from '$lib/components/ui/spinner/index.js';
import { translations } from '$lib/i18n';
import {
	getSelectedStopItem,
	formatDistance,
	checkGeolocationPermission,
	getCurrentLocation,
	fetchDefaultStops
} from './search-bar';
import { searchStops } from '@/stops-search';
import type { GeoPoint, SearchResult } from '@/stops-search/types';

let { selectedId = $bindable(), selectedValue = $bindable() } = $props();

let open = $state(false);
let loadingLocation = $state(false);
let locationError = $state(false);

let stops: SearchResult[] = $state([]);
let clientLocation = $state<GeoPoint | undefined>();
let triggerRef = $state<HTMLButtonElement>(null!);

async function loadDefaultStops() {
	if (!clientLocation && (await checkGeolocationPermission())) {
		await useMyLocation(true);
		return;
	}
	stops = await fetchDefaultStops(selectedId, selectedValue, clientLocation);
}

async function useMyLocation(cache: boolean = false) {
	loadingLocation = true;
	try {
		clientLocation = await getCurrentLocation(cache);
		locationError = false;
		stops = await fetchDefaultStops(selectedId, selectedValue, clientLocation);
	} catch {
		locationError = true;
		const selected = getSelectedStopItem(selectedId, selectedValue);
		if (selected && stops.length === 0) stops = [selected];
	} finally {
		loadingLocation = false;
	}
}

async function updateStops(text: string) {
	if (text.trim().length === 0) {
		await loadDefaultStops();
		return;
	}
	stops = await searchStops(text, clientLocation);
}

function handleOpenChange(isOpen: boolean) {
	if (isOpen) {
		loadDefaultStops();
	}
}

function closeAndFocusTrigger() {
	open = false;
	tick().then(() => triggerRef.focus());
}

let prevId = $state(selectedId);
$effect(() => {
	if (selectedId === prevId) return;

	const matchedStop = stops.find((s) => s.value === selectedId);
	if (matchedStop) selectedValue = matchedStop.label;

	prevId = selectedId;
	loadDefaultStops();
});
</script>

<Popover.Root bind:open={open} onOpenChange={handleOpenChange}>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class="w-90 max-w-full justify-between sm:w-fit sm:min-w-90"
				role="combobox"
				aria-expanded={open}
				aria-label={selectedValue || $translations.search.placeholder}
			>
				<span class="truncate dark:text-[#FCFCFC]">{selectedValue || $translations.search.placeholder}</span>
				<div class="flex items-center gap-1">
					<ChevronsUpDownIcon class="opacity-50" />
				</div>
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-[var(--bits-floating-anchor-width)] min-w-0 p-0">
		<Command.Root shouldFilter={false}>
			<Command.Input
				placeholder={$translations.search.placeholder}
				oninput={(e) => updateStops(e.currentTarget.value)}
			/>
			<Command.List>
				<Command.Item onclick={() => useMyLocation(false)}>
					<div class="flex grow flex-col gap-2">
						<div class="flex grow gap-2">
							<MapPinIcon class="h-4 w-4 opacity-50" />
							<span>{$translations.search.stopsNearBy}</span>
							{#if loadingLocation}
								<Spinner class="ml-auto" />
							{/if}
						</div>
						{#if locationError}
							<p class="text-xs text-muted-foreground">{$translations.search.gpsError}</p>
						{/if}
					</div>
				</Command.Item>
				{#key stops}
					<Command.Group value="stops" heading={$translations.search.resultsTitle}>
						{#if stops.length === 0}
							<span class="block px-2 py-1.5 text-sm text-muted-foreground">
								{$translations.search.noStopsFound}
							</span>
						{/if}
						{#each stops as stop (stop.value)}
							<Command.Item
								value={stop.value}
								onSelect={() => {
                                    selectedId = stop.value;
                                    closeAndFocusTrigger();
                                    goto(`/?stationId=${stop.value}`);
                                }}
							>
								<CheckIcon
									class={cn('mr-2 h-4 w-4 shrink-0', selectedId !== stop.value && 'opacity-0')}
								/>
								<span class="flex-1">{stop.label}</span>
								{#if stop.distanceKm !== undefined}
									<span class="ml-auto shrink-0 text-xs text-muted-foreground">
										{formatDistance(stop.distanceKm)}
									</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				{/key}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
