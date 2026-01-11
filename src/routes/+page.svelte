<script lang="ts">
	import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { ApiResponse } from '@/types/departure';
	import type { PageProps } from './$types';
	import DepartureInfo from '@/components/ui/departure-info/departure-info.svelte';
	import { _extractPlatformNames, _fetchDepartures, _filterByPlatformName } from './+page';
	import { formatTime } from '@/utils';
	import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';

	const { data }: PageProps = $props();

	let now = $state(new Date());
	let time = $derived(formatTime(now));

	let selectedPlatforms: string[] = $state([]);
	let departures: ApiResponse = $state(data.item);
	let departuresToShow = $derived(_filterByPlatformName(departures, selectedPlatforms));
	const platformNames = $derived(_extractPlatformNames(departures));

	let stationId = $derived(page.url.searchParams.get('stationId') || '7000090');
	let stationName = $derived(departures.stationName);

	async function fetchAndSetDepartures(stationId: string) {
		departures = await _fetchDepartures(stationId);
		selectedPlatforms = [];
	}

	$effect(() => {
		fetchAndSetDepartures(stationId);
	});

	const depTimer = setInterval(async () => {
		departures = await _fetchDepartures(stationId);
	}, 15000);

	const clockTimer = setInterval(() => (now = new Date()), 1000);

	onDestroy(() => {
		clearInterval(depTimer);
		clearInterval(clockTimer);
	});
</script>

<svelte:head>
	<title>{stationName}</title>
</svelte:head>

<div class="bg-[#c30a37] flex justify-between items-center p-4 gap-4">
	<div class="flex justify-between gap-4 flex-wrap w-full min-w-0">
		<SearchBar bind:selectedId={stationId} bind:selectedValue={stationName} />
		<MultiSelect {platformNames} bind:selectedPlatforms />
		<div></div>
	</div>

	<p class="text-white font-medium">{time}</p>
</div>

<div class="p-4">
	{#if departures.departureList.length === 0}
		<p>Loading data...</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#key departuresToShow}
				{#each departuresToShow as departure}
					<DepartureInfo cityName={departures.cityName} {departure} />
				{/each}
			{/key}
		</div>
	{/if}
</div>
