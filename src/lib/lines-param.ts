/**
 * The `lines` query parameter: its name, its bounds and its normalisation.
 *
 * One module for both sides of the line filter, because they have to agree on
 * what a selected line is:
 *
 * - the page (`src/routes/+page.ts`, `+page.svelte`) parses it into the sidebar
 *   selection, serializes the selection back for bookmarks and filters the
 *   displayed departures by it;
 * - the API (`src/routes/api/departures/+server.ts`) parses the same value and
 *   resolves it to TRIAS LineRefs for the upstream `LineFilter`.
 *
 * Duplicating the rules let the two drift apart: the client would offer (or
 * display) a selection the server interprets differently, so a bookmark could
 * show one thing and fetch another.
 *
 * The value is attacker-controlled (typed or bookmarked URLs), so parsing stays
 * bounded: it must not blow up memory, freeze the selection state, render an
 * unbounded badge list, or balloon the upstream TRIAS request.
 */

/** Query parameter holding the comma-separated line selection. */
export const LINES_PARAM = 'lines';

/** Raw value is truncated to this length before splitting. */
export const MAX_LINES_PARAM_LENGTH = 8192;

/** Distinct names kept at most; bounds the badges and the upstream filter. */
export const MAX_LINES = 100;

/** Names longer than this are never a real service. */
export const MAX_LINE_NAME_LENGTH = 50;

// Control characters (NUL, tabs) and format characters (zero-width spaces,
// bidi overrides) have no business in a line name. Stripping them keeps badges
// from rendering browser-mangled or visually spoofed text.
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu;

/**
 * Normalises line names: strips invisible characters, trims, drops empty and
 * oversized names, removes duplicates (first occurrence wins) and caps the
 * result at `MAX_LINES`.
 */
export function normalizeLines(lines: string[]): string[] {
	const seen = new Set<string>();

	for (const line of lines) {
		const name = line.replace(INVISIBLE_CHARS, '').trim();
		if (!name || name.length > MAX_LINE_NAME_LENGTH) continue;
		seen.add(name);
		if (seen.size >= MAX_LINES) break;
	}

	return [...seen];
}

/**
 * Parses a raw `lines` value (comma-separated line names). Missing, empty or
 * entirely malformed input yields an empty selection. Overlong values are
 * truncated before splitting, because the split is the only step that scales
 * with the raw input length.
 */
export function parseLinesValue(raw: string | null): string[] {
	if (!raw) return [];

	return normalizeLines(raw.slice(0, MAX_LINES_PARAM_LENGTH).split(','));
}

/** Reads and parses the `lines` parameter of a query string. */
export function parseLinesParam(searchParams: URLSearchParams): string[] {
	return parseLinesValue(searchParams.get(LINES_PARAM));
}

/**
 * Serializes a selection for the URL. An empty selection becomes the empty
 * string, which means the parameter should be removed entirely.
 */
export function serializeLines(lines: string[]): string {
	return normalizeLines(lines).join(',');
}
