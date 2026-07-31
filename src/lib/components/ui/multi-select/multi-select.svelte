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

function removeOption(e: MouseEvent, option: string) {
	e.stopPropagation();
	selectedPlatforms = selectedPlatforms.filter((item: string) => item !== option);
}
</script>

<Popover.Root bind:open={open}>
	<Popover.Trigger
		id="platform-select-input"
		aria-label={$translations.sidebar.platforms}
		class="flex min-h-10 w-full flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		disabled={isDisabled}
	>
		<div class="flex flex-wrap items-center gap-1.5">
			{#if selectedPlatforms.length > 0}
				{#each selectedPlatforms as platform (platform)}
					<span
						class="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
					>
						{platform}
						<button
							type="button"
							class="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1"
							onclick={(e) => removeOption(e, platform)}
							aria-label="Remove {platform}"
						>
							<X class="h-3 w-3" />
						</button>
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
		class="z-50 min-w-(--bits-popover-anchor-width) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
		sideOffset={4}
	>
		<div class="max-h-60 overflow-y-auto">
			{#each platformNames as option (option)}
				{@const isSelected = selectedPlatforms.includes(option)}
				<button
					type="button"
					class="relative flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground"
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
