<script>
	import MultiSelect from "svelte-multiselect";

    import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
    import Ban from '@lucide/svelte/icons/ban';
    let { platformNames, selectedPlatforms = $bindable() } = $props();
</script>

<MultiSelect
	options={platformNames}
	bind:selected={selectedPlatforms}
	outerDivClass="flex-row-reverse min-w-0! w-60! h-fit gap-4! flex-nowrap! bg-white! border! rounded-md! py-2! px-3!"
	inputClass="text-sm! placeholder:opacity-50! min-w-0! caret-transparent w-0!"
	ulOptionsClass="mt-1!"
	placeholder="Gleis filter"
	readOnly={true}
	disabled={platformNames.length === 0}
>
	{#snippet expandIcon({ open })}
		<ChevronsUpDownIcon class="w-4! h-4! opacity-50 shrink-0" />
	{/snippet}
	{#snippet disabledIcon()}
		<Ban class="w-4! h-4! opacity-50 shrink-0" />
	{/snippet}
</MultiSelect>