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

const placeholderText = 'Haltenstelle suchen...';
let open = $state(false);
let { selectedId = $bindable(), selectedValue = $bindable() } = $props();
let stops: { value: string; label: string }[] = $state([
	{ value: selectedId, label: selectedValue }
]);

let triggerRef = $state<HTMLButtonElement>(null!);

let prevId = $state(selectedId);
$effect(() => {
	if (selectedId === prevId) return;

	selectedValue = stops.find((s) => s.value === selectedId)?.label;
});

async function updateStops(searchText: string) {
	stops = await searchStops(searchText);
}

function closeAndFocusTrigger() {
	open = false;
	tick().then(() => triggerRef.focus());
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
				<ChevronsUpDownIcon class="opacity-50" />
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
				{#key stops}
					<Command.Group value="stops">
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
								{stop.label}
							</Command.Item>
						{/each}
					</Command.Group>
				{/key}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
