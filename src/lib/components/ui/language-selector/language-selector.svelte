<script lang="ts">
import { locale, locales, type Locale } from '$lib/i18n';

let open = $state(false);
let current = $derived(locales.find((l) => l.code === $locale)!);

function select(code: Locale) {
	$locale = code;
	open = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') open = false;
}
</script>

<svelte:window onclick={() => (open = false)} onkeydown={handleKeydown} />

<div class="relative">
	<button
		type="button"
		class="flex items-center gap-1 rounded px-2 py-1 text-lg text-white transition-colors hover:bg-white/20"
		aria-label="Select language"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		{current.flag}
	</button>

	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute right-0 top-full z-50 mt-1 min-w-32 overflow-hidden rounded-md border bg-white shadow-md"
			onclick={(e) => e.stopPropagation()}
		>
			{#each locales as lang}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-100 {lang.code ===
					$locale
						? 'font-semibold'
						: ''}"
					onclick={() => select(lang.code)}
				>
					<span class="text-lg">{lang.flag}</span>
					{lang.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
