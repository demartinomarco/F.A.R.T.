<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import * as Command from '@/components/ui/command';
import * as Popover from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils.js';
import { searchStops } from '@/components/ui/searchbar/search-bar';

// If you have shadcn checkbox component, use it.
// Otherwise a native checkbox works fine.
// import { Checkbox } from '@/components/ui/checkbox';

const placeholderText = 'Haltenstelle suchen...';

let open = $state(false);
let triggerRef = $state<HTMLButtonElement>(null!);

// Toggle: multi select enabled?
let multi = $state(false);

// If you still need to bind something to parent, bind an array of ids
// (or keep your previous single selectedId/selectedValue shape externally).
let { selectedIds = $bindable<string[]>(), selectedLabels = $bindable<string[]>() } = $props();

// Selected items (canonical source of truth)
type Stop = { value: string; label: string };
let selectedStops = $derived<Stop[]>(
	selectedIds.map((id: string, index: number) => ({ value: id, label: selectedLabels[index] }))
);

// Search results from backend
let searchResults = $state<Stop[]>([]);

// What you actually render in the list:
// selected pinned on top + search results, deduped.
let displayStops = $state<Stop[]>([]);


function closeAndFocusTrigger() {
	open = false;
	tick().then(() => triggerRef.focus());
}

function dedupByValue(items: Stop[]) {
	const map = new Map<string, Stop>();
	for (const s of items) map.set(s.value, s);
	return [...map.values()];
}

function rebuildDisplayStops() {
	// requirement #1: always include selected options
	// (even if current search text doesn't match)
	displayStops = dedupByValue([...selectedStops, ...searchResults]);
}

async function updateStops(searchText: string) {
	searchResults = await searchStops(searchText);
	rebuildDisplayStops();
}

function isSelected(value: string) {
	return selectedStops.some((s) => s.value === value);
}

function setSingle(stop: Stop) {
	selectedStops = [stop];
	selectedIds = [stop.value];

	// your original behavior:
	closeAndFocusTrigger();
	goto(`/?stationId=${stop.value}`);
}

function toggleMulti(stop: Stop) {
	if (!isSelected(stop.value)) {
		selectedStops = [...selectedStops, stop];
	} else {
		selectedStops = selectedStops.filter((s) => s.value !== stop.value);
	}

	selectedIds = selectedStops.map((s) => s.value);

	const params = new URLSearchParams();
	selectedIds.forEach((id) => params.append('stationId', id));
	goto(`/?${params.toString()}`);

	rebuildDisplayStops();
}

function onSelectStop(stop: Stop) {
	if (!multi) {
		setSingle(stop);
		return;
	}
	toggleMulti(stop);
	// keep open for multi-select UX
}

function buttonText() {
	if (!selectedStops.length) return placeholderText;
	if (!multi) return selectedStops[0]?.label ?? placeholderText;
	if (selectedStops.length <= 2) return selectedStops.map((s) => s.label).join(', ');
	return `${selectedStops.length} ausgewählt`;
}

// If you want: switching multi OFF collapses selection to one item
$effect(() => {
	if (!multi && selectedStops.length > 1) {
		selectedStops = selectedStops.slice(0, 1);
		selectedIds = selectedStops.map((s) => s.value);
		rebuildDisplayStops();
	}
});

// initial display
$effect(() => {
	rebuildDisplayStops();
});
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
				<span class="truncate">{buttonText()}</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-60 p-0">
		<Command.Root shouldFilter={false}>
			<!-- requirement #2: checkbox toggle inside the combobox -->
			<div class="flex items-center justify-between gap-2 border-b px-3 py-2">
				<label class="flex items-center gap-2 text-sm select-none">
					<input type="checkbox" bind:checked={multi} />
					Multi-select
				</label>

				{#if multi}
					<Button
						type="button"
						variant="secondary"
						class="h-7 px-2"
						onclick={() => {
              selectedStops = [];
              selectedIds = [];
              rebuildDisplayStops();
            }}
					>
						Clear
					</Button>
				{/if}
			</div>

			<Command.Input
				placeholder={placeholderText}
				oninput={(e) => updateStops(e.currentTarget.value)}
			/>

			<Command.List>
				<Command.Group value="stops">
					{#each displayStops as stop (stop.value)}
						<Command.Item value={stop.value} onSelect={() => onSelectStop(stop)}>
							<CheckIcon class={cn('mr-2 h-4 w-4', !isSelected(stop.value) && 'opacity-0')} />
							{stop.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>

			{#if multi}
				<div class="border-t p-2">
					<Button type="button" class="w-full" onclick={() => closeAndFocusTrigger()}>Done</Button>
				</div>
			{/if}
		</Command.Root>
	</Popover.Content>
</Popover.Root>
