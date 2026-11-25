<script lang="ts">
import X from '@lucide/svelte/icons/x';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { translations } from '$lib/i18n';
import { cn } from '@/utils.js';
import type { LineOption } from '@/kvv-trias/types';

let {
	options = [],
	selectedLines = $bindable([]),
	expanded = $bindable(false)
}: {
	options?: LineOption[];
	selectedLines?: string[];
	expanded?: boolean;
} = $props();

// The badge list can be long at big stations, so it starts collapsed to keep
// the sidebar compact. The selected-line count stays visible on the header
// row, so an active filter is never invisible. The state lives on the page,
// not here: on mobile the sidebar is a Sheet, so closing it unmounts this
// component — with the state here it would reset on every reopen. The page
// state survives the remount and still vanishes on reload; a manual collapse
// is, of course, respected.

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

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<span
			class={cn(
				'text-sm leading-none font-semibold transition-opacity',
				options.length === 0 && 'opacity-50'
			)}
		>
			{$translations.sidebar.lines}
		</span>

		{#if options.length > 0}
			<button
				type="button"
				data-testid="line-filter-toggle"
				aria-expanded={expanded}
				aria-controls="line-filter-options"
				class="flex items-center gap-1.5 rounded-md p-0.5 text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				onclick={() => (expanded = !expanded)}
			>
				<span class="sr-only">
					{expanded ? $translations.lineFilter.collapse : $translations.lineFilter.expand}
				</span>
				{#if !expanded && hasSelection}
					<span
						data-testid="line-filter-selected-count"
						class="flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-1 text-xs font-medium text-sidebar-accent-foreground"
					>
						{selectedLines.length}
					</span>
				{/if}
				<!-- Points down while collapsed ("show the badges") and up once they are
				     visible, the way every other disclosure in the app reads. -->
				<ChevronDown
					class={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
				/>
			</button>
		{/if}
	</div>

	{#if options.length === 0}
		<span class="text-sm text-muted-foreground">{$translations.lineFilter.empty}</span>
	{:else}
		<div
			id="line-filter-options"
			hidden={!expanded}
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
					class={`rounded outline-hidden transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
						isSelected || !hasSelection ? 'opacity-100' : 'opacity-40'
					}`}
					onclick={() => toggleOption(option.name)}
				>
					<LineIcon departure={{ lineName: option.name, vehicleType: option.vehicleType }} />
				</button>
			{/each}
		</div>
		{#if expanded && hasSelection}
			<button
				type="button"
				data-testid="line-filter-clear-all"
				class="flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				onclick={() => (selectedLines = [])}
			>
				<X class="h-3.5 w-3.5" />
				{$translations.lineFilter.clearAll}
			</button>
		{/if}
	{/if}
</div>
