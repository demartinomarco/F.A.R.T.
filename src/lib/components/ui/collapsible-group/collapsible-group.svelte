<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import { cn } from '@/utils.js';
import type { Snippet } from 'svelte';

let {
	title,
	id,
	testid,
	// Number of active filters to show on the header while the group is
	// collapsed, so a filter is never invisible behind a closed group.
	badge = 0,
	expanded = $bindable(true),
	children
}: {
	title: string;
	id: string;
	testid?: string;
	badge?: number;
	expanded?: boolean;
	children: Snippet;
} = $props();
</script>

<!-- A sidebar group whose header is a disclosure: the rail keeps its place
     when collapsed, and the state is owned by the page (bound in), so it
     survives the mobile sheet unmounting the sidebar. -->
<Sidebar.Group class="p-0">
	<button
		type="button"
		data-testid={testid}
		aria-expanded={expanded}
		aria-controls={id}
		class="mb-1 flex h-6 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-0 text-xs font-bold tracking-wider text-sidebar-foreground uppercase outline-hidden transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
		onclick={() => (expanded = !expanded)}
	>
		<span>{title}</span>
		<span class="flex items-center gap-1.5">
			{#if !expanded && badge > 0}
				<span
					data-testid={testid ? `${testid}-count` : undefined}
					class="flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-1 text-xs font-medium text-sidebar-accent-foreground"
				>
					{badge}
				</span>
			{/if}
			<!-- Down while collapsed ("show this group"), up once it is open,
			     the way every other disclosure in the app reads. -->
			<ChevronDown
				aria-hidden="true"
				class={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')}
			/>
		</span>
	</button>
	<Sidebar.Separator />

	<!-- The gap between the rule and the controls lives here (not under the
	     separator), so a collapsed group ends at its rule instead of carrying
	     empty space below it. -->
	<Sidebar.GroupContent id={id} hidden={!expanded} class="pt-4">
		{@render children()}
	</Sidebar.GroupContent>
</Sidebar.Group>
