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
  class="bg-white"
>
  <Select.Trigger class="w-[150px]">{current.label}</Select.Trigger>

  <Select.Content>
    {#each locales as lang (lang.code)}
      <Select.Item value={lang.code}>{lang.label}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
