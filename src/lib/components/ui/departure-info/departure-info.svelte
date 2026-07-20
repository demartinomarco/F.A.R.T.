<script lang="ts">
import { translations } from '$lib/i18n';
import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
import { colorClass, countdownText, plannedTimeLabel } from './departure-info';

let { departure } = $props();
const now = $state(new Date());
const delay = $derived(plannedTimeLabel(departure, now, $translations));
</script>

<div class="flex items-center justify-between gap-2 py-1">
	<div class="flex min-w-0 items-center gap-2">
		<LineIcon departure={departure} />
		<p class="truncate">{departure.direction}</p>
	</div>

	<p class="text-nowrap {colorClass(departure)}">
		{#if delay}
			<span class="text-black opacity-50">{delay}</span>
		{/if}

		{countdownText(departure, now, $translations)}
	</p>
</div>
