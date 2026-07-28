<script lang="ts">
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';
import { Label } from '$lib/components/ui/label/index.js';
import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
import LanguageSelector from '@/components/ui/language-selector/language-selector.svelte';
import { Github } from 'lucide-svelte';
import { resolve } from '$app/paths';
import { translations } from '$lib/i18n';
import { cn } from '@/utils.js';

let { platformNames = [], selectedPlatforms = $bindable(), eventType = $bindable() } = $props();

let hasPlatforms = $derived(platformNames && platformNames.length > 0);
</script>

<Sidebar.Root>
	<Sidebar.Content class="space-y-4 p-4">
		<button class="sr-only" type="button">{$translations.sidebar.opened}</button>

		<!-- Filter Group -->
		<Sidebar.Group class="p-0">
			<!-- Distinct Uppercase Section Header -->
			<Sidebar.GroupLabel class="mb-1 px-0 text-xs font-bold tracking-wider uppercase">
				{$translations.sidebar.filterGroup}
			</Sidebar.GroupLabel>
			<Sidebar.Separator class="mb-4" />

			<Sidebar.GroupContent>
				<Sidebar.Menu class="flex flex-col gap-4">
					<Sidebar.MenuItem class="flex flex-col gap-2">
						<!-- Field Label dims when disabled -->
						<span
							class={cn('text-sm font-medium transition-opacity', !hasPlatforms && 'opacity-50')}
						>
							{$translations.sidebar.platforms}
						</span>
						<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
					</Sidebar.MenuItem>

					<Sidebar.MenuItem class="flex flex-col gap-2">
						<span class="text-sm font-medium">{$translations.sidebar.displayType}</span>
						<RadioGroup.Root bind:value={eventType} class="gap-2">
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="dep" id="dep" />
								<Label class="cursor-pointer text-sm font-normal" for="dep">
									{$translations.sidebar.departure}
								</Label>
							</div>
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value="arr" id="arr" />
								<Label class="cursor-pointer text-sm font-normal" for="arr">
									{$translations.sidebar.arrival}
								</Label>
							</div>
						</RadioGroup.Root>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Settings Group -->
		<Sidebar.Group class="p-0">
			<Sidebar.GroupLabel class="mb-1 px-0 text-xs font-bold tracking-wider uppercase">
				{$translations.sidebar.settingsGroups}
			</Sidebar.GroupLabel>
			<Sidebar.Separator class="mb-4" />

			<Sidebar.GroupContent>
				<Sidebar.Menu class="flex flex-col gap-4">
					<Sidebar.MenuItem class="flex flex-col gap-2">
						<span class="text-sm font-medium">{$translations.sidebar.language}</span>
						<LanguageSelector />
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer
		class="flex flex-row justify-around gap-3 border-t border-border p-4 text-sm text-muted-foreground"
	>
		<a
			href={resolve("/about/")}
			rel="nofollow"
			class="underline transition-colors hover:text-foreground"
		>
			{$translations.sidebar.aboutPage}
		</a>

		<a
			href="https://github.com/demartinomarco/F.A.R.T."
			class="flex items-center gap-1 underline transition-colors hover:text-foreground"
			target="_blank"
			rel="noopener noreferrer"
		>
			<Github class="h-4 w-4" />
			GitHub
		</a>
	</Sidebar.Footer>
</Sidebar.Root>
