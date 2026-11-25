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
	_mergeLineOptions,
	_mergePlatformNames,
	_fetchDepartures,
	_filterDepartures,
	_serializeQuery,
	type UiModel,
	_getPlatformKey,
	_getDepartureKey
} from './+page';
import { LINES_PARAM, parseLinesParam, serializeLines } from '@/lines-param';
import { formatTime } from '@/utils';
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import AppSidebar from '@/components/ui/app-sidebar/app-sidebar.svelte';
import { translations, interpolate } from '$lib/i18n';
import {
	PlatformType,
	type LineOption,
	type Platform,
	type StationDepartures
} from '@/kvv-trias/types';

const { data }: PageProps = $props();

let now = $state(new Date());
let time = $derived(formatTime(now));

// `data` is replaced on navigation. Capture the initial (SSR/hydration) model
// once; later updates are handled by the effect below.
const initial = untrack(() => data.model);
const initialLines = untrack(() => data.lines);
const initialStationLines = untrack(() => data.stationLines);

let stationId = $state(initial.stationId);
let eventType = $state(initial.eventType);
let departures = $state<StationDepartures | null>(initial.item);
let error = $state<UiModel['error']>(initial.error);
let selectedPlatforms: string[] = $state([]);
let selectedLines: string[] = $state(initialLines);
// The static per-stop line list (GTFS + bus probe) comes from `load` via
// GET /api/stop-lines, independent of the currently displayed departures, so
// rare services stay selectable.
let stationLines: LineOption[] = $state(initialStationLines);

// The sidebar options must not shrink just because a refetch was
// line-filtered: remember every platform and live line seen for the current
// station (the static line list supplies the rest). Reset on a station change.
let stationPlatforms: string[] = $state(_extractPlatformNames(initial.item));
let liveLineOptions: LineOption[] = $state(_extractLineOptions(initial.item));

// The route's `load` already fetched this station/eventType combination (during
// SSR or a client-side navigation). Remember which one so we never refetch it
// from an effect on mount.
let appliedModel = initial;
let loadedKey = `${initial.stationId}|${initial.eventType}`;

// The line selection the currently displayed departures were fetched with.
// `load` always fetches with the URL selection, so the model effect resets
// this to the selection that model was fetched with; the refetch effect below
// compares against it, so only genuine user changes trigger a fetch.
let lastFetchedLines = untrack(() => serializeLines(initialLines));
// Monotonic fetch counter: each new fetch invalidates every in-flight one, so
// a slow response (a toggle or poll racing a navigation) can never overwrite
// newer data.
let fetchSeq = 0;

$effect(() => {
	const model = data.model;
	const lines = data.lines;
	const loadedStationLines = data.stationLines;
	if (model === appliedModel) return;

	const stationChanged = model.stationId !== appliedModel.stationId;

	// A new station starts with an unfiltered platform list. The line
	// selection always comes from the URL (`load` fetched with it), so a
	// bookmark or back/forward navigation to a station keeps its filter, while
	// a station change through the search bar (whose URL carries no `lines`)
	// clears it.
	if (stationChanged) {
		selectedPlatforms = [];
	}
	selectedLines = lines;

	appliedModel = model;
	loadedKey = `${model.stationId}|${model.eventType}`;
	stationId = model.stationId;
	eventType = model.eventType;
	departures = model.item;
	error = model.error;
	stationLines = loadedStationLines;

	// `load` fetched this model with exactly the selection above. Remember
	// that, and invalidate client-side fetches that were in flight before
	// this navigation (a toggle or the poll that started before the data
	// arrived) — their responses must not overwrite the model's data.
	lastFetchedLines = serializeLines(selectedLines);
	fetchSeq++;

	// Keep the sidebar option lists stable across line-filtered refetches.
	if (stationChanged) {
		stationPlatforms = _extractPlatformNames(model.item);
		liveLineOptions = _extractLineOptions(model.item);
	} else {
		stationPlatforms = _mergePlatformNames(stationPlatforms, _extractPlatformNames(model.item));
		liveLineOptions = _mergeLineOptions(liveLineOptions, _extractLineOptions(model.item));
	}
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
		const serialized = serializeLines(selectedLines);
		if (serialized) params[LINES_PARAM] = serialized;
	}

	void goto(resolve(`/?${_serializeQuery(Object.entries(params))}`), { noScroll: true });
});

// Toggling a line is a fetch, not just a display filter: the server now
// filters the TRIAS response by the selection, so a filtered response only
// contains the selected lines and the selection must reach the API. `load`
// already fetched the initial selection (the model effect resets
// `lastFetchedLines` to match it), so this effect fires on user changes only
// — including clearing the filter, which refetches unfiltered.
$effect(() => {
	const serialized = serializeLines(selectedLines);
	if (serialized === lastFetchedLines) return;
	lastFetchedLines = serialized;
	void fetchAndSetDepartures(stationId, eventType, selectedLines);
});

// Shallow-route the line filter into the URL so it can be bookmarked:
// `replaceState` updates the address bar without re-running `load` (the
// selection change itself is picked up by the refetch effect above, not by
// a navigation), and an empty selection removes the parameter entirely.
// `page.url` only updates on real navigations — never from `replaceState` —
// so what the URL currently holds is tracked in a plain variable instead of
// being read back out of the (stale) URL.
// Declared after the model effect so a station change (which clears the
// filter) settles first.
let urlSerializedLines = untrack(() =>
	serializeLines(parseLinesParam(new URLSearchParams(page.url.search)))
);

$effect(() => {
	const serialized = serializeLines(selectedLines);
	if (serialized === urlSerializedLines) return;
	urlSerializedLines = serialized;

	// Rebuild from the address bar itself: it is the only source that
	// reflects previous `replaceState` calls.
	const others = [...new URLSearchParams(window.location.search)].filter(
		([key]) => key !== LINES_PARAM
	);
	const params = serialized ? [...others, [LINES_PARAM, serialized]] : others;

	const query = _serializeQuery(params);
	if (query !== window.location.search.slice(1)) {
		replaceState(resolve(query ? `/?${query}` : '/'), {});
	}
});

let stationName = $derived(departures?.stationName ?? '');
let departuresToShow = $derived(_filterDepartures(departures, selectedLines, selectedPlatforms));
const platformNames = $derived(stationPlatforms);
const lineOptions = $derived(
	_lineFilterOptions(_mergeLineOptions(stationLines, liveLineOptions), selectedLines)
);

async function fetchAndSetDepartures(stId: string, ev: 'dep' | 'arr', lines: string[]) {
	const seq = ++fetchSeq;
	const model: UiModel = await _fetchDepartures(fetch, stId, ev, lines);

	// A newer fetch (another toggle, the poll, or a navigation) superseded
	// this one; drop its stale response.
	if (seq !== fetchSeq) return;

	departures = model.item;
	error = model.error;

	// A line-filtered response only contains the selected lines and their
	// platforms; remember everything seen so the sidebar keeps offering the
	// station's other options.
	stationPlatforms = _mergePlatformNames(stationPlatforms, _extractPlatformNames(model.item));
	liveLineOptions = _mergeLineOptions(liveLineOptions, _extractLineOptions(model.item));
}

const depTimer = setInterval(async () => {
	fetchAndSetDepartures(stationId, eventType, selectedLines);
}, 15000);

const clockTimer = setInterval(() => (now = new Date()), 1000);

onDestroy(() => {
	clearInterval(depTimer);
	clearInterval(clockTimer);
});
let sidebarOpen = $state(false);
// The line filter's collapsed state lives here, not in the filter itself:
// closing the mobile sidebar unmounts the sidebar (it is a Sheet), and the
// filter should stay open across that — but not across a page reload.
let lineFilterExpanded = $state(false);

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
		bind:lineFilterExpanded={lineFilterExpanded}
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
