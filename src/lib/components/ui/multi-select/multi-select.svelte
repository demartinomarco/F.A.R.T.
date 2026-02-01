<script>
import MultiSelect from 'svelte-multiselect';

import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import Ban from '@lucide/svelte/icons/ban';
let { platformNames, selectedPlatforms = $bindable() } = $props();
</script>

<MultiSelect
	options={platformNames}
	bind:selected={selectedPlatforms}
	outerDivClass="flex-row-reverse min-w-0! w-full h-fit gap-4! flex-nowrap! bg-white! border! rounded-md! py-2! px-3!"
	inputClass="text-sm! placeholder:opacity-50! min-w-0! caret-transparent w-0!"
	ulOptionsClass="mt-1!"
	placeholder="Wähle ein Gleis aus..."
	readOnly={true}
	disabled={platformNames.length === 0}
>
	{#snippet expandIcon({ open })}
		<ChevronsUpDownIcon class="h-4! w-4! shrink-0 opacity-50" />
	{/snippet}
	{#snippet disabledIcon()}
		<Ban class="h-4! w-4! shrink-0 opacity-50" />
	{/snippet}
</MultiSelect>
