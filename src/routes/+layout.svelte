<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { setLocale } from '$lib/i18n';

  let { data, children } = $props();

  // Set the store synchronously during SSR and whenever layout data changes
  // svelte-ignore state_referenced_locally
  setLocale(data.locale);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
