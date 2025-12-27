<script lang="ts">
	import { LINE_STYLES } from '$lib/styles/lines';

	export let departure: { lineName: string };

	const style = LINE_STYLES[departure.lineName] ?? { background: '#999', text: '#fff' };
</script>

<div
	class="w-7 h-7 flex items-center justify-center rounded"
	style="background-color: {style.background}; color: {style.text};"
>
	{departure.lineName}
</div>
