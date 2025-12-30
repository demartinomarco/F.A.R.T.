<script lang="ts">
	import { getLineStyle } from '@/styles/lines';
	import type { DepartureMinimal } from '@/types/departure';

	let { departure, city } = $props();

	const style = getLineStyle(departure, city);
	const lineName = departure.lineName
		.replace(' InterCityExpress', '')
		.replace(' Train a grande Vitesse', '')
		.replace(' Eurocity-Express', '')
		.replace(' InterCity', '');
</script>

<div
	class="min-w-8.5 w-fit p-1 h-8.5 font-bold flex items-center justify-center rounded"
	style="background-color: {style.background}; color: {style.text};"
>
	{lineName}
</div>

