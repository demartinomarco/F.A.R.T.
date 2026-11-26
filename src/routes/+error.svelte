<script lang="ts">
import { resolve } from '$app/paths';
import { page } from '$app/state';
import House from '@lucide/svelte/icons/house';
import RotateCw from '@lucide/svelte/icons/rotate-cw';
import { translations } from '$lib/i18n';
import { Button } from '$lib/components/ui/button/index.js';

// This is the root error boundary, so it also covers the main page. When the
// crash happens on `/` itself a "home" link would only reload the page that
// just broke, so offer a reload there; on any other route (and on a 404) the
// useful escape is back to a known-good start page. `page.url.pathname` and
// `resolve('/')` both carry the base path, so the comparison is base-safe.
const isHome = $derived(page.url.pathname === resolve('/'));
</script>

<div
	class="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#a8082e] px-4 py-3 shadow-sm"
>
	<div class="flex min-w-0 items-center gap-2">
		{#if isHome}
			<Button
				variant="ghost"
				size="icon"
				class="size-9 shrink-0 text-white"
				onclick={() => window.location.reload()}
			>
				<RotateCw class="size-6" />
				<span class="sr-only">{$translations.error.reload}</span>
			</Button>
		{:else}
			<Button variant="ghost" size="icon" class="size-9 shrink-0 text-white" href={resolve('/')}>
				<House class="size-6" />
				<span class="sr-only">{$translations.error.home}</span>
			</Button>
		{/if}

		<h1 class="truncate text-2xl font-bold text-white">{$translations.error.title}</h1>
	</div>
</div>

<main class="p-4">
	{$translations.error.genericMessage}
</main>
