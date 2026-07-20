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
import LanguageSelector from '@/components/ui/language-selector/language-selector.svelte';
import { translations, interpolate } from '$lib/i18n';

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
		return $translations.error.kvvUnreachable;
	} else if (err.code === 'NETWORK') {
		return $translations.error.noConnection;
	} else if (err.code === 'BAD_PARAMS') {
		if (err.message === 'Invalid stationId') {
			return interpolate($translations.error.invalidStationId, { stationId });
		} else if (err.message === 'Invalid limit (must be 1..100)') {
			return $translations.error.invalidLimit;
		}
	}

	return $translations.error.genericMessage + err.message;
}
</script>

<svelte:head>
	<title
		>{stationName ? interpolate($translations.page.titleWithStation, { stationName }) : $translations.page.titleWithoutStation}</title
	>
	<meta
		name="description"
		content={stationName
			? interpolate($translations.page.metaDescriptionWithStation, { stationName })
			: $translations.page.metaDescriptionWithoutStation}
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
			<LanguageSelector />
			<Sidebar.Trigger class="text-white" />
		</div>

		<div class="flex w-full p-4">
			{#if error}
				<p>{errorMessage(error)}</p>
			{:else if !departures}
				<p>{$translations.page.loading}</p>
			{:else if departures.stationName === ''}
				<p>{interpolate($translations.error.unknownStation, { stationId })}</p>
			{:else if departuresToShow.length === 0}
				<p>{$translations.page.noDepartures}</p>
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
