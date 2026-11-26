<script lang="ts">
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { translations } from '$lib/i18n';
import { Button } from '$lib/components/ui/button/index.js';

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

<div
	class="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#a8082e] px-4 py-3 shadow-sm"
>
	<div class="flex min-w-0 items-center gap-2">
		<Button variant="ghost" size="icon" class="size-9 shrink-0 text-white" onclick={goBack}>
			<ChevronLeft class="size-6" />
			<span class="sr-only">{$translations.about.back}</span>
		</Button>

		<h1 class="truncate text-2xl font-bold text-white">{page.data.title}</h1>
	</div>
</div>

<main class="space-y-4 p-4">
	{@render children()}
</main>
