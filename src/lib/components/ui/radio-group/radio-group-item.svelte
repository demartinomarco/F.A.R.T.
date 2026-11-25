<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
import CircleIcon from '@lucide/svelte/icons/circle';
import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

let {
	ref = $bindable(null),
	class: className,
	...restProps
}: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> = $props();
</script>

<!-- The circle carries the field fill (bg-background) instead of shadcn's
     transparent + dark:bg-input/30 wash: the sidebar's other controls — the
     platform selector, the language selector — are solid bg-background cards,
     and a wash over the sidebar tint made the disc read lighter than the cards
     next to it (and lighter still than the darker-than-sidebar card in the dark
     theme). Same fill, same border-input edge, so a radio belongs to the same
     family as the fields above it. -->
<RadioGroupPrimitive.Item
	bind:ref={ref}
	data-slot="radio-group-item"
	class={cn(
		"aspect-square size-4 shrink-0 rounded-full border border-input bg-background text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<div data-slot="radio-group-indicator" class="relative flex items-center justify-center">
			{#if checked}
				<CircleIcon
					class="absolute start-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary"
				/>
			{/if}
		</div>
	{/snippet}
</RadioGroupPrimitive.Item>
