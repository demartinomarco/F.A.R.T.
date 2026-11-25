<script lang="ts">
import { Popover } from 'bits-ui';
import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
import Ban from '@lucide/svelte/icons/ban';
import Check from '@lucide/svelte/icons/check';
import X from '@lucide/svelte/icons/x';
import { translations } from '$lib/i18n';

let { platformNames = [], selectedPlatforms = $bindable([]) } = $props();

let open = $state(false);
let isDisabled = $derived(platformNames.length === 0);

function toggleOption(option: string) {
	if (selectedPlatforms.includes(option)) {
		selectedPlatforms = selectedPlatforms.filter((item: string) => item !== option);
	} else {
		selectedPlatforms = [...selectedPlatforms, option];
	}
}

// The × is pointer sugar and cannot be a <button>: interactive content is not
// allowed inside the trigger button, and the popover list already toggles every
// platform, so keyboard users dismiss from the list. Handling the click in the
// capture phase on the trigger itself (rather than on the × ) keeps the × out of
// the tab order and stops the popover's own listener before it opens.
function dismissChip(e: MouseEvent) {
	const chip = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-chip-remove]');
	if (!chip) return;
	e.preventDefault();
	e.stopPropagation();
	const option = chip.dataset.chipRemove;
	if (option) selectedPlatforms = selectedPlatforms.filter((item: string) => item !== option);
}
</script>

<Popover.Root bind:open={open}>
	<Popover.Trigger
		id="platform-select-input"
		aria-label={$translations.sidebar.platforms}
		onclickcapture={dismissChip}
		class="flex min-h-10 w-full flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
		disabled={isDisabled}
	>
		<div class="flex flex-wrap items-center gap-1.5">
			{#if selectedPlatforms.length > 0}
				{#each selectedPlatforms as platform (platform)}
					<span
						class="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
					>
						{platform}
						<!-- Pointer-only: no <button> here, or the chip would nest a control
						     inside the trigger button. p-0.5/-m-0.5 keeps the hit area
						     comfortably above the 12px glyph. -->
						<span
							data-testid={`chip-remove-${platform}`}
							data-chip-remove={platform}
							role="presentation"
							aria-hidden="true"
							class="-m-0.5 inline-flex cursor-pointer items-center rounded-full p-0.5 text-muted-foreground hover:text-foreground"
						>
							<X class="h-3 w-3" />
						</span>
					</span>
				{/each}
			{:else}
				<span class="text-sm text-muted-foreground">
					{$translations.multiSelect.placeholder}
				</span>
			{/if}
		</div>

		{#if isDisabled}
			<Ban class="h-4 w-4 shrink-0 opacity-50" />
		{:else}
			<ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
		{/if}
	</Popover.Trigger>

	<Popover.Content
		class="z-50 min-w-(--bits-popover-anchor-width) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden"
		sideOffset={4}
	>
		<div class="max-h-60 overflow-y-auto">
			{#each platformNames as option (option)}
				{@const isSelected = selectedPlatforms.includes(option)}
				<button
					type="button"
					class="relative flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
					onclick={() => toggleOption(option)}
				>
					<span>{option}</span>
					{#if isSelected}
						<Check class="h-4 w-4 text-primary" />
					{/if}
				</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
