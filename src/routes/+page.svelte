<script lang="ts">
	import LineIcon from '@/components/ui/lineicon/line-icon.svelte';
	import SearchBar from '@/components/ui/searchbar/search-bar.svelte';
	import MultiSelect from 'svelte-multiselect'
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import Ban from '@lucide/svelte/icons/ban';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { ApiResponse, DepartureMinimal } from '@/types/departure';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	let now = $state(new Date());
	let time = $derived(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));

	let selectedPlatforms = $state([])
	let departures: ApiResponse = $state({
		...data.item,
		departureList: data.item.departureList.map((d) => ({
			...d,
			plannedTime: toDate(d.plannedTime),
			realTime: toDate(d.realTime)
		}))
	});
	let departuresToShow = $derived(filterByPlatformName(departures));
	const platformNames = $derived(getPlatformNames(departures));

	function toDate(v: any): Date | null {
		return v ? new Date(v) : null;
	}

	const countdownText = (d: DepartureMinimal): string => {
		const t = d.realTime ?? d.plannedTime;
		if (!t) return '–';

		const diff = Math.round((t.getTime() - now.getTime()) / 60000);

		if (diff < 0 || diff === 0) return 'Sofort';
		if (diff > 10) return t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
		return `${diff} Min`;
	};

	const delayMinutes = (d: DepartureMinimal): number => {
		if (!d.realTime || !d.plannedTime) return 0;
		return Math.round((d.realTime.getTime() - d.plannedTime.getTime()) / 60000);
	};

	const delayLabel = (d: DepartureMinimal): string | null => {
		const delay = delayMinutes(d);
		if (delay == 0) return "";

		const diff = Math.round((d.realTime!.getTime() - now.getTime()) / 60000);
		if (diff <= 0) return `(${d.plannedTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`;
		if (diff > 10) return `(${d.plannedTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`;

		const plannedCountdown = Math.round((d.plannedTime!.getTime() - now.getTime()) / 60000);
		if (plannedCountdown > 0) return `(${plannedCountdown} Min)`
		else return '(Sofort)';
	};

	const colorClass = (d: DepartureMinimal): string => {
		const delay = delayMinutes(d);
		if (delay < 0) return 'text-green-600';
		if (delay > 0) return 'text-[#c30a37]';
		return '';
	};

	let stationId = $derived(page.url.searchParams.get('stationId') || '7000090');
	let stationName = $derived(departures.stationName);

	$effect(() => {
		fetchDepartures(stationId);
		selectedPlatforms = [];
	})

	function getPlatformNames(departures: ApiResponse) {
		return [...new Set(departures.departureList.map(dep => dep.platformName).filter(Boolean))]
			// Sometimes platforms are just numbers, overtimes they have a prefix, like "Gleis"
			// (I sort them as numbers whenever possible otherwise I would get [1, 10, 2] if I would always sort them as strings)
			.sort((a, b) => {
				const na = Number(a), nb = Number(b);
				const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb);
				if (aNum && bNum) return na - nb;
				return a.localeCompare(b);
			});
	}

	function filterByPlatformName(departures: ApiResponse) {
		return departures.departureList.filter(d =>
			selectedPlatforms.length === 0 || selectedPlatforms.includes(d.platformName)
		);
	}

	async function fetchDepartures(stationId: string) {
		const res = await fetch(`/api/departures?stationId=${stationId}`);
		const item = await res.json();
		departures = {
			...item,
			departureList: item.departureList.map((d) => ({
				...d,
				plannedTime: toDate(d.plannedTime),
				realTime: toDate(d.realTime)
			}))
		};
	}

	const depTimer = setInterval(() => fetchDepartures(stationId), 15000);
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
		<SearchBar bind:selectedId={stationId} bind:selectedValue={stationName}/>
		<MultiSelect options={platformNames}
								 bind:selected={selectedPlatforms}
								 outerDivClass="flex-row-reverse min-w-0! w-60! h-fit gap-4! flex-nowrap! bg-white! border! rounded-md! py-2! px-3!"
								 inputClass="text-sm! placeholder:opacity-50! min-w-0! caret-transparent w-0!"
								 ulOptionsClass="mt-1!"
								 placeholder="Gleis filter"
								 readOnly={true}
								 disabled={platformNames.length === 0}
		>
			{#snippet expandIcon({ open })}
				<ChevronsUpDownIcon class="w-4! h-4! opacity-50 shrink-0" />
			{/snippet}
			{#snippet disabledIcon()}
				<Ban class="w-4! h-4! opacity-50 shrink-0" />
			{/snippet}
		</MultiSelect>
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
					<div class="flex justify-between items-center py-1">
						<div class="flex gap-2 items-center">
							<LineIcon city={departures.cityName} {departure} />
							<p class="min-w-1">{departure.direction}</p>
						</div>

						<p class="{colorClass(departure)}">
							{#if delayLabel(departure)}
								<span class="opacity-50 text-black">{delayLabel(departure)}</span>
							{/if}

							{countdownText(departure)}

						</p>
					</div>
				{/each}
			{/key}
		</div>
	{/if}
</div>
