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
import type { Disruption } from '@/kvv-trias/types';

// mapStopEventResultToDeparture hands consolidateWagons an internal shape; take
// it from the function instead of duplicating it here.
type RawDeparture = Parameters<typeof consolidateWagons>[0][number];

// These are verbatim TRIAS responses from the KVV feed, not authored XML — see
// tests/fixtures/trias/README.md for what each one contains and why. The point
// is that the situation pipeline is exercised against the shapes the provider
// really sends: prefixed tags, single-or-array elements, operator HTML inside
// Detail, and references hanging off both CallAtStop and Service.
function capture(name: string): string {
	return readFileSync(
		new URL(`../../../tests/fixtures/trias/${name}.xml`, import.meta.url),
		'utf8'
	);
}

type Pipeline = {
	results: number;
	situations: Disruption[];
	departures: ReturnType<typeof consolidateWagons>;
	errorMessages: ReturnType<typeof mapErrorMessageNode>[];
};

// Mirrors getDepartures() up to the point where station-scope partitioning
// happens, so a mapping regression here breaks the same way the board would.
function runPipeline(xml: string): Pipeline {
	const doc = parseTriasXml(xml);
	const results = extractStopEventResults(doc);
	const situations = extractSituationNodes(doc)
		.map(mapSituationNode)
		.filter((s): s is Disruption => !!s);
	const byNumber = new Map(situations.map((s) => [s.situationNumber, s]));
	const mapped = results
		.map((r) => mapStopEventResultToDeparture(r, byNumber))
		.filter((d): d is RawDeparture => !!d);

	return {
		results: results.length,
		situations,
		departures: consolidateWagons(mapped),
		errorMessages: extractErrorMessages(doc)
			.map(mapErrorMessageNode)
			.filter((m): m is NonNullable<typeof m> => !!m)
	};
}

// What index.ts does with the station id: a situation whose Affects list names
// this stop belongs to the banner, not to a departure row.
function partition(pipeline: Pipeline, stationId: string) {
	const stationSituations = pipeline.situations.filter((s) =>
		s.affectedStopIds.some((id) => id === stationId || id.startsWith(`${stationId}:`))
	);
	const stationScoped = new Set(stationSituations.map((s) => s.situationNumber));
	const rows = pipeline.departures.map((d) => ({
		...d,
		departure: {
			...d.departure,
			situations: d.departure.situations.filter((s) => !stationScoped.has(s.situationNumber))
		}
	}));
	return { stationSituations, rows };
}

describe('trias capture: Karlsruhe Ebertstraße (line-scope disruptions)', () => {
	const stationId = 'de:08212:91';
	const pipeline = runPipeline(capture('karlsruhe-ebertstrasse'));

	it('maps every result and finds the situations the response delivers', () => {
		expect(pipeline.results).toBe(20);
		expect(pipeline.departures).toHaveLength(20);
		expect(pipeline.situations).toHaveLength(3);
	});

	it('resolves every situation reference on a departure to a delivered situation', () => {
		// A reference that silently resolves to nothing is an invisible warning,
		// so the join between SituationFullRef and the response context is the
		// thing to watch here.
		const delivered = new Set(pipeline.situations.map((s) => s.situationNumber));
		const referenced = pipeline.departures.flatMap((d) => d.departure.situations);

		expect(referenced.length).toBeGreaterThan(0);
		for (const situation of referenced) {
			expect(delivered.has(situation.situationNumber)).toBe(true);
		}
		expect(pipeline.departures.filter((d) => d.departure.situations.length > 0)).toHaveLength(11);
	});

	it('never hands the same situation to a departure twice', () => {
		// The feed references one line situation from both Service and CallAtStop
		// of the same call; a missing dedupe would print the warning twice.
		for (const { departure } of pipeline.departures) {
			const numbers = departure.situations.map((s) => s.situationNumber);
			expect(new Set(numbers).size).toBe(numbers.length);
		}
	});

	it('strips operator HTML and decodes entities in the delivered text', () => {
		// Detail arrives as escaped markup ("<p><br />(sie) …&szlig;e"). The UI
		// renders it as plain text, so nothing may leak through as markup.
		const withDetail = pipeline.situations.filter((s) => s.detail);
		expect(withDetail).toHaveLength(3);

		for (const situation of withDetail) {
			expect(situation.detail).not.toMatch(/<[a-z]/i);
			expect(situation.detail).not.toContain('&lt;');
			expect(situation.detail).not.toContain('&');
		}
		const weinbrenner = pipeline.situations.find((s) => s.summary.includes('Weinbrennerplatz'));
		expect(weinbrenner?.detail).toContain('Mathystraße');
	});

	it('parses the validity window and priority that the banner sorting relies on', () => {
		for (const situation of pipeline.situations) {
			expect(situation.validFrom).toBeInstanceOf(Date);
			expect(situation.validUntil).toBeInstanceOf(Date);
			expect(situation.priority).toBe(3);
		}
	});

	it('keeps the line-scope situations out of the station banner', () => {
		// ScopeType=line situations carry no Affects/StopPoints at all: they
		// belong to the ride, so they must stay on the rows.
		const { stationSituations, rows } = partition(pipeline, stationId);

		expect(stationSituations).toEqual([]);
		expect(rows.filter((r) => r.departure.situations.length > 0)).toHaveLength(11);
	});

	it('reports the cancelled service and its skipped stop as one row, not two', () => {
		// The feed sets both on line 6 → Tivoli: Cancelled on the Service,
		// NotServicedStop on this call. That co-occurrence is why the row shows
		// only the cancellation.
		const flagged = pipeline.departures.filter(
			(d) => d.departure.cancelled && d.departure.notServiced
		);

		expect(flagged).toHaveLength(1);
		expect(flagged[0].departure.lineName).toBe('6');
		expect(flagged[0].departure.direction).toEqual(['Tivoli über Hauptbahnhof']);
	});

	it('flags the skipped stop independently of cancellation', () => {
		// notServiced is a per-call fact: a service can skip this stop while
		// running normally, and that case still needs the row note.
		const notServiced = pipeline.departures.filter((d) => d.departure.notServiced);
		expect(notServiced).toHaveLength(1);
	});

	it('has no machine messages for a board that answers normally', () => {
		expect(pipeline.errorMessages).toEqual([]);
	});
});

describe('trias capture: Baden-Baden Festspielhaus (station-scope disruptions)', () => {
	const stationId = 'de:08211:32389';
	const pipeline = runPipeline(capture('baden-baden-festspielhaus'));

	it('reads situations whose Affects list names this stop', () => {
		expect(pipeline.results).toBe(20);
		expect(pipeline.situations).toHaveLength(2);

		const { stationSituations } = partition(pipeline, stationId);
		expect(stationSituations.map((s) => s.situationNumber).sort()).toEqual([
			'100004294_KVV_ICSKVV',
			'100004306_KVV_ICSKVV'
		]);
	});

	it('treats a route-scoped situation as station-level when it names the stop', () => {
		// "station-level" is decided by the affected-stop list, not by
		// ScopeType: this response pairs a stopPoint-scoped and a route-scoped
		// situation and both name the stop.
		const scopes = new Map(pipeline.situations.map((s) => [s.situationNumber, s.scopeType]));
		expect(scopes).toEqual(
			new Map([
				['100004306_KVV_ICSKVV', 'stopPoint'],
				['100004294_KVV_ICSKVV', 'route']
			])
		);

		const { stationSituations } = partition(pipeline, stationId);
		expect(stationSituations.map((s) => s.scopeType).sort()).toEqual(['route', 'stopPoint']);
	});

	it('empties the departure rows once the banner owns the situations', () => {
		// Every departure in this response references one of the two situations;
		// after the partition none may keep it, or the banner text would repeat
		// down the whole board.
		const before = pipeline.departures.filter((d) => d.departure.situations.length > 0);
		expect(before.length).toBeGreaterThan(0);

		const { rows } = partition(pipeline, stationId);
		expect(rows.filter((r) => r.departure.situations.length > 0)).toHaveLength(0);
	});

	it('collects the affected stop refs from the nested Affects structure', () => {
		// Affects → StopPoints → AffectedStopPoint → StopPointRef, and fast-xml-parser
		// gives one object or an array depending on how many are delivered.
		for (const situation of pipeline.situations) {
			expect(situation.affectedStopIds.length).toBeGreaterThan(0);
			expect(
				situation.affectedStopIds.some((id) => id === stationId || id.startsWith(`${stationId}:`))
			).toBe(true);
		}
	});
});

describe('trias capture: stop the feed does not answer', () => {
	const pipeline = runPipeline(capture('unknown-stop'));

	it('yields an empty board plus the machine message', () => {
		expect(pipeline.results).toBe(0);
		expect(pipeline.departures).toEqual([]);
		expect(pipeline.situations).toEqual([]);
		expect(pipeline.errorMessages).toEqual([{ code: '-4030', text: 'STOPEVENT_NOEVENTFOUND' }]);
	});
});
