<script lang="ts">
import { getLineStyle } from '@/styles/lines';

let { departure, city } = $props();

const style = getLineStyle(departure, city);
// Remove everything after second word, since there often is things like "InterCityExpress", which I don't care about
const lineName = departure.lineName.trim().split(/\s+/).slice(0, 2).join(" ");
</script>

<div
	class="flex h-8 w-fit min-w-8 items-center justify-center rounded p-1 text-sm font-bold"
	style="background-color: {style.background}; color: {style.text};"
>
	{lineName}
</div>
