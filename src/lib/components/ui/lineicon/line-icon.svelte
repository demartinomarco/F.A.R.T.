<script lang="ts">
import { getLineStyle } from '@/styles/lines';
import type { Departure } from '@/types/departure';

let { departure, city } = $props();

const style = getLineStyle(departure, city);
const lineName = departure.lineName
	.replace(' InterCityExpress', '')
	.replace(' Train a grande Vitesse', '')
	.replace(' Eurocity-Express', '')
	.replace(' InterCity', '')
	.replace(' Fernreisezug externer EU', '')
	.replace(' NightJet', '')
	.replace(' Saaletal', '');
</script>

<div
	class="flex h-8 w-fit min-w-8 items-center justify-center rounded p-1 text-sm font-bold"
	style="background-color: {style.background}; color: {style.text};"
>
	{lineName}
</div>
