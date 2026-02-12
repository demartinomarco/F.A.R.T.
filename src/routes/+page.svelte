<script lang="ts">
import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
import { onDestroy } from 'svelte';
import { page } from '$app/state';
import type { ApiResponse } from '@/types/departure';
import type { PageProps } from './$types';
import DepartureInfo from '@/components/ui/departure-info/departure-info.svelte';
import { _extractPlatformNames, _fetchDepartures, _filterByPlatformName } from './+page';
import { formatTime } from '@/utils';
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import AppSidebar from '@/components/ui/app-sidebar/app-sidebar.svelte';

const { data }: PageProps = $props();

let now = $state(new Date());
let time = $derived(formatTime(now));

let selectedPlatforms: string[] = $state([]);
let departures: ApiResponse[] = $state(data.item);

let eventType: 'dep' | 'arr' = $state('dep');

// Read stationIds from URL (?stationId=a&stationId=b)
function readStationIdsFromUrl(): string[] {
	const ids = page.url.searchParams.getAll('stationId').filter(Boolean);
	return ids.length ? ids : ['de:08212:89'];
}

let stationIds = $derived(readStationIdsFromUrl());

// Labels shown in SearchBar (derived from fetched departures)
let stationNames: string[] = $derived(departures.map((d) => d.stationName));

const platformNames = $derived(_extractPlatformNames(departures));

// Per-station grouping + filtering
let departuresToShow = $derived(_filterByPlatformName(departures, selectedPlatforms));

// Reset platform filter when station selection changes
// svelte-ignore state_referenced_locally
let oldStationKey = $state(stationIds.join('|'));

async function fetchAndSetDepartures(ids: string[], ev: 'dep' | 'arr') {
	const key = ids.join('|');
	if (key !== oldStationKey) {
		selectedPlatforms = [];
		oldStationKey = key;
	}
	departures = await _fetchDepartures(ids, ev);
}

$effect(() => {
	fetchAndSetDepartures(stationIds, eventType);
});

const depTimer = setInterval(async () => {
	departures = await _fetchDepartures(stationIds, eventType);
}, 15000);

const clockTimer = setInterval(() => (now = new Date()), 1000);

onDestroy(() => {
	clearInterval(depTimer);
	clearInterval(clockTimer);
});

let sidebarOpen = $state(false);

function titleText() {
	if (!stationNames.length) return 'Abfahrten | Tram- und ÖPNV-Anzeige';
	if (stationNames.length === 1) return `${stationNames[0]} – Abfahrten | Tram- und ÖPNV-Anzeige`;
	return `${stationNames[0]} +${stationNames.length - 1} – Abfahrten | Tram- und ÖPNV-Anzeige`;
}

function descriptionText() {
	if (!stationNames.length) return 'Live-Abfahrten und Fahrplan-Infos.';
	const joined =
		stationNames.length <= 3
			? stationNames.join(', ')
			: `${stationNames[0]} +${stationNames.length - 1} weitere`;
	return `Live-Abfahrten und Fahrplan-Infos für ${joined}. Unabhängige Anzeige, basierend auf öffentlich verfügbaren Daten. Filter nach Steig/Gleis, Linien und Ereignissen.`;
}
</script>

<svelte:head>
	<title>{stationNames[0]} – Abfahrten | Tram- und ÖPNV-Anzeige</title>
	<meta
		name="description"
		content={`Live-Abfahrten und Fahrplan-Infos für ${stationNames[0]}. Unabhängige Anzeige, basierend auf öffentlich verfügbaren Daten. Filter nach Steig/Gleis, Linien und Ereignissen.`}
	/>
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
			<div class="flex w-full min-w-0">
				<!-- IMPORTANT: stationIds is now string[] -->
				<SearchBar bind:selectedIds={stationIds} bind:selectedLabels={stationNames} />
			</div>

			<p class="font-medium text-white">{time}</p>
			<Sidebar.Trigger class="text-white" />
		</div>

		<div class="flex w-full p-4">
			{#if !departures || departures.length === 0}
				<p>Daten werden geladen...</p>
			{:else}
				{#key departuresToShow}
					<div class="flex w-full flex-col gap-16">
						{#each departuresToShow as stationBlock (stationBlock.stationName)}
							{#if stationBlock.stationName === ''}
								<p>Fehler: Eine ausgewählte Haltestellen-ID ist ungültig.</p>
							{:else if stationBlock.platforms.length === 0}
								<div class="flex flex-col gap-2">
									<p class="text-lg font-semibold">{stationBlock.stationName}</p>
									<hr class="h-0.5 rounded-sm bg-gray-400" />
									<p>Für die ausgewählte Haltestelle wurden keine Abfahrten gefunden.</p>
								</div>
							{:else}
								<!-- Your requested layout: Stop name + HR + platforms -->
								<section class="flex flex-col gap-4">
									{#if departuresToShow.length > 1}
										<p class="text-lg font-semibold">{stationBlock.stationName}</p>
									{/if}

									<div class="flex flex-col gap-4">
										{#each stationBlock.platforms as platformDep (platformDep.platformName)}
											<div class="flex flex-col gap-1">
												<p class="font-medium">{platformDep.platformName}</p>
												<hr class="h-0.5 rounded-sm bg-gray-500" />
												{#each platformDep.departures as departure}
													<DepartureInfo departure={departure} />
												{/each}
											</div>
										{/each}
									</div>
								</section>
							{/if}
						{/each}
					</div>
				{/key}
			{/if}
		</div>
	</main>
</Sidebar.Provider>
