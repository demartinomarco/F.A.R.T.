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
		<Sidebar.Group>
			<Sidebar.GroupLabel class="text-md px-0! font-medium text-black">Filter</Sidebar.GroupLabel>
			<hr class="mb-4 h-0.5 rounded-sm bg-gray-500" />
			<Sidebar.GroupContent>
				<Sidebar.Menu class="flex flex-col gap-4">
					<Sidebar.MenuItem class="flex flex-col gap-2 px-2">
						<span class="font-medium">Gleise</span>
						<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
					</Sidebar.MenuItem>

					<Sidebar.MenuItem class="flex flex-col gap-2 px-2">
						<span class="font-medium">Anzeigeart</span>
						<RadioGroup.Root bind:value={eventType}>
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="dep" id="dep" />
								<Label class="font-normal" for="dep">Abfahrt</Label>
							</div>
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="arr" id="arr" />
								<Label class="font-normal" for="arr">Ankunft</Label>
							</div>
						</RadioGroup.Root>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
