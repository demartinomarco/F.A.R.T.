<script lang="ts">
import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
import { onDestroy } from 'svelte';
import type { ApiResponse } from '@/types/departure';
import type { PageProps } from './$types';
import DepartureInfo from '@/components/ui/departure-info/departure-info.svelte';
import {
	_extractPlatformNames,
	_fetchDepartures,
	_filterByPlatformName,
	type UiModel
} from './+page';
import { formatTime } from '@/utils';
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import AppSidebar from '@/components/ui/app-sidebar/app-sidebar.svelte';

const { data }: PageProps = $props();

let now = $state(new Date());
let time = $derived(formatTime(now));

let selectedPlatforms: string[] = $state([]);
let departures: ApiResponse | null = $state(data.model.item);
let error = $state(data.model.error);
let departuresToShow = $derived(_filterByPlatformName(departures, selectedPlatforms));
const platformNames = $derived(_extractPlatformNames(departures));
let eventType: 'dep' | 'arr' = $state(data.model.eventType);

let stationId = $state(data.model.stationId);
// svelte-ignore state_referenced_locally
let oldStationId = stationId;
let stationName = $derived(departures?.stationName ?? '');

async function fetchAndSetDepartures(stId: string, ev: 'dep' | 'arr') {
	if (oldStationId !== stId) {
		selectedPlatforms = [];
		oldStationId = stId;
	}

	const model: UiModel = await _fetchDepartures(fetch, stId, ev);

	departures = model.item;
	error = model.error;
}

$effect(() => {
	fetchAndSetDepartures(stationId, eventType);
});

const depTimer = setInterval(async () => {
	fetchAndSetDepartures(stationId, eventType);
}, 15000);

const clockTimer = setInterval(() => (now = new Date()), 1000);

onDestroy(() => {
	clearInterval(depTimer);
	clearInterval(clockTimer);
});
let sidebarOpen = $state(false);

function errorMessage(err: { code: string; message: string } | null) {
	if (!err) return '';

	if (err.code?.startsWith('UPSTREAM_')) {
		return 'Fehler: KVV ist aktuell nicht erreichbar. Sobald das Problem behoben ist, werden die Ergebnisse automatisch hier angezeigt.';
	} else if (err.code === 'NETWORK') {
		return 'Fehler: Keine Verbindung zum Server.';
	} else if (err.code === 'BAD_PARAMS') {
		if (err.message === 'Invalid stationId') {
			return `Fehler: Die ID ${stationId} ist ungültig.`;
		} else if (err.message === 'Invalid limit (must be 1..100)') {
			return 'Fehler: Die Anzahl der angezeigten Abfahrten muss zwischen 1 und 100 liegen.';
		}
	}

	return (
		'Tja, das ist peinlich… Ich weiß nicht, was passiert ist, aber ich weiß, dass du wirklich Pech hattest, hier zu landen. Diese Webseite funktioniert zu 99,97% der Zeit einwandfrei, aber heute bist du in den 0,03 % gelandet, in denen etwas schiefgelaufen ist.' +
		err.message
	);
}
</script>

<svelte:head>
	<title
		>{stationName ? `${stationName} – Abfahrten | Tram- und ÖPNV-Anzeige` : 'Abfahrten | Tram- und ÖPNV-Anzeige'}</title
	>
	<meta
		name="description"
		content={stationName
			? `Live-Abfahrten und Fahrplan-Infos für ${stationName}.`
			: 'Live-Abfahrten und Fahrplan-Infos.'}
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
				<SearchBar bind:selectedId={stationId} bind:selectedValue={stationName} />
			</div>

			<p class="font-medium text-white">{time}</p>
			<Sidebar.Trigger class="text-white" />
		</div>

		<div class="flex w-full p-4">
			{#if error}
				<p>{errorMessage(error)}</p>
			{:else if !departures}
				<p>Daten werden geladen...</p>
			{:else if departures.stationName === ''}
				<p>Fehler: Die ID {stationId} ist ungültig.</p>
			{:else if departuresToShow.length === 0}
				<p>Für die ausgewählte Haltestelle wurden keine Abfahrten gefunden.</p>
			{:else}
				{#key departuresToShow}
					<div class="flex w-full flex-col gap-4">
						{#each departuresToShow as platformDep}
							<div class="flex flex-col gap-1">
								<p class="font-medium">{platformDep.platformName}</p>
								<hr class="h-0.5 rounded-sm bg-gray-500" />
								{#each platformDep.departures as departure}
									<DepartureInfo departure={departure} />
								{/each}
							</div>
						{/each}
					</div>
				{/key}
			{/if}
		</div>
	</main>
</Sidebar.Provider>
