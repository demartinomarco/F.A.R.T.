<script lang="ts">
import X from '@lucide/svelte/icons/x';
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { translations } from '$lib/i18n';
import type { LineOption } from '@/kvv-trias/types';

let {
	options = [],
	selectedLines = $bindable([])
}: {
	options?: LineOption[];
	selectedLines?: string[];
} = $props();

// The selection is global: as soon as anything is selected, every unselected
// badge fades so the selected ones stand out. Clearing the selection brings
// all badges back to full color.
const hasSelection = $derived(selectedLines.length > 0);

function toggleOption(option: string) {
	if (selectedLines.includes(option)) {
		selectedLines = selectedLines.filter((item: string) => item !== option);
	} else {
		selectedLines = [...selectedLines, option];
	}
}
</script>

{#if options.length > 0}
	<div
		role="group"
		aria-label={$translations.sidebar.lines}
		class="flex flex-wrap content-start gap-1.5"
	>
		{#each options as option (option.name)}
			{@const isSelected = selectedLines.includes(option.name)}
			<button
				type="button"
				data-testid={`line-option-${option.name}`}
				aria-pressed={isSelected}
				class={`rounded transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring ${
					isSelected || !hasSelection ? 'opacity-100' : 'opacity-40'
				}`}
				onclick={() => toggleOption(option.name)}
			>
				<LineIcon departure={{ lineName: option.name, vehicleType: option.vehicleType }} />
			</button>
		{/each}
	</div>
	{#if hasSelection}
		<button
			type="button"
			data-testid="line-filter-clear-all"
			class="flex items-center gap-1 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			onclick={() => (selectedLines = [])}
		>
			<X class="h-3.5 w-3.5" />
			{$translations.lineFilter.clearAll}
		</button>
	{/if}
{:else}
	<span class="text-sm text-muted-foreground">{$translations.lineFilter.empty}</span>
{/if}
