<script lang="ts">
import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
import { onDestroy } from 'svelte';
import type { PageProps } from './$types';
import DepartureInfo from '@/components/ui/departure-info/departure-info.svelte';
import {
	_extractPlatformNames,
	_fetchDepartures,
	_filterByPlatformName,
	type UiModel,
	_getPlatformKey,
	_getDepartureKey
} from './+page';
import { formatTime } from '@/utils';
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import AppSidebar from '@/components/ui/app-sidebar/app-sidebar.svelte';
import { translations, interpolate } from '$lib/i18n';
import { PlatformType, type Platform, type StationDepartures } from '@/kvv-trias/types';

const { data }: PageProps = $props();

let now = $state(new Date());
let time = $derived(formatTime(now));

let stationId = $state('');
let eventType = $state<'dep' | 'arr'>('dep');
let departures = $state<StationDepartures | null>(null);
let error = $state<UiModel['error']>(null);

let oldStationId = $state('');

$effect(() => {
	stationId = data.model.stationId;
	eventType = data.model.eventType;
	departures = data.model.item;
	error = data.model.error;
});

let stationName = $derived(departures?.stationName ?? '');
let selectedPlatforms: string[] = $state([]);
let departuresToShow = $derived(_filterByPlatformName(departures, selectedPlatforms));
const platformNames = $derived(_extractPlatformNames(departures));

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

function platformName(platformInfo: Platform): string {
	const platform = platformInfo.name;
	switch (platformInfo.type) {
		case PlatformType.Rail:
			return interpolate($translations.platform.railPlatform, { platform });
		case PlatformType.Bus:
			return interpolate($translations.platform.busBay, { platform });
		case PlatformType.Unknown:
			return interpolate($translations.platform.unknown, { platform });
	}
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
	style="--sidebar-width: 17rem; --sidebar-width-mobile: fit-content;"
>
	<AppSidebar
		platformNames={platformNames}
		bind:selectedPlatforms={selectedPlatforms}
		bind:eventType={eventType}
	/>
	<main class="min-h-screen w-full bg-slate-50">
		<!-- Top Bar Header -->
		<div
			class="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#a8082e] px-4 py-3 shadow-sm"
		>
			<div class="flex w-full min-w-0 flex-1 items-center">
				<SearchBar bind:selectedId={stationId} bind:selectedValue={stationName} />
			</div>

			<div class="flex shrink-0 items-center gap-2">
				<p class="text-sm font-semibold text-white">{time}</p>
				<Sidebar.Trigger class="text-white" />
			</div>
		</div>

		<!-- Departure Display Area -->
		<div class="w-full p-4 sm:p-6">
			{#if error}
				<div class="rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
					<p>{errorMessage(error)}</p>
				</div>
			{:else if !departures}
				<div class="p-6 text-center text-sm text-slate-500">
					<p>{$translations.page.loading}</p>
				</div>
			{:else if departures.stationName === ''}
				<div class="p-6 text-center text-sm text-slate-500">
					<p>{interpolate($translations.error.unknownStation, { stationId })}</p>
				</div>
			{:else if departuresToShow.length === 0}
				<div class="p-6 text-center text-sm text-slate-500">
					<p>{$translations.page.noDepartures}</p>
				</div>
			{:else}
				{#key departuresToShow}
					<div
						class="grid w-full grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]"
					>
						{#each departuresToShow as platformDep (_getPlatformKey(platformDep))}
							<div class="flex flex-col">
								<!-- Platform Header with Thicker/Darker Horizontal Divider -->
								<div
									class="flex items-baseline justify-between border-b-2 border-slate-700 px-1 pb-1.5"
								>
									<h2 class="text-xs font-bold tracking-wider text-slate-800 uppercase">
										{platformName(platformDep.platform)}
									</h2>
								</div>

								<!-- Frameless Departures List with Thin/Light Horizontal Dividers -->
								<div class="divide-y divide-slate-200/70">
									{#each platformDep.departures as departure (_getDepartureKey(departure))}
										<DepartureInfo departure={departure} />
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/key}
			{/if}
		</div>
	</main>
</Sidebar.Provider>
