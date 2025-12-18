<script lang="ts">
	import LineIcon from "$lib/components/line-icon.svelte";
	import SearchBar from "$lib/components/search-bar.svelte";
	import { onMount, onDestroy } from "svelte";
	import { page } from '$app/state';

	const zeroPad = (num: number, places: number) => String(num).padStart(places, '0');

	let time = $state(new Date());
	let hours = $derived(zeroPad(time.getHours(), 2));
	let minutes = $derived(zeroPad(time.getMinutes(), 2));

	let departures: DepartureMinimal[] = $state([]);
	let stationName = "Hauptbahnhof";
	const refreshInterval = 15000;

	const stationId = $derived(page.params.stationId || '7000090');

	async function getDepartures() {
		const response = await fetch(`/departures?stationId=${stationId}`);
		const data = await response.json();
		if (data.stationName) {
			stationName = data.stationName;
		}
		return data.departures || data;
	}

	let departureInterval: ReturnType<typeof setInterval>;
	let clockInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		getDepartures().then(data => departures = data);

		departureInterval = setInterval(async () => {
			departures = await getDepartures();
		}, refreshInterval);

		clockInterval = setInterval(() => {
			time = new Date();
		}, 1000);
	});

	onDestroy(() => {
		clearInterval(departureInterval);
		clearInterval(clockInterval);
	});
</script>

<div class="bg-[#c30a37] flex justify-between items-center p-4">
	<h1 class="text-white font-bold text-2xl">{stationName}</h1>
	<SearchBar/>
	<p class="text-white font-medium">{hours}:{minutes}</p>
</div>

<div class="p-4">
	{#if departures.length === 0}
		<p>Loading data...</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each departures as departure}
				<div class="flex justify-between">
					<div class="flex gap-2 items-center">
						<LineIcon {departure}></LineIcon>
						<p>{departure.direction}</p>
					</div>

					<p>
						{#if departure.inMinutes <= 0}
							Sofort
						{:else}
							{departure.inMinutes} Minuten
						{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>