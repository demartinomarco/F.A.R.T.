<script lang="ts">
import * as Sidebar from '$lib/components/ui/sidebar/index.js';
import MultiSelect from '@/components/ui/multi-select/multi-select.svelte';
import LineFilter from '@/components/ui/line-filter/line-filter.svelte';
import LimitInput from '@/components/ui/limit-input/limit-input.svelte';
import CollapsibleGroup from '@/components/ui/collapsible-group/collapsible-group.svelte';
import { Label } from '$lib/components/ui/label/index.js';
import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
import LanguageSelector from '@/components/ui/language-selector/language-selector.svelte';
import Github from '$lib/components/icons/github.svelte';
import { resolve } from '$app/paths';
import { translations } from '$lib/i18n';
import { DEFAULT_LIMIT } from '@/limit-param';
import { cn } from '@/utils.js';
import { onMount } from 'svelte';

let {
	platformNames = [],
	selectedPlatforms = $bindable(),
	lineOptions = [],
	selectedLines = $bindable(),
	lineFilterExpanded = $bindable(false),
	filterGroupExpanded = $bindable(false),
	settingsGroupExpanded = $bindable(true),
	eventType = $bindable(),
	limit = $bindable<number>(DEFAULT_LIMIT),
	theme = 'system'
} = $props();

let hasPlatforms = $derived(platformNames && platformNames.length > 0);

// Count shown on the collapsed Filter header: with the group closed, an active
// line or platform filter would otherwise be invisible (the line filter's own
// count badge lives inside the group).
let activeFilterCount = $derived(selectedLines.length + selectedPlatforms.length);

let currentTheme = $state<'light' | 'dark' | 'system'>('system');

// Sync currentTheme state with theme prop (from SSR) or cookie
onMount(() => {
	const themeCookie = document.cookie
		.split('; ')
		.find((row) => row.startsWith('theme='))
		?.split('=')[1];

	if (themeCookie === 'light' || themeCookie === 'dark') {
		currentTheme = themeCookie;
	} else if (theme === 'light' || theme === 'dark') {
		currentTheme = theme;
	} else {
		currentTheme = 'system';
	}
});

function setTheme(theme: 'light' | 'dark' | 'system') {
	currentTheme = theme;

	if (theme === 'system') {
		// Clear cookie
		document.cookie = 'theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		// Apply system preference
		if (matchMedia('(prefers-color-scheme: dark)').matches) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	} else {
		// Set cookie for SSR (expires in 1 year)
		document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
}
</script>

<Sidebar.Root>
	<!-- Field labels sit 600-weight and one step above the option labels (400):
	     that is what makes a label read as a label on desktop, where 500 and 400
	     are indistinguishable. The groups are separated (space-y-5) by more than
	     the fields inside one (gap-4), and each carries its own rule, so the
	     group boundary stays the loudest break even when a group is collapsed —
	     no 32px of air needed once the rail and its rule do the separating. -->
	<Sidebar.Content class="space-y-5 p-4">
		<!-- No open-state announcement here: the sidebar toggle in the top bar
		     carries aria-expanded (set at its call site in +page.svelte), and a
		     focusable sr-only <button> that does nothing (the old "Sidebar opened"
		     one) only adds an empty stop to the tab order. -->

		<!-- Filter Group. The header is a disclosure; the group starts closed
		     (see `filterGroupExpanded` in +page.svelte) and its rail stays
		     visible, with an active-filter count, while collapsed. -->
		<CollapsibleGroup
			title={$translations.sidebar.filterGroup}
			id="sidebar-filter-group"
			testid="filter-group-toggle"
			badge={activeFilterCount}
			bind:expanded={filterGroupExpanded}
		>
			<Sidebar.Menu class="flex flex-col gap-4">
				<Sidebar.MenuItem class="flex flex-col gap-2">
					<!-- Field Label dims when disabled -->
					<Label
						for="platform-select-input"
						class={cn(
							'text-sm leading-none font-semibold transition-opacity',
							!hasPlatforms && 'opacity-50'
						)}
					>
						{$translations.sidebar.platforms}
					</Label>
					<MultiSelect platformNames={platformNames} bind:selectedPlatforms={selectedPlatforms} />
				</Sidebar.MenuItem>

				<Sidebar.MenuItem class="flex flex-col gap-2">
					<!-- The filter renders its own header (caption + collapse
					     toggle); it dims the caption when no lines exist. The expanded
					     state is bound to the page, so it survives the mobile sheet
					     unmounting on sidebar close. -->
					<LineFilter
						options={lineOptions}
						bind:selectedLines={selectedLines}
						bind:expanded={lineFilterExpanded}
					/>
				</Sidebar.MenuItem>

				<Sidebar.MenuItem class="flex flex-col gap-2">
					<span class="text-sm leading-none font-semibold" id="display-type-label"
						>{$translations.sidebar.displayType}</span
					>
					<RadioGroup.Root
						bind:value={eventType}
						class="gap-2"
						aria-labelledby="display-type-label"
					>
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

				<!-- Number of departures: like the other fields a bounded
				     control, with the bound enforced in the component
				     (src/lib/components/ui/limit-input/). -->
				<Sidebar.MenuItem>
					<LimitInput bind:limit={limit} />
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</CollapsibleGroup>

		<!-- Settings Group. Open by default: it is the smaller group and its
		     controls are the ones people change once and forget. -->
		<CollapsibleGroup
			title={$translations.sidebar.settingsGroups}
			id="sidebar-settings-group"
			testid="settings-group-toggle"
			bind:expanded={settingsGroupExpanded}
		>
			<Sidebar.Menu class="flex flex-col gap-4">
				<Sidebar.MenuItem class="flex flex-col gap-2">
					<span class="text-sm leading-none font-semibold">{$translations.sidebar.language}</span>
					<LanguageSelector />
				</Sidebar.MenuItem>

				<!-- Theme Selector -->
				<Sidebar.MenuItem class="flex flex-col gap-2">
					<span class="text-sm leading-none font-semibold" id="theme-selector-label"
						>{$translations.sidebar.theme}</span
					>
					<RadioGroup.Root
						value={currentTheme}
						onValueChange={(val) => setTheme(val as 'light' | 'dark' | 'system')}
						class="gap-2"
						aria-labelledby="theme-selector-label"
					>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="light" id="theme-light" />
							<Label class="cursor-pointer text-sm font-normal" for="theme-light">
								{$translations.sidebar.themeLight}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="dark" id="theme-dark" />
							<Label class="cursor-pointer text-sm font-normal" for="theme-dark">
								{$translations.sidebar.themeDark}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="system" id="theme-system" />
							<Label class="cursor-pointer text-sm font-normal" for="theme-system">
								{$translations.sidebar.themeSystem}
							</Label>
						</div>
					</RadioGroup.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</CollapsibleGroup>
	</Sidebar.Content>

	<Sidebar.Footer
		class="flex flex-row justify-around gap-3 border-t border-border p-4 text-sm text-muted-foreground"
	>
		<a
			href={resolve("/about")}
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
