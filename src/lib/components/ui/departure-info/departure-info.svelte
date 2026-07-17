<script lang="ts">
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { colorClass, countdownText, plannedTimeLabel } from './departure-info';
import TramFront from '@lucide/svelte/icons/tram-front';

let { departure } = $props();
const now = $state(new Date());
const delay = plannedTimeLabel(departure, now);
</script>

<div class="flex items-start justify-between gap-2 py-1">
	<div class="flex w-full min-w-0 items-start gap-2">
		<LineIcon class="" departure={departure} />
		<div class="flex min-w-0 flex-1 flex-col">
			{#each departure.direction as direction (direction)}
				<div class="flex h-8 items-center">
					<p class="truncate">{direction}</p>
				</div>
			{/each}
		</div>

	</div>

	<div class="flex flex-col items-end">
	<div class="flex h-8 w-25 flex-shrink-0 items-center self-center justify-end">
		<p class="text-nowrap {colorClass(departure)}">
			{#if delay}
				<span class="text-black opacity-50">{delay}</span>
			{/if}

			{countdownText(departure, now)}
		</p>
	</div>
	{#if departure.direction.length > 1}
		<div class="flex h-8 flex-shrink-0 items-center gap-0.5">
			{#each Array(departure.direction.length)}
				<TramFront class="opacity-50" />
			{/each}
		</div>
	{/if}
	</div>
</div>
