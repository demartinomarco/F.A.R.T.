<script lang="ts">
import { setLocale, locale, locales, type Locale } from '$lib/i18n';
import * as Select from '$lib/components/ui/select/index.js';

// Find current locale info (flag + label) based on current store value
let current = $derived(locales.find((l) => l.code === $locale) ?? locales[0]);
</script>

<Select.Root
	type="single"
	value={$locale}
	onValueChange={(val) => {
    if (val) setLocale(val as Locale);
  }}
>
	<!-- Field look follows the platform selector (see multi-select.svelte): 40px
	     tall, rounded-md, a solid bg-background card on the sidebar tint, px-3.
	     The vendored Select trigger ships a smaller, transparent variant of the
	     same idea (h-8, rounded-lg, bg-transparent with a dark:bg-input tint,
	     pl-2.5/pr-2), so it is corrected here instead of in the primitive. The
	     focus ring is deliberately NOT overridden: the primitive already draws the
	     one Focus Halo the whole app uses (3px, ring at 50%). Same for the
	     chevron, which takes the platform's muted ink (foreground at 50%) rather
	     than the lighter text-muted-foreground. -->
	<Select.Trigger
		class="min-h-10 w-full gap-2 rounded-md bg-background px-3 data-[size=default]:h-10 dark:bg-background dark:hover:bg-background [&_svg]:text-foreground [&_svg]:opacity-50"
	>
		{current.label}
	</Select.Trigger>

	<!-- Panel and rows join the platform selector's popover: rounded-md with a
	     Hairline border (the primitive uses a 10px radius and a translucent ring
	     instead), the same row padding, and a primary-coloured tick so the
	     current language reads as the picked one. -->
	<Select.Content class="rounded-md border ring-0">
		{#each locales as lang (lang.code)}
			<Select.Item value={lang.code} class="py-1.5 pr-8 pl-2 [&_svg]:text-primary">
				{lang.label}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
