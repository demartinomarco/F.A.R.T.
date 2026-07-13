<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import MapPinIcon from '@lucide/svelte/icons/map-pin';
import { tick, onMount } from 'svelte';
import { goto } from '$app/navigation';
import * as Command from '@/components/ui/command';
import * as Popover from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils.js';
import { type GeoPoint, type SearchResult, searchStops } from '$lib/stops-search';
import { Spinner } from '$lib/components/ui/spinner/index.js';

const placeholderText = 'Haltenstelle suchen...';
let open = $state(false);
let loadingLocation = $state(false);
let locationError = $state(false);

let { selectedId = $bindable(), selectedValue = $bindable() } = $props();
let stops: SearchResult[] = $state([
	{ value: selectedId, label: selectedValue, placeName: '', stopName: '' }
]);

let triggerRef = $state<HTMLButtonElement>(null!);

let prevId = $state(selectedId);
$effect(() => {
	if (selectedId === prevId) return;

	selectedValue = stops.find((s) => s.value === selectedId)?.label ?? selectedValue;
});

function closeAndFocusTrigger() {
	open = false;
	tick().then(() => triggerRef.focus());
}

let clientLocation = $state<GeoPoint | undefined>();

onMount(() => {
	navigator.permissions.query({ name: 'geolocation' }).then((result) => {
		if (result.state !== 'granted') return;
		useMyLocation(true);
	});
});

async function updateStops(searchText: string) {
	stops = await searchStops(searchText, clientLocation);
}

function useMyLocation(cache: boolean = false) {
	loadingLocation = true;
	navigator.geolocation?.getCurrentPosition(
		async (pos) => {
			locationError = false;
			loadingLocation = false;

			clientLocation = {
				lat: pos.coords.latitude,
				lon: pos.coords.longitude
			};

			stops = await searchStops('', clientLocation);
		},
		() => {
			// user denied or unavailable; just keep normal text search
			locationError = true;
			loadingLocation = false;
		},
		{
			maximumAge: cache ? 5 * 60 * 1000 : 0,
			timeout: 10000
		}
	);
}
</script>

<Popover.Root bind:open={open}>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class="w-fit min-w-0 flex-initial justify-between"
				role="combobox"
				aria-expanded={open}
			>
				<span class="truncate">{selectedValue || placeholderText}</span>
				<div class="flex items-center gap-1">
					<ChevronsUpDownIcon class="opacity-50" />
				</div>
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-[var(--bits-floating-anchor-width)] min-w-0 p-0">
		<Command.Root shouldFilter={false}>
			<Command.Input
				placeholder={placeholderText}
				oninput={(e) => updateStops(e.currentTarget.value)}
			/>
			<Command.List>
				<Command.Item onclick={useMyLocation}>
					<div class="flex grow flex-col gap-2">
						<div class="flex grow gap-2">
							<MapPinIcon class="h-4 w-4 opacity-50" />
							<span>Haltestellen in der Nähe</span>
							{#if loadingLocation}
								<Spinner class="ml-auto" />
							{/if}
						</div>
						{#if locationError}
							<p class="text-xs text-muted-foreground">Standort konnte nicht bestimmt werden.</p>
						{/if}
					</div>
				</Command.Item>
				{#key stops}
					<Command.Group value="stops" heading="Ergebnisse">
						{#if stops.length === 0}
							<span class="text-sm">Keine Haltenstelle konnte gefunden werden.</span>
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
								<CheckIcon class={cn('mr-2 h-4 w-4', selectedId !== stop.value && 'opacity-0')} />
								<span class="flex-1">{stop.label}</span>
								{#if stop.distanceKm !== undefined}
									<span class="ml-auto text-xs text-muted-foreground">
										{stop.distanceKm < 1
											? `${Math.round(stop.distanceKm * 1000)} m`
											: `${stop.distanceKm.toFixed(1)} km`}
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
