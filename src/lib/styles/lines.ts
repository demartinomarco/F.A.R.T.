import type { Departure } from '@/kvv-trias/types';

export interface LineStyle {
	background: string;
	text: string;
}

const SLATE_DARK = '#0f172a';

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
	'10': { background: '#a4d7bb', text: SLATE_DARK }
};

export function getLineStyle(line: Departure): LineStyle {
	const lineName = line.lineName;
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

	if (
		line.vehicleType === 'bus' ||
		line.vehicleType === 'Regionalbus' ||
		line.vehicleType === 'Stadtbus'
	) {
		return { background: '#882287', text: '#fff' };
	}

	return LINE_STYLES[lineName] ?? { background: SLATE_DARK, text: '#fff' };
}
