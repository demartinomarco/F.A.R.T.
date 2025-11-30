<script lang="ts">
	import LineIcon from "$lib/components/line-icon.svelte";
	import { onMount } from "svelte";

    const zeroPad = (num: number, places: number) => String(num).padStart(places, '0')

    let time = $state(new Date());

	// these automatically update when `time`
	// changes, because of the $derived
	let hours = $derived(zeroPad(time.getHours(), 2));
	let minutes = $derived(zeroPad(time.getMinutes(), 2));


    let departures: DepartureMinimal[] = $state([]);
    const refreshInterval = 15000;

    async function getDepartures() {
        const response = await fetch('/departures');
        return await response.json();
    }

    onMount(() => {
        getDepartures().then(data => departures = data);

        const interval = setInterval(async () => {
            departures = await getDepartures();
        }, refreshInterval);

        const clockInterval = setInterval(() => {
			time = new Date();
		}, 1000);

        return () => {
            clearInterval(interval);
            clearInterval(clockInterval);
        };
    })
</script>

<div class="bg-[#c30a37] flex justify-between items-center p-4">
    <h1 class="text-white font-bold text-2xl">Kronenplatz</h1>
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
                    <LineIcon departure={departure}></LineIcon>
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
                
            {/each }
        </div>
    {/if}
</div>

