<script lang="ts">
import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
import { Label } from '$lib/components/ui/label/index.js';
import { translations } from '$lib/i18n';
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, clampLimit, parseLimitValue } from '@/limit-param';

let { limit = $bindable(DEFAULT_LIMIT) } = $props();

// The bound `limit` is only ever the applied, bounded value. While typing,
// the field keeps a local draft so a partial entry ("1" on the way to "15")
// does not fire a refetch per keystroke; it is committed on blur or Enter,
// through the same parser the URL and the API use: out-of-range input is
// clamped into 1..100, non-numeric input reverts to the applied value
// instead of propagating.
//
// The draft is an assignable `$derived`: it mirrors `limit` — including
// external changes from a bookmark, back/forward or a station change routed
// through `goto`, which are already bounded and simply win over a stale
// draft — until the user types, and then keeps the typed text until the
// next real change to `limit`.
let draft = $derived(String(limit));

function commit() {
	// A plain integer commits (clamped); anything else — empty, `42e5`,
	// pasted garbage — reverts to the applied value instead of propagating.
	const trimmed = draft.trim();
	limit = /^\d+$/.test(trimmed) ? parseLimitValue(trimmed) : limit;
	draft = String(limit);
}

// What a stepper click builds on: the typed draft when it reads as a
// number (the value the user is looking at), otherwise the applied limit.
const effective = $derived(/^\d+$/.test(draft.trim()) ? clampLimit(Number(draft.trim())) : limit);

// A stepper click is a direct command, not a draft edit: it commits
// immediately. At the bounds `limit` stays put, so the page re-fetches
// nothing and the button is disabled instead.
function step(delta: number) {
	const next = clampLimit(effective + delta);
	limit = next;
	draft = String(next);
}
</script>

<div class="flex flex-col gap-2">
	<Label for="departure-limit" class="text-sm leading-none font-semibold">
		{$translations.sidebar.limit}
	</Label>
	<!-- Field look follows the platform selector and the language select (see
	     multi-select.svelte / language-selector.svelte): 40px tall, rounded-md,
	     a solid bg-background card on the sidebar tint, 14px ink, no shadow,
	     and the app-wide 3px focus halo. The vendored Input component is not
	     used: its `shadow-xs` / ring-offset machinery survives any class
	     override (`shadow-none` still computes to Tailwind's zeroed shadow
	     list, not `none`) and made the box measurably differ from the two
	     reference fields, so the field's class list lives here instead.

	     Mouse stepping is a native-spinner-style column on the right edge: the
	     up/down chevron pair stacked over each other behind a hairline divider,
	     each half filling with the app-wide accent on hover. (A lone chevron
	     would read as "opens a list" like the platforms/language fields, and
	     the browser-drawn native arrows cannot match the field family — hence
	     hidden spin buttons and these.) Arrow keys on the input step the same
	     way; at the bounds the corresponding half disables. min/max flag
	     out-of-range input and give phones a numeric keypad, but they do not
	     constrain what lands in the value: the bounds are enforced by
	     `commit`/`step` via src/lib/limit-param.ts, the single source of truth
	     shared with the URL and the API. -->
	<div class="relative">
		<input
			id="departure-limit"
			data-testid="limit-input"
			data-slot="input"
			type="number"
			min={MIN_LIMIT}
			max={MAX_LIMIT}
			step="1"
			inputmode="numeric"
			autocomplete="off"
			value={draft}
			oninput={(e) => (draft = e.currentTarget.value)}
			onchange={commit}
			class="flex h-10 w-full min-w-0 [appearance:textfield] rounded-md border border-input bg-background py-2 ps-3 pe-9 text-sm transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		/>
		<div
			class="absolute inset-y-0 end-0 flex w-7 flex-col overflow-hidden rounded-e-md border-s border-input"
		>
			<button
				type="button"
				data-testid="limit-increase"
				aria-label={$translations.sidebar.limitIncrease}
				class="group/step flex flex-1 cursor-pointer items-center justify-center outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed"
				disabled={effective >= MAX_LIMIT}
				onclick={() => step(1)}
			>
				<ChevronUpIcon
					aria-hidden="true"
					class="pointer-events-none size-3.5 text-foreground opacity-50 transition-opacity group-hover/step:opacity-100 group-disabled/step:opacity-20"
				/>
			</button>
			<button
				type="button"
				data-testid="limit-decrease"
				aria-label={$translations.sidebar.limitDecrease}
				class="group/step flex flex-1 cursor-pointer items-center justify-center outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed"
				disabled={effective <= MIN_LIMIT}
				onclick={() => step(-1)}
			>
				<ChevronDownIcon
					aria-hidden="true"
					class="pointer-events-none size-3.5 text-foreground opacity-50 transition-opacity group-hover/step:opacity-100 group-disabled/step:opacity-20"
				/>
			</button>
		</div>
	</div>
</div>
