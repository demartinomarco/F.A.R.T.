<script lang="ts">
import type { Disruption } from '@/kvv-trias/types';

let { situation }: { situation: Disruption } = $props();

// All texts arrive as server-side-sanitized plain text; nothing renderable here.
</script>

<div class="rounded-md border border-amber-200 bg-amber-50 p-3">
	<p class="font-semibold text-amber-800">
		{situation.summary || situation.description || ''}
	</p>
	{#if situation.description && situation.summary}
		<p class="mt-0.5 text-xs text-amber-800/80">{situation.description}</p>
	{/if}
	{#if situation.detail}
		<span
			class="{situation.summary || situation.description ? 'mt-1.5 block' : 'block'} text-xs whitespace-pre-line text-amber-900/90"
		>
			{situation.detail}
		</span>
	{/if}
</div>
