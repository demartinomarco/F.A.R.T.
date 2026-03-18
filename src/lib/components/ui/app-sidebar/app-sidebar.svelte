<script lang="ts">
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';
import { Label } from '$lib/components/ui/label/index.js';
import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
import { Github } from 'lucide-svelte';
	import { resolve } from '$app/paths';
import { translations } from '$lib/i18n';

let { platformNames, selectedPlatforms = $bindable(), eventType = $bindable() } = $props();
</script>

<Sidebar.Root class="">
	<Sidebar.Content class="p-4">
		<button class="sr-only" type="button">{$translations.sidebar.opened}</button>
		<Sidebar.Group>
			<Sidebar.GroupLabel class="text-md px-0! font-medium text-black">{$translations.sidebar.filterGroup}</Sidebar.GroupLabel>
			<hr class="mb-4 h-0.5 rounded-sm bg-gray-500" />
			<Sidebar.GroupContent>
				<Sidebar.Menu class="flex flex-col gap-4">
					<Sidebar.MenuItem class="flex flex-col gap-2 px-2">
						<span class="font-medium">{$translations.sidebar.platforms}</span>
						<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
					</Sidebar.MenuItem>

					<Sidebar.MenuItem class="flex flex-col gap-2 px-2">
						<span class="font-medium">{$translations.sidebar.displayType}</span>
						<RadioGroup.Root bind:value={eventType}>
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="dep" id="dep" />
								<Label class="font-normal" for="dep">{$translations.sidebar.departure}</Label>
							</div>
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="arr" id="arr" />
								<Label class="font-normal" for="arr">{$translations.sidebar.arrival}</Label>
							</div>
						</RadioGroup.Root>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer class="flex flex-row justify-around gap-3 p-4 text-sm opacity-80">
		<a href={resolve("/about/")} rel="nofollow" class="underline">{$translations.sidebar.aboutPage}</a>

		<a
			href="https://github.com/demartinomarco/F.A.R.T."
			class="flex items-center gap-1 underline"
			target="_blank"
			rel="noopener noreferrer"
		>
			<Github class="h-4 w-4" />
			GitHub
		</a>
	</Sidebar.Footer>
</Sidebar.Root>
