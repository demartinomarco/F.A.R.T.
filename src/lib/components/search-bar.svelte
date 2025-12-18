<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import { tick } from "svelte";
	import { goto } from '$app/navigation';
	import * as Command from "$lib/components/ui/command/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let stops: { value: string; label: string }[] = $state([]);
	let open = $state(false);
	let value = $state("");
	let triggerRef = $state<HTMLButtonElement>(null!);

	export let stationName = 'Hauptbahnhof';

	const selectedValue = $derived(
		stops.find((s) => s.value === value)?.label
	);

	async function searchStops(q: string) {
		if (q.length < 2) {
			stops = [];
			return;
		}

		const res = await fetch(`/stops?name=${q}`);
		const data = await res.json();
		stops = [...data];
	}

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => triggerRef.focus());
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class="w-[280px] justify-between"
				role="combobox"
				aria-expanded={open}
			>
				{selectedValue || "Search for a stop..."}
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-[280px] p-0">
		<Command.Root>
			<Command.Input
				placeholder="Search stop..."
				oninput={(e) => searchStops(e.currentTarget.value)}
			/>

			<Command.List>
				{#key stops}
					<Command.Group value="stops">
						{#each stops as stop (stop.label)}
							<Command.Item
								value={stop.label}
								onSelect={() => {
          value = stop.value;
          closeAndFocusTrigger();
          goto(`/${stop.value}`);
         }}
							>
								<CheckIcon class={cn("mr-2 h-4 w-4", value !== stop.value && "opacity-0")} />
								{stop.label}
							</Command.Item>
						{/each}
					</Command.Group>
				{/key}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>