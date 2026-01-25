<script lang="ts">
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';

let { platformNames, selectedPlatforms = $bindable() } = $props();
</script>

<Sidebar.Root class="">
	<Sidebar.Content class="p-4">
		<button class="sr-only" type="button">Sidebar opened</button>
		<Sidebar.GroupLabel>Filter</Sidebar.GroupLabel>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Content>
</Sidebar.Root>
