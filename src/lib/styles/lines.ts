import type { Departure } from '@/kvv-trias/types';
import { isBusVehicleType, isReplacementBus } from '@/kvv-trias/vehicle';

export interface LineStyle {
	background: string;
	text: string;
}

const SLATE_DARK = '#0f172a';

// Every bus gets the same badge, rail replacements included (see
// src/lib/kvv-trias/vehicle.ts for what counts as a bus).
const BUS_STYLE: LineStyle = { background: '#882287', text: '#fff' };

// Badge for a line the palette does not know: a new tram, a train nobody
// expected. Blue, so it never reads as a real line colour, and light enough to
// survive both themes — the old near-black default was #0f172a, which is
// exactly the dark card and sidebar colour, so an unknown line rendered as a
// black hole. This shade keeps at least 3:1 (WCAG AA non-text contrast) against
// every surface a badge sits on in either theme (asserted in lines.spec.ts) and
// its white text still reaches 4.5:1.
const UNKNOWN_LINE_STYLE: LineStyle = { background: '#2f6fd6', text: '#fff' };

export const LINE_STYLES: Record<string, LineStyle> = {
	S1: { background: '#008256', text: '#fff' },
	S11: { background: '#008256', text: '#fff' },
	S12: { background: '#008256', text: '#fff' },

	S2: { background: '#aa70b8', text: SLATE_DARK },

	S3: { background: '#ffdc01', text: SLATE_DARK },

	S31: { background: '#007870', text: '#fff' },
	S32: { background: '#007870', text: '#fff' },
	S33: { background: '#824391', text: '#fff' },

	S4: { background: '#9f184c', text: '#fff' },

	S41: { background: '#bed730', text: SLATE_DARK },
	S42: { background: '#00728d', text: '#fff' },

	S5: { background: '#f59795', text: SLATE_DARK },
	S51: { background: '#f59795', text: SLATE_DARK },
	S52: { background: '#f59795', text: SLATE_DARK },

	S6: { background: '#01bdf2', text: SLATE_DARK },

	S7: { background: '#fff101', text: SLATE_DARK },
	S71: { background: '#fff101', text: SLATE_DARK },

	S8: { background: '#6e6928', text: '#fff' },
	S81: { background: '#6e6928', text: '#fff' },

	S9: { background: '#7fc241', text: SLATE_DARK },

	'1': { background: '#d61a20', text: '#fff' },
	'2': { background: '#0072bc', text: '#fff' },
	'3': { background: '#937138', text: '#fff' },
	'4': { background: '#fec210', text: SLATE_DARK },
	'5': { background: '#15c0f2', text: SLATE_DARK },
	'6': { background: '#80c342', text: SLATE_DARK },
	'7': { background: '#58595b', text: '#fff' },
	'8': { background: '#f7931d', text: SLATE_DARK },
	'10': { background: '#a4d7bb', text: SLATE_DARK },

	// Official KVV GTFS colors (projekte.kvv-efa.de), darkened where needed to
	// reach WCAG AA (4.5:1) — the same treatment as the entries above. 17 and
	// 18 pass unmodified; 19 keeps its official gray with dark text (white text
	// on the official gray fails AA); E reuses the S1 darkening of the same
	// official green; NL1/NL2 reuse the darkened colors of trams 1/2, which
	// share their official colors.
	'17': { background: '#691103', text: '#fff' },
	'18': { background: '#156e41', text: '#fff' },
	'19': { background: '#b3b3b3', text: SLATE_DARK },
	E: { background: '#008256', text: '#fff' },
	NL1: { background: '#d61a20', text: '#fff' },
	NL2: { background: '#0072bc', text: '#fff' }
};

export function getLineStyle(line: Departure): LineStyle {
	const lineName = line.lineName;

	if (isReplacementBus(lineName)) {
		return BUS_STYLE;
	}

	if (/^(ICE|IC|EC|ECE)/i.test(lineName)) {
		return { background: '#d61a20', text: '#fff' };
	}

	if (/^(NJ|EN)/i.test(lineName)) {
		return { background: '#001f52', text: '#fff' };
	}

	if (lineName.startsWith('TGV')) {
		return { background: '#224980', text: '#fff' };
	}

	if (/^(RE|RB|IRE|MEX)/i.test(lineName)) {
		return { background: '#ffd600', text: SLATE_DARK };
	}

	if (isBusVehicleType(line.vehicleType)) {
		return BUS_STYLE;
	}

	// Own-property lookup only: a plain `LINE_STYLES[name] ?? fallback` would
	// hit the prototype chain for hostile names like `__proto__` (truthy, so
	// the fallback never fires) and render `background-color: undefined`.
	return Object.hasOwn(LINE_STYLES, lineName) ? LINE_STYLES[lineName] : UNKNOWN_LINE_STYLE;
}
