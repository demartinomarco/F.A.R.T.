<script lang="ts">
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';
import { Label } from '$lib/components/ui/label/index.js';
import * as RadioGroup from '$lib/components/ui/radio-group/index.js';

let { platformNames, selectedPlatforms = $bindable(), eventType = $bindable() } = $props();
</script>

<Sidebar.Root class="">
	<Sidebar.Content class="p-4">
		<button class="sr-only" type="button">Sidebar opened</button>
		<Sidebar.GroupLabel>Filter</Sidebar.GroupLabel>
		<Sidebar.Menu class="flex flex-col gap-4">
			<Sidebar.MenuItem>
				<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<RadioGroup.Root bind:value={eventType}>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="dep" id="dep" />
						<Label for="dep">Abfahrt</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="arr" id="arr" />
						<Label for="arr">Ankunft</Label>
					</div>
				</RadioGroup.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Content>
</Sidebar.Root>
