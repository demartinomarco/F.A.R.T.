<script lang="ts">
import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
import { onDestroy, untrack } from 'svelte';
import { goto, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { resolve } from '$app/paths';
import type { PageProps } from './$types';
import DepartureInfo from '@/components/ui/departure-info/departure-info.svelte';
import {
	_extractPlatformNames,
	_extractLineOptions,
	_lineFilterOptions,
	_fetchDepartures,
	_filterDepartures,
	_parseLinesParam,
	_serializeLines,
	_serializeQuery,
	_LINES_PARAM,
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

// `data` is replaced on navigation. Capture the initial (SSR/hydration) model
// once; later updates are handled by the effect below.
const initial = untrack(() => data.model);
const initialLines = untrack(() => data.lines);

let stationId = $state(initial.stationId);
let eventType = $state(initial.eventType);
let departures = $state<StationDepartures | null>(initial.item);
let error = $state<UiModel['error']>(initial.error);
let selectedPlatforms: string[] = $state([]);
let selectedLines: string[] = $state(initialLines);

// The route's `load` already fetched this station/eventType combination (during
// SSR or a client-side navigation). Remember which one so we never refetch it
// from an effect on mount.
let appliedModel = initial;
let loadedKey = `${initial.stationId}|${initial.eventType}`;

$effect(() => {
	const model = data.model;
	const lines = data.lines;
	if (model === appliedModel) return;

	// A new station starts with unfiltered platform and line lists. A
	// navigation within the same station (departure/arrival switch, browser
	// back/forward) restores the line filter from the URL instead. Doing this
	// here (outside the fetch path) keeps the effect from invalidating itself.
	if (model.stationId !== appliedModel.stationId) {
		selectedPlatforms = [];
		selectedLines = [];
	} else {
		selectedLines = lines;
	}

	appliedModel = model;
	loadedKey = `${model.stationId}|${model.eventType}`;
	stationId = model.stationId;
	eventType = model.eventType;
	departures = model.item;
	error = model.error;
});

// Selecting a stop or switching departure/arrival is a navigation, not a
// second fetch: `load` fetches once and feeds the result back through
// `data.model`.
$effect(() => {
	const key = `${stationId}|${eventType}`;
	if (key === loadedKey) return;

	const params: Record<string, string> = { stationId, eventType };

	// A station change drops the line filter (the new station has its own
	// lines); a departure/arrival switch keeps it in the URL.
	const [loadedStationId] = loadedKey.split('|');
	if (stationId === loadedStationId) {
		const serialized = _serializeLines(selectedLines);
		if (serialized) params[_LINES_PARAM] = serialized;
	}

	void goto(resolve(`/?${_serializeQuery(Object.entries(params))}`), { noScroll: true });
});

// Shallow-route the line filter into the URL so it can be bookmarked:
// `replaceState` updates the address bar without re-running `load`, so
// toggling a line never refetches, and an empty selection removes the
// parameter entirely. `page.url` only updates on real navigations — never
// from `replaceState` — so what the URL currently holds is tracked in a
// plain variable instead of being read back out of the (stale) URL.
// Declared after the model effect so a station change (which clears the
// filter) settles first.
let urlSerializedLines = untrack(() =>
	_serializeLines(_parseLinesParam(new URLSearchParams(page.url.search)))
);

$effect(() => {
	const serialized = _serializeLines(selectedLines);
	if (serialized === urlSerializedLines) return;
	urlSerializedLines = serialized;

	// Rebuild from the address bar itself: it is the only source that
	// reflects previous `replaceState` calls.
	const others = [...new URLSearchParams(window.location.search)].filter(
		([key]) => key !== _LINES_PARAM
	);
	const params = serialized ? [...others, [_LINES_PARAM, serialized]] : others;

	const query = _serializeQuery(params);
	if (query !== window.location.search.slice(1)) {
		replaceState(resolve(query ? `/?${query}` : '/'), {});
	}
});

let stationName = $derived(departures?.stationName ?? '');
let departuresToShow = $derived(_filterDepartures(departures, selectedLines, selectedPlatforms));
const platformNames = $derived(_extractPlatformNames(departures));
const lineOptions = $derived(_lineFilterOptions(_extractLineOptions(departures), selectedLines));

async function fetchAndSetDepartures(stId: string, ev: 'dep' | 'arr') {
	const model: UiModel = await _fetchDepartures(fetch, stId, ev);

	departures = model.item;
	error = model.error;
}

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
		lineOptions={lineOptions}
		bind:selectedLines={selectedLines}
		bind:eventType={eventType}
		theme={data.theme}
	/>
	<main
		class="min-h-screen w-full bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100"
	>
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
				<div
					class="rounded-md bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
				>
					<p>{errorMessage(error)}</p>
				</div>
			{:else if !departures}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{$translations.page.loading}</p>
				</div>
			{:else if departures.stationName === ''}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{interpolate($translations.error.unknownStation, { stationId })}</p>
				</div>
			{:else if departuresToShow.length === 0}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>
						{selectedLines.length > 0 || selectedPlatforms.length > 0
						? $translations.page.noDeparturesForFilter
						: $translations.page.noDepartures}
					</p>
				</div>
			{:else}
				{#key departuresToShow}
					<div
						class="grid w-full grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]"
					>
						{#each departuresToShow as platformDep, platformIndex (_getPlatformKey(platformDep, platformIndex))}
							<div class="flex flex-col">
								<!-- Platform Header with Thicker/Darker Horizontal Divider -->
								<div
									class="flex items-baseline justify-between border-b-2 border-slate-700 px-1 pb-1.5 dark:border-slate-400"
								>
									<h2
										class="text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200"
									>
										{platformName(platformDep.platform)}
									</h2>
								</div>

								<!-- Frameless Departures List with Thin/Light Horizontal Dividers -->
								<div class="divide-y divide-slate-200/70 dark:divide-slate-800">
									{#each platformDep.departures as departure, index (_getDepartureKey(departure, platformDep.platform, index))}
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
