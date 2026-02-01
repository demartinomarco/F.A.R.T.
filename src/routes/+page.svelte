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
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import AppSidebar from '@/components/ui/app-sidebar/app-sidebar.svelte';

const { data }: PageProps = $props();

let now = $state(new Date());
let time = $derived(formatTime(now));

let selectedPlatforms: string[] = $state([]);
let departures: ApiResponse = $state(data.item);
let departuresToShow = $derived(_filterByPlatformName(departures, selectedPlatforms));
const platformNames = $derived(_extractPlatformNames(departures));
let eventType: 'dep' | 'arr' = $state('dep');

let stationId = $derived(page.url.searchParams.get('stationId') || 'de:08212:89');
let stationName = $derived(departures.stationName);

async function fetchAndSetDepartures(stationId: string, eventType: 'dep' | 'arr') {
	departures = await _fetchDepartures(stationId, eventType);
	selectedPlatforms = [];
}

$effect(() => {
	fetchAndSetDepartures(stationId, eventType);
});

const depTimer = setInterval(async () => {
	departures = await _fetchDepartures(stationId);
}, 15000);

const clockTimer = setInterval(() => (now = new Date()), 1000);

onDestroy(() => {
	clearInterval(depTimer);
	clearInterval(clockTimer);
});
let sidebarOpen = $state(false);
</script>

<svelte:head>
	<title>{stationName}</title>
</svelte:head>

<Sidebar.Provider
	bind:open={sidebarOpen}
	style="--sidebar-width: 17rem; --sidebar-width-mobile:  fit-content;"
>
	<AppSidebar
		platformNames={platformNames}
		bind:selectedPlatforms={selectedPlatforms}
		bind:eventType={eventType}
	/>
	<main class="w-full">
		<div class="flex items-center justify-between gap-4 bg-[#c30a37] p-4">
			<div class="flex w-full min-w-0 flex-wrap justify-between gap-4">
				<SearchBar bind:selectedId={stationId} bind:selectedValue={stationName} />
				<div></div>
			</div>

			<p class="font-medium text-white">{time}</p>
			<Sidebar.Trigger class="text-white" />
		</div>

		<div class="flex w-full p-4">
			{#if !departures}
				<p>Loading data...</p>
			{:else if departures.stationName === ''}
				<p>Error: The id {stationId} is invalid.</p>
			{:else if departuresToShow.length === 0}
				<p>No departures found for the selected stop.</p>
			{:else}
				{#key departuresToShow}
					<div class="flex w-full flex-col gap-4">
						{#each departuresToShow as platformDep}
							<div class="flex flex-col gap-1">
								<p class="font-medium">{platformDep.platformName}</p>
								<hr class="h-0.5 rounded-sm bg-gray-500" />
								{#each platformDep.departures as departure}
									<DepartureInfo cityName={departures.cityName} departure={departure} />
								{/each}
							</div>
						{/each}
					</div>
				{/key}
			{/if}
		</div>
	</main>
</Sidebar.Provider>
