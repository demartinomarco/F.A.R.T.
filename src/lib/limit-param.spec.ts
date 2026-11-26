import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LIMIT,
	LIMIT_PARAM,
	MAX_LIMIT,
	MIN_LIMIT,
	clampLimit,
	parseLimitParam,
	parseLimitValue,
	serializeLimit
} from './limit-param';

function paramsWithLimit(value: string): URLSearchParams {
	const searchParams = new URLSearchParams();
	searchParams.set(LIMIT_PARAM, value);
	return searchParams;
}

describe('limit parameter', () => {
	it('is carried by the `limit` query parameter, bounded to 1..100', () => {
		expect(LIMIT_PARAM).toBe('limit');
		expect(MIN_LIMIT).toBe(1);
		expect(MAX_LIMIT).toBe(100);
		expect(DEFAULT_LIMIT).toBe(20);
	});

	it('round-trips non-default values through the URL', () => {
		expect(serializeLimit(42)).toBe('42');
		expect(parseLimitParam(paramsWithLimit('42'))).toBe(42);
		expect(parseLimitParam(paramsWithLimit('1'))).toBe(1);
		expect(parseLimitParam(paramsWithLimit('100'))).toBe(100);
	});

	it('serializes the default as empty so the parameter can be dropped', () => {
		expect(serializeLimit(DEFAULT_LIMIT)).toBe('');
		expect(parseLimitParam(new URLSearchParams(''))).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue(null)).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('')).toBe(DEFAULT_LIMIT);
	});

	it('clamps out-of-range numbers into bounds', () => {
		// A bookmarked or typed value past the bounds is honoured as close as
		// possible instead of failing: `limit=9999` means "as many as I can get".
		expect(parseLimitValue('0')).toBe(MIN_LIMIT);
		expect(parseLimitValue('101')).toBe(MAX_LIMIT);
		expect(parseLimitValue('9999')).toBe(MAX_LIMIT);
	});
});

describe('clampLimit', () => {
	it('is idempotent and truncates fractions', () => {
		expect(clampLimit(clampLimit(250))).toBe(MAX_LIMIT);
		expect(clampLimit(clampLimit(-25))).toBe(MIN_LIMIT);
		expect(clampLimit(42.9)).toBe(42);
	});

	it('falls back to the default for non-finite input', () => {
		expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
		expect(clampLimit(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LIMIT);
		expect(clampLimit(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_LIMIT);
	});
});

describe('limit parameter against hostile input', () => {
	it('honours only plain decimal integers', () => {
		expect(parseLimitValue('-5')).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('1e3')).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('0x10')).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('12abc')).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('Infinity')).toBe(DEFAULT_LIMIT);
		expect(parseLimitValue('2 0')).toBe(DEFAULT_LIMIT);
	});

	it('does not scale the parse with the raw input length', () => {
		expect(parseLimitValue('9'.repeat(1_000_000))).toBe(MAX_LIMIT);
		expect(parseLimitParam(paramsWithLimit('x'.repeat(1_000_000)))).toBe(DEFAULT_LIMIT);
	});

	it('survives hostile characters without throwing', () => {
		const value = '<script>alert(1)</script>';

		expect(() => parseLimitParam(paramsWithLimit(value))).not.toThrow();
		expect(parseLimitParam(paramsWithLimit(value))).toBe(DEFAULT_LIMIT);
	});

	it('stays stable across serialize/parse round-trips at the bounds', () => {
		for (const limit of [MIN_LIMIT, DEFAULT_LIMIT, MAX_LIMIT]) {
			const once = parseLimitParam(paramsWithLimit(serializeLimit(limit)));
			const twice = parseLimitParam(paramsWithLimit(serializeLimit(once)));

			expect(once).toBe(limit);
			expect(twice).toBe(once);
		}
	});
});
