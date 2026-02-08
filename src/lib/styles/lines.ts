import type { Departure } from '@/types/departure';

export interface LineStyle {
	background: string;
	text: string;
}

export const LINE_STYLES: Record<string, LineStyle> = {
	S1: { background: '#00a66e', text: '#fff' },
	S11: { background: '#00a66e', text: '#fff' },
	S12: { background: '#00a66e', text: '#fff' },

	S2: { background: '#9e67ab', text: '#fff' },

	S3: { background: '#ffdc01', text: '#000' },
	S31: { background: '#00a99d', text: '#fff' },
	S32: { background: '#00a99d', text: '#fff' },
	S33: { background: '#9e67ab', text: '#fff' },

	S4: { background: '#9f184c', text: '#fff' },
	S41: { background: '#bed730', text: '#fff' },
	S42: { background: '#0097bb', text: '#fff' },

	S5: { background: '#f59795', text: '#000' },
	S51: { background: '#f59795', text: '#000' },
	S52: { background: '#f59795', text: '#000' },

	S6: { background: '#01bdf2', text: '#fff' },

	S7: { background: '#fff101', text: '#000' },
	S71: { background: '#fff101', text: '#000' },

	S8: { background: '#6e6928', text: '#fff' },
	S81: { background: '#6e6928', text: '#fff' },

	S9: { background: '#7fc241', text: '#fff' },

	'1': { background: '#ee1d23', text: '#fff' },
	'2': { background: '#0072bc', text: '#fff' },
	'3': { background: '#937138', text: '#fff' },
	'4': { background: '#fec210', text: '#000' },
	'5': { background: '#15c0f2', text: '#fff' },
	'6': { background: '#80c342', text: '#fff' },
	'7': { background: '#58595b', text: '#fff' },
	'8': { background: '#f7931d', text: '#000' },
	'10': { background: '#a4d7bb', text: '#000' }
};
const karlsruhe = [
	'Karlsruhe',
	'Ettlingen',
	'Durlach',
	'Hochstetten (Link.)',
	'Germersheim',
	'Knielingen',
	'Wörth (Rhein)',
	'Daxlanden',
	'Rastatt',
	'Bühl (Baden)',
	'Ittersbach',
	'Bad Herrenalb',
	'Berghausen (Baden)',
	'Grötzingen (b KA)',
	'Weingarten (Baden)'
];

export function getLineStyle(line: Departure, city: string): LineStyle {
	const lineName = line.lineName;
	if (lineName.startsWith('ICE') || lineName.startsWith('IC')) {
		return { background: '#ed1c24', text: '#fff' };
	} else if (lineName.startsWith('RE')) {
		return { background: '#afb4bb', text: '#000' };
	} else if (lineName.startsWith('TGV')) {
		return { background: '#224980', text: '#fff' };
	} else if (line.type === 'Bus' || line.type === 'Regionalbus' || line.type === 'Stadtbus') {
		return { background: '#90268f', text: '#fff' };
	}

	if (karlsruhe.indexOf(city) !== -1 || city.indexOf('Karlsruhe') !== -1) {
		return LINE_STYLES[lineName] ?? { background: '#000', text: '#fff' };
	}

	return { background: '#000', text: '#fff' };
}
