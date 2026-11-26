/**
 * The `limit` query parameter: its name, its bounds and its normalisation.
 *
 * One module for both sides of the departure-count control, because they
 * have to agree on what a limit is:
 *
 * - the page (`src/routes/+page.ts`, `+page.svelte`) parses it from the URL
 *   into the sidebar input, writes the input back for bookmarks and sends it
 *   to the API;
 * - the API (`src/routes/api/departures/+server.ts`) and the pipeline
 *   (`src/lib/kvv-trias/index.ts`) bound the incoming value with the same
 *   constants, and `src/lib/departure-limit.ts` doubles the bounded value for
 *   the upstream over-fetch.
 *
 * The value is attacker-controlled (typed or bookmarked URLs), so parsing is
 * strict: only a plain positive decimal integer is honoured, everything else
 * falls back to the default, and out-of-range numbers are clamped into bounds.
 * Whatever a caller puts in the URL, the backend must never ask TRIAS for
 * more than `MAX_LIMIT` departures (doubled for the over-fetch).
 */

/** Query parameter holding the number of departures to display. */
export const LIMIT_PARAM = 'limit';

/** Bounds of a usable limit; `MAX_LIMIT` also bounds the upstream fetch.
 *  Typed as `number` (not literals) so they stay usable as prop defaults. */
export const MIN_LIMIT: number = 1;
export const MAX_LIMIT: number = 100;

/** Used when the parameter is absent or malformed. */
export const DEFAULT_LIMIT: number = 20;

// Longer values are never a plausible limit. Capping the string before
// `Number()` keeps the parse from scaling with attacker-controlled input.
const MAX_LIMIT_PARAM_LENGTH = 16;

// Only a plain decimal integer is honoured: signs, exponents ("1e3"),
// hexadecimal ("0x10") and embedded spaces are attack or corruption, not a
// value anyone typed into the sidebar.
const PLAIN_INTEGER = /^\d+$/;

/**
 * Normalises any numeric limit into the accepted range. Non-finite input
 * falls back to the default; fractional values are truncated.
 */
export function clampLimit(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_LIMIT;
	return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(value)));
}

/**
 * Parses a raw `limit` value. Missing, empty, non-numeric or overlong input
 * yields the default; a plain integer out of range is clamped — a bookmarked
 * `limit=9999` means "as many as possible", not "break the page".
 */
export function parseLimitValue(raw: string | null): number {
	if (!raw) return DEFAULT_LIMIT;

	const trimmed = raw.trim().slice(0, MAX_LIMIT_PARAM_LENGTH);
	if (!PLAIN_INTEGER.test(trimmed)) return DEFAULT_LIMIT;

	return clampLimit(Number(trimmed));
}

/** Reads and parses the `limit` parameter of a query string. */
export function parseLimitParam(searchParams: URLSearchParams): number {
	return parseLimitValue(searchParams.get(LIMIT_PARAM));
}

/**
 * Serializes a limit for the URL. The default becomes the empty string,
 * which means the parameter should be removed entirely — the address bar
 * only carries what differs from the default.
 */
export function serializeLimit(limit: number): string {
	const bounded = clampLimit(limit);
	return bounded === DEFAULT_LIMIT ? '' : String(bounded);
}
