<script lang="ts">
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import { translations, interpolate } from '$lib/i18n';
import type { StationBanner } from '@/kvv-trias/disruptions';

let { banner }: { banner: StationBanner } = $props();

// Keyed by situationNumber, so a station change simply orphans old entries.
let openSituations = $state(new Set<string>());

function toggleSituation(situationNumber: string) {
	const next = new Set(openSituations);
	if (next.has(situationNumber)) next.delete(situationNumber);
	else next.add(situationNumber);
	openSituations = next;
}

function messageText(code: string, text: string): string {
	// Known machine codes get a friendly, localized text.
	if (code === '-4030') return $translations.disruption.stopClosed;
	// Unknown codes: show the raw operator text.
	return interpolate($translations.disruption.otherMessage, { text });
}
</script>

{#if banner.messages.length > 0 || banner.situations.length > 0}
	<div class="mb-4 flex flex-col gap-1.5">
		{#each banner.messages as message (message.text)}
			<div
				class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-900 sm:text-[13px]"
			>
				<TriangleAlert class="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
				<p class="min-w-0">{messageText(message.code, message.text)}</p>
			</div>
		{/each}

		{#each banner.situations as situation (situation.situationNumber)}
			<div
				class="flex flex-col rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 sm:text-[13px]"
			>
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<TriangleAlert class="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
					<span class="min-w-0">
						{situation.summary || situation.description || ''}
					</span>
					{#if situation.detail}
						<button
							type="button"
							class="shrink-0 cursor-pointer rounded text-xs font-medium text-amber-800 underline decoration-amber-400/50 underline-offset-2 hover:decoration-amber-500"
							aria-expanded={openSituations.has(situation.situationNumber)}
							onclick={() => toggleSituation(situation.situationNumber)}
						>
							{openSituations.has(situation.situationNumber)
								? $translations.disruption.detailsHide
								: $translations.disruption.detailsShow}
						</button>
					{/if}
				</div>

				{#if openSituations.has(situation.situationNumber) && situation.detail}
					<!-- detail was converted to plain text server side; nothing injectable -->
					<span
						class="mt-1.5 border-t border-amber-200/60 pt-1.5 text-xs whitespace-pre-line text-amber-900/90"
						>{situation.detail}</span
					>
				{/if}
			</div>
		{/each}
	</div>
{/if}
