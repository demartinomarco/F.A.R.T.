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
import { type GeoPoint, type SearchResult, searchStops } from '$lib/stops-search';

const placeholderText = 'Haltenstelle suchen...';
let open = $state(false);
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

async function updateStops(searchText: string) {
	stops = await searchStops(searchText, clientLocation);
}

function useMyLocation() {
	navigator.geolocation?.getCurrentPosition(
		async (pos) => {
			clientLocation = {
				lat: pos.coords.latitude,
				lon: pos.coords.longitude
			};

			stops = await searchStops('', clientLocation);
		},
		() => {
			// user denied or unavailable; just keep normal text search
		},
		{
			enableHighAccuracy: false,
			timeout: 5000,
			maximumAge: 5 * 60 * 1000
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
				class="w-60 min-w-0 flex-initial justify-between"
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

	<Popover.Content class="w-60 p-0">
		<Command.Root shouldFilter={false}>
			<Command.Input
				placeholder={placeholderText}
				oninput={(e) => updateStops(e.currentTarget.value)}
			/>
			<Command.List>
			<Command.Item  onclick={useMyLocation} >
				<MapPinIcon class="h-4 w-4 opacity-50"/>
				<span>Haltestellen in der Nähe</span>
			</Command.Item>
				{#key stops}
					<Command.Group value="stops" heading="Ergebnisse">
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
