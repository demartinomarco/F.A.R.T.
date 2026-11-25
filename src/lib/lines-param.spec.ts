import { describe, expect, it } from 'vitest';
import {
	LINES_PARAM,
	MAX_LINES,
	MAX_LINE_NAME_LENGTH,
	MAX_LINES_PARAM_LENGTH,
	normalizeLines,
	parseLinesParam,
	parseLinesValue,
	serializeLines
} from './lines-param';

function paramsWithLines(value: string): URLSearchParams {
	const searchParams = new URLSearchParams();
	searchParams.set(LINES_PARAM, value);
	return searchParams;
}

describe('lines parameter', () => {
	it('is carried by the `lines` query parameter', () => {
		expect(LINES_PARAM).toBe('lines');
	});

	it('round-trips a comma-separated selection', () => {
		const serialized = serializeLines(['S1', 'S4', '2']);

		expect(serialized).toBe('S1,S4,2');
		expect(parseLinesParam(new URLSearchParams(`${LINES_PARAM}=${serialized}`))).toEqual([
			'S1',
			'S4',
			'2'
		]);
	});

	it('keeps line names with spaces intact', () => {
		const value = serializeLines(['RE 7', 'ICE 2']);

		expect(parseLinesParam(paramsWithLines(value))).toEqual(['RE 7', 'ICE 2']);
	});

	it('trims and deduplicates entries, keeping the first occurrence', () => {
		const names = [' S1 ', '', 'S4', 'S1', '\u200b2'].join(',');

		// Same input as the endpoint test in
		// src/routes/api/departures/departures.spec.ts: one parser, one result.
		expect(parseLinesParam(paramsWithLines(names))).toEqual(['S1', 'S4', '2']);
		expect(serializeLines([' S1 ', '', 'S4', 'S1'])).toBe('S1,S4');
	});

	it('is empty when cleared so the parameter can be dropped', () => {
		expect(serializeLines([])).toBe('');
		expect(serializeLines([' ', ''])).toBe('');
		expect(parseLinesParam(new URLSearchParams(''))).toEqual([]);
		expect(parseLinesParam(paramsWithLines(',,'))).toEqual([]);
		expect(parseLinesValue(null)).toEqual([]);
	});
});

describe('normalizeLines', () => {
	it('is idempotent', () => {
		const once = normalizeLines([' S1 ', 'S1', 'RE 7', '\u200bS2', 'x'.repeat(60)]);

		expect(once).toEqual(['S1', 'RE 7', 'S2']);
		expect(normalizeLines(once)).toEqual(once);
	});

	it('agrees between array input and URL input', () => {
		// The client normalizes the sidebar selection (an array), the API the
		// raw URL value. Both must end up with the same selection.
		const names = ['S1', ' S1', '<script>alert(1)</script>', '', 'RE 7'];

		expect(normalizeLines(names)).toEqual(parseLinesValue(serializeLines(names)));
	});
});

describe('lines parameter against hostile input', () => {
	it('caps the number of accepted lines', () => {
		const names = Array.from({ length: MAX_LINES + 50 }, (_, i) => `L${i}`);

		expect(parseLinesParam(paramsWithLines(names.join(',')))).toEqual(names.slice(0, MAX_LINES));
	});

	it('bounds a value with a huge number of entries to the first accepted names', () => {
		const names = Array.from({ length: 5000 }, (_, i) => `L${i}`);

		const lines = parseLinesParam(paramsWithLines(names.join(',')));

		expect(lines).toHaveLength(MAX_LINES);
		expect(lines).toEqual(names.slice(0, MAX_LINES));
	});

	it('drops individual names longer than a plausible line name', () => {
		const value = [
			'a'.repeat(MAX_LINE_NAME_LENGTH),
			'b'.repeat(MAX_LINE_NAME_LENGTH + 1),
			'S1'
		].join(',');

		expect(parseLinesParam(paramsWithLines(value))).toEqual([
			'a'.repeat(MAX_LINE_NAME_LENGTH),
			'S1'
		]);
	});

	it('does not materialize an unbounded array for a huge value', () => {
		expect(parseLinesParam(paramsWithLines('x'.repeat(1_000_000)))).toEqual([]);
	});

	it('truncates the raw value before splitting', () => {
		// Only the first MAX_LINES_PARAM_LENGTH characters are ever looked at:
		// a name after the cut is dropped rather than silently kept.
		expect(parseLinesValue(`S1,${'x'.repeat(MAX_LINES_PARAM_LENGTH)}`)).toEqual(['S1']);
		expect(parseLinesValue(`${'x'.repeat(MAX_LINES_PARAM_LENGTH)},S1`)).toEqual([]);
	});

	it('survives hostile characters without throwing', () => {
		const value = ['<script>alert(1)</script>', '\u0000', 'a"b\'c', 'tab\tname'].join(',');

		expect(() => parseLinesParam(paramsWithLines(value))).not.toThrow();
		expect(parseLinesParam(paramsWithLines(value))).toEqual([
			'<script>alert(1)</script>',
			'a"b\'c',
			'tabname'
		]);
	});

	it('strips control, zero-width and bidi characters from names', () => {
		const value = ['a\u200b', 'a\u202Eb', '\u2066S1\u2069', '\u0000'].join(',');

		// The lone NUL entry strips down to nothing and is dropped entirely.
		expect(parseLinesParam(paramsWithLines(value))).toEqual(['a', 'ab', 'S1']);
	});

	it('stays stable across serialize/parse round-trips at the cap', () => {
		const names = Array.from({ length: 250 }, (_, i) => `L${i}`);
		const once = parseLinesParam(paramsWithLines(names.join(',')));
		const twice = parseLinesParam(paramsWithLines(serializeLines(once)));

		expect(once).toHaveLength(MAX_LINES);
		expect(twice).toEqual(once);
	});

	it('returns nothing for a parameter made only of empty or overlong entries', () => {
		expect(parseLinesParam(paramsWithLines(',,,  ,  '))).toEqual([]);
		expect(parseLinesParam(paramsWithLines(`${'y'.repeat(60)},${'z'.repeat(70)}`))).toEqual([]);
	});
});
