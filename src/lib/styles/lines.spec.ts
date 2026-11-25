import { describe, expect, it } from 'vitest';
import { getLineStyle, LINE_STYLES, type LineStyle } from './lines';
import type { Departure } from '@/kvv-trias/types';

// WCAG 2.x relative luminance and contrast ratio (https://www.w3.org/TR/WCAG21/dfn-contrast-ratio.html).
function luminance(hex: string): number {
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	const h = hex.replace('#', '');
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h;
	const n = parseInt(full, 16);
	return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

// The badges render 14px bold text, so WCAG AA normal-text (4.5:1) applies.
function assertAA(style: LineStyle) {
	expect(
		contrastRatio(style.background, style.text),
		`${style.background} on ${style.text}`
	).toBeGreaterThanOrEqual(4.5);
}

describe('LINE_STYLES', () => {
	it('meets WCAG AA contrast for every entry', () => {
		for (const style of Object.values(LINE_STYLES)) {
			assertAA(style);
		}
	});

	it('carries the trams missing from the original palette (official KVV GTFS colors)', () => {
		// 17 and 18 pass AA unmodified; 19 keeps its official gray with dark
		// text; E/NL1/NL2 reuse the darkened variants of the same official
		// colors already used for S1 and trams 1/2.
		expect(LINE_STYLES['17']).toEqual({ background: '#691103', text: '#fff' });
		expect(LINE_STYLES['18']).toEqual({ background: '#156e41', text: '#fff' });
		expect(LINE_STYLES['19']).toEqual({ background: '#b3b3b3', text: '#0f172a' });
		expect(LINE_STYLES.E).toEqual({ background: '#008256', text: '#fff' });
		expect(LINE_STYLES['NL1']).toEqual({ background: '#d61a20', text: '#fff' });
		expect(LINE_STYLES['NL2']).toEqual({ background: '#0072bc', text: '#fff' });
	});
});

function departure(lineName: string, vehicleType = 'tram'): Departure {
	return {
		lineName,
		direction: ['Karlsruhe Hauptbahnhof'],
		plannedTime: new Date('2026-11-24T12:00:00.000Z'),
		vehicleType,
		realTime: null,
		wagonCount: 1,
		cancelled: false
	};
}

describe('getLineStyle fallbacks', () => {
	it('every hardcoded fallback meets WCAG AA contrast', () => {
		const samples: [string, string][] = [
			['ICE 574', 'rail'],
			['IC 221', 'rail'],
			['NJ 402', 'rail'],
			['TGV 9576', 'rail'],
			['RE 40', 'rail'],
			['RB 51', 'rail'],
			['47', 'bus'],
			['222', 'bus'],
			['X99', 'rail'] // no match: slate fallback
		];

		for (const [lineName, vehicleType] of samples) {
			assertAA(getLineStyle(departure(lineName, vehicleType)));
		}
	});

	it('looks up new tram entries by name', () => {
		expect(getLineStyle(departure('17')).background).toBe('#691103');
		expect(getLineStyle(departure('NL2')).background).toBe('#0072bc');
	});
});
