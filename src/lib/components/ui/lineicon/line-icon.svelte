<script lang="ts">
import { getLineStyle } from '@/styles/lines';

let { departure } = $props();

const style = $derived(getLineStyle(departure));
// Remove everything after second word, since there often is things like "InterCityExpress", which I don't care about
const lineName = $derived(departure.lineName.trim().split(/\s+/).slice(0, 2).join(' '));
</script>

<div
	class="line-badge flex h-8 w-fit min-w-8 items-center justify-center rounded p-1 text-sm font-bold"
	style="background-color: {style.background}; color: {style.text};"
>
	{lineName}
</div>
