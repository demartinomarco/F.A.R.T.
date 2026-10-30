import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
	parseTriasXml,
	extractStopEventResults,
	extractSituationNodes,
	extractErrorMessages
} from '@/kvv-trias/parse';
import {
	mapStopEventResultToDeparture,
	consolidateWagons,
	mapSituationNode,
	mapErrorMessageNode
} from '@/kvv-trias/map';

function load(name: string) {
	return readFileSync(`/home/marco/Projects/F.A.R.T./trias-${name}.xml`, 'utf8');
}

function run(xml: string, stationId: string) {
	const doc = parseTriasXml(xml);
	const results = extractStopEventResults(doc);
	const disruptions = extractSituationNodes(doc)
		.map(mapSituationNode)
		.filter((x) => !!x);
	const byNumber = new Map(disruptions.map((s) => [s!.situationNumber, s!]));
	const mapped = results.map((r) => mapStopEventResultToDeparture(r, byNumber)).filter((x) => !!x);
	const dedup = consolidateWagons(mapped);
	const stationSits = disruptions.filter((s) =>
		s!.affectedStopIds.some((id) => id === stationId || id.startsWith(stationId + ':'))
	);
	const set = new Set(stationSits.map((s) => s!.situationNumber));
	for (const { departure } of dedup)
		departure.situations = departure.situations.filter((s) => !set.has(s.situationNumber));
	return {
		results: results.length,
		disruptions,
		errorMessages: extractErrorMessages(doc).map(mapErrorMessageNode),
		perDeparture: dedup,
		stationSituations: stationSits
	};
}

describe('trias xml fixtures', () => {
	it('closed stop (de:08212:1002) yields error message and nothing else', () => {
		const r = run(load('de-08212-1002'), 'de:08212:1002');
		expect(r.results).toBe(0);
		expect(r.disruptions).toEqual([]);
		expect(r.errorMessages).toEqual([{ code: '-4030', text: 'STOPEVENT_LOCATIONUNSERVED' }]);
	});

	it('rich stop (de:08212:80) partitions situations correctly', () => {
		const r = run(load('de-08212-80'), 'de:08212:80');
		expect(r.results).toBe(20);
		expect(r.disruptions.length).toBe(5);
		expect(r.stationSituations.map((s) => s!.situationNumber)).toEqual(['100004530_KVV_ICSKVV']);
		// every departure carries something now
		expect(r.perDeparture.every((d) => d.departure.situations.length >= 1)).toBe(true);
		// S4/S5 should be flagged notServiced
		const notServiced = r.perDeparture.filter((d) => d.departure.notServiced);
		expect(notServiced.length).toBe(7);
		expect(notServiced.every((d) => d.departure.lineName.startsWith('S'))).toBe(true);
		const withRowWarnings = r.perDeparture.filter((d) => d.departure.situations.length > 0).length;
		expect(withRowWarnings).toBeGreaterThan(10);
	});
});
