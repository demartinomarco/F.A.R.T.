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
	_boardView,
	_serializeQuery,
	type UiModel,
	_getPlatformKey,
	_getDepartureKey
} from './+page';
import { LINES_PARAM, parseLinesParam, serializeLines } from '@/lines-param';
import { LIMIT_ERROR_MESSAGE, LIMIT_PARAM, parseLimitParam, serializeLimit } from '@/limit-param';
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
const initialLimit = untrack(() => data.limit);
const initialStationLines = untrack(() => data.stationLines);

let stationId = $state(initial.stationId);
let eventType = $state(initial.eventType);
let departures = $state<StationDepartures | null>(initial.item);
let error = $state<UiModel['error']>(initial.error);
let selectedPlatforms: string[] = $state([]);
let selectedLines: string[] = $state(initialLines);
// The number of departures the board shows. `load` parsed it from the URL
// (bounded by src/lib/limit-param.ts), the sidebar edits it, and a URL effect
// below writes changes back so a bookmark restores the row count.
let limit = $state(initialLimit);
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

// The line selection and limit the currently displayed departures were
// fetched with, as one key. `load` always fetches with the URL values, so the
// model effect resets this to the values that model was fetched with; the
// refetch effect below compares against it, so only genuine user changes
// trigger a fetch.
let lastFetchedKey = untrack(() => `${serializeLines(initialLines)}|${initialLimit}`);
// The selection the *displayed* departures were actually fetched with, unlike
// `lastFetchedLines` (which records what was asked for). Everything seen for
// the displayed data counts, including a poll's response, since the poll
// fetches with the current selection.
let displayedLines = $state(untrack(() => serializeLines(initialLines)));
// Monotonic fetch counter: each new fetch invalidates every in-flight one, so
// a slow response (a toggle or poll racing a navigation) can never overwrite
// newer data.
let fetchSeq = 0;

$effect(() => {
	const model = data.model;
	const lines = data.lines;
	const modelLimit = data.limit;
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
	limit = modelLimit;

	appliedModel = model;
	loadedKey = `${model.stationId}|${model.eventType}`;
	stationId = model.stationId;
	eventType = model.eventType;
	departures = model.item;
	error = model.error;
	stationLines = loadedStationLines;

	// `load` fetched this model with exactly the selection and limit above.
	// Remember that, and invalidate client-side fetches that were in flight
	// before this navigation (a toggle or the poll that started before the
	// data arrived) — their responses must not overwrite the model's data.
	lastFetchedKey = `${serializeLines(selectedLines)}|${limit}`;
	displayedLines = serializeLines(selectedLines);
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

	// The limit is a display setting, not tied to a station, so it survives
	// both the station change and the departure/arrival switch.
	const serializedLimit = serializeLimit(limit);
	if (serializedLimit) params[LIMIT_PARAM] = serializedLimit;

	void goto(resolve(`/?${_serializeQuery(Object.entries(params))}`), { noScroll: true });
});

// Toggling a line or changing the limit is a fetch, not just a display
// filter: the server filters the TRIAS response by the selection and sizes
// it by the limit (over-fetching upstream and slicing the result back), so
// both must reach the API. `load` already fetched the initial values (the
// model effect resets `lastFetchedKey` to match them), so this effect fires
// on user changes only — including clearing the filter, which refetches
// unfiltered.
$effect(() => {
	const key = `${serializeLines(selectedLines)}|${limit}`;
	if (key === lastFetchedKey) return;
	lastFetchedKey = key;
	void fetchAndSetDepartures(stationId, eventType, selectedLines, limit);
});

// Shallow-route the line filter and the limit into the URL so both can be
// bookmarked: `replaceState` updates the address bar without re-running
// `load` (the changes themselves are picked up by the refetch effect above,
// not by a navigation), and a value at its default removes the parameter
// entirely. `page.url` only updates on real navigations — never from
// `replaceState` — so what the URL currently holds is tracked in plain
// variables instead of being read back out of the (stale) URL.
// Declared after the model effect so a station change (which clears the
// filter) settles first.
let urlSerializedLines = untrack(() =>
	serializeLines(parseLinesParam(new URLSearchParams(page.url.search)))
);
// Compared against the *normalised* URL value on purpose: a non-canonical
// bookmark (`limit=9999`) differs from what the page works with, but rewriting
// the address bar during the first effect flush after hydration throws inside
// SvelteKit's router (its root component is not assigned yet), so the page must
// not `replaceState` its way to the canonical value on mount. The stale value
// in the address bar is cosmetic — every request the page sends carries the
// bounded one — and the first real change replaces it.
let urlSerializedLimit = untrack(() =>
	serializeLimit(parseLimitParam(new URLSearchParams(page.url.search)))
);

$effect(() => {
	const serialized = serializeLines(selectedLines);
	const serializedLimit = serializeLimit(limit);
	if (serialized === urlSerializedLines && serializedLimit === urlSerializedLimit) return;
	urlSerializedLines = serialized;
	urlSerializedLimit = serializedLimit;

	// Rebuild from the address bar itself: it is the only source that
	// reflects previous `replaceState` calls.
	const others = [...new URLSearchParams(window.location.search)].filter(
		([key]) => key !== LINES_PARAM && key !== LIMIT_PARAM
	);
	const params: string[][] = [...others];
	if (serialized) params.push([LINES_PARAM, serialized]);
	if (serializedLimit) params.push([LIMIT_PARAM, serializedLimit]);

	const query = _serializeQuery(params);
	if (query !== window.location.search.slice(1)) {
		replaceState(resolve(query ? `/?${query}` : '/'), {});
	}
});

let stationName = $derived(departures?.stationName ?? '');
let departuresToShow = $derived(_filterDepartures(departures, selectedLines, selectedPlatforms));
// Derived rather than a flag set at toggle time, so there is no window in which
// the template sees the new selection while `displayedLines` still holds the
// old one: the two change in the same re-render.
const awaitingSelection = $derived(displayedLines !== serializeLines(selectedLines));
const hasFilter = $derived(selectedLines.length > 0 || selectedPlatforms.length > 0);
const view = $derived(
	_boardView({
		error,
		departures,
		shownCount: departuresToShow.length,
		awaitingSelection,
		hasFilter
	})
);
const platformNames = $derived(stationPlatforms);
const lineOptions = $derived(
	_lineFilterOptions(_mergeLineOptions(stationLines, liveLineOptions), selectedLines)
);

async function fetchAndSetDepartures(
	stId: string,
	ev: 'dep' | 'arr',
	lines: string[],
	requestLimit: number
) {
	const seq = ++fetchSeq;
	const model: UiModel = await _fetchDepartures(fetch, stId, ev, lines, requestLimit);

	// A newer fetch (another toggle, the poll, or a navigation) superseded
	// this one; drop its stale response.
	if (seq !== fetchSeq) return;

	departures = model.item;
	error = model.error;
	// Whatever is on screen now answers exactly the selection it was fetched
	// with, so an empty result from here on is real, not a race.
	displayedLines = serializeLines(lines);

	// A line-filtered response only contains the selected lines and their
	// platforms; remember everything seen so the sidebar keeps offering the
	// station's other options.
	stationPlatforms = _mergePlatformNames(stationPlatforms, _extractPlatformNames(model.item));
	liveLineOptions = _mergeLineOptions(liveLineOptions, _extractLineOptions(model.item));
}

const depTimer = setInterval(async () => {
	fetchAndSetDepartures(stationId, eventType, selectedLines, limit);
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
		} else if (err.message === LIMIT_ERROR_MESSAGE) {
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
		bind:limit={limit}
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
				<!-- The vendored trigger exposes no open state of its own, so the
				     disclosure's aria-expanded is set here, where the state lives. -->
				<Sidebar.Trigger class="size-9 text-white" aria-expanded={sidebarOpen} />
			</div>
		</div>

		<!-- Departure Display Area -->
		<div class="w-full p-4 sm:p-6">
			{#if view === 'error'}
				<div
					class="rounded-md bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
				>
					<p>{errorMessage(error)}</p>
				</div>
			{:else if view === 'loading'}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{$translations.page.loading}</p>
				</div>
			{:else if view === 'loadingSelection'}
				<!-- The filter change is being applied: the previous response does
				     not answer the current selection, so neither "here are the
				     departures" nor "none match" would be true right now. -->
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{$translations.page.loadingForSelection}</p>
				</div>
			{:else if view === 'unknownStation'}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{interpolate($translations.error.unknownStation, { stationId })}</p>
				</div>
			{:else if view === 'emptyFiltered'}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{$translations.page.noDeparturesForFilter}</p>
				</div>
			{:else if view === 'emptyStop'}
				<div class="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					<p>{$translations.page.noDepartures}</p>
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
