<script lang="ts">
import { ChevronLeft } from 'lucide-svelte';
import { page } from '$app/state';
import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

let { children } = $props();

function goBack() {
	const referrer = document.referrer;

	// No referrer OR referrer is external
	if (!referrer || !referrer.startsWith(window.location.origin)) {
		goto(resolve('/'));
		return;
	}

	window.history.back();
}
</script>

<div class="flex flex-row items-center gap-4 bg-[#c30a37] p-4">
	<button onclick={goBack} aria-label="Zurück">
		<ChevronLeft class="h-6 w-6 text-white hover:cursor-pointer" />
	</button>

	<h1 class="text-2xl font-bold text-white">{page.data.title}</h1>
</div>

<main class="space-y-4 p-4">
	{@render children()}
</main>
