<script lang="ts">
	import LineIcon from '$lib/components/line-icon.svelte';
	import SearchBar from '$lib/components/search-bar.svelte';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { ApiResponse, DepartureMinimal } from '@/types/departure';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	let now = $state(new Date());
	let time = $derived(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));

	let departures: ApiResponse = $state({
		...data.item,
		departureList: data.item.departureList.map((d) => ({
			...d,
			plannedTime: toDate(d.plannedTime),
			realTime: toDate(d.realTime)
		}))
	});

	function toDate(v: any): Date | null {
		return v ? new Date(v) : null;
	}

	const countdownText = (d: DepartureMinimal): string => {
		const t = d.realTime ?? d.plannedTime;
		if (!t) return '–';

		const diff = Math.round((t.getTime() - now.getTime()) / 60000);

		if (diff < 0 || diff === 0) return 'Sofort';
		if (diff === 0) return 'sofort';
		if (diff > 10) return t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
		return `${diff} Min`;
	};

	const delayMinutes = (d: DepartureMinimal): number => {
		if (!d.realTime || !d.plannedTime) return 0;
		return Math.round((d.realTime.getTime() - d.plannedTime.getTime()) / 60000);
	};

	const delayLabel = (d: DepartureMinimal): string | null => {
		const delay = delayMinutes(d);
		if (delay > 0) return `(+${delay} Min zu spät)`;
		if (delay < 0) return `(${Math.abs(delay)} Min früher)`;
		return null;
	};

	const colorClass = (d: DepartureMinimal): string => {
		const delay = delayMinutes(d);
		if (delay < 0) return 'text-green-600';
		if (delay > 0) return 'text-red-600';
		return '';
	};

	const stationId = $derived(page.url.searchParams.get('stationId') || '7000090');

	async function fetchDepartures() {
		const res = await fetch(`/departures?stationId=${stationId}`);
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

	const depTimer = setInterval(fetchDepartures, 15000);
	const clockTimer = setInterval(() => (now = new Date()), 1000);

	onDestroy(() => {
		clearInterval(depTimer);
		clearInterval(clockTimer);
	});
</script>

<div class="bg-[#c30a37] flex justify-between items-center p-4">
	<SearchBar />
	<p class="text-white font-medium">{time}</p>
</div>

<div class="p-4">
	{#if departures.departureList.length === 0}
		<p>Loading data...</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#key departures}
				{#each departures.departureList as departure}
					<div class="flex justify-between items-center py-1">
						<div class="flex gap-2 items-center">
							<LineIcon {departure} />
							<p>{departure.direction}</p>
						</div>

						<p class={colorClass(departure)}>
							{countdownText(departure)}

							{#if delayLabel(departure)}
								<span class="ml-1 text-sm opacity-80">{delayLabel(departure)}</span>
							{/if}
						</p>
					</div>
				{/each}
			{/key}
		</div>
	{/if}
</div>
