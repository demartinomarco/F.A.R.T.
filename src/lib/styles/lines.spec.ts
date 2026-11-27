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
		cancelled: false,
		situations: [],
		notServiced: false
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
			['SEV S4', 'rail'],
			['X99', 'rail'] // no match: default badge
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

describe('rail replacement (SEV)', () => {
	// TRIAS reports the mode of the *replaced* line, so a replacement for an
	// S-Bahn arrives as `vehicleType: 'rail'` and the bus branch below would
	// never colour it. The name is what identifies the bus.
	const names = ['SEV', 'SEV S4', 'SEV S41/S42', 'SEV S7/S8', 'SEV RB74', 'SEV RE10', 'SEV 721'];

	it('badges every replacement as a bus, whatever mode the feed reports', () => {
		for (const name of names) {
			for (const vehicleType of ['rail', 'bus', 'tram', '']) {
				expect(
					getLineStyle(departure(name, vehicleType)).background,
					`${name} (${vehicleType || 'no mode'})`
				).toBe('#882287');
			}
		}
	});

	it('is matched by name alone', () => {
		expect(getLineStyle(departure('S4 SEV')).background).toBe('#882287');
	});

	it('does not swallow lines that merely start with the same letters', () => {
		// Not a replacement: the default badge, not the bus purple.
		expect(getLineStyle(departure('SEVAS'))).toEqual(getLineStyle(departure('X99')));
	});

	it('does not touch the replaced line itself', () => {
		expect(getLineStyle(departure('S4')).background).toBe('#9f184c');
		expect(getLineStyle(departure('RB 51')).background).toBe('#ffd600');
	});
});

describe('default badge for unknown lines', () => {
	// Surfaces a badge can be drawn on, taken from the oklch theme values in
	// src/routes/layout.css and converted to sRGB.
	const surfaces = {
		light: [
			'#ffffff' /* background, card, popover */,
			'#f8fafc' /* sidebar */,
			'#f1f5f9' /* muted, accent, hover */,
			'#e2e8f0' /* border */
		],
		dark: [
			'#020618' /* background */,
			'#0f172b' /* card, popover, sidebar */,
			'#1d293d' /* muted, accent, hover */
		]
	};

	const unknown = getLineStyle(departure('X99'));

	it('is a blue instead of the old near-black', () => {
		expect(unknown.background).toBe('#2f6fd6');
		expect(unknown.text).toBe('#fff');
	});

	// The old default was #0f172a — literally the dark card and sidebar colour,
	// so an unknown line vanished in the dark theme.
	it('stays visible against every surface in both themes', () => {
		for (const [theme, colors] of Object.entries(surfaces)) {
			for (const surface of colors) {
				expect(
					contrastRatio(unknown.background, surface),
					`${unknown.background} on ${surface} (${theme})`
				).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('applies to unknown trams, trains and prototype-chain names alike', () => {
		for (const lineName of ['X99', '999', '__proto__', 'constructor', 'toString']) {
			for (const vehicleType of ['tram', 'rail', '']) {
				expect(getLineStyle(departure(lineName, vehicleType))).toEqual(unknown);
			}
		}
	});
});
