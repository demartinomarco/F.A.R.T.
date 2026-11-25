import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { buildStopEventRequestXml } from './xml';

const base = {
	requestorRef: 'test-requestor',
	stopPlaceRef: 'de:08212:89',
	depArrTime: '2026-11-24T12:00:00+01:00',
	stopEventType: 'departure' as const,
	numberOfResults: 20
};

// The subset of the parsed request the LineFilter assertions need.
// `Line` is a single object for one ref and an array for several
// (fast-xml-parser only collects arrays on repetition).
type ParsedParams = {
	LineFilter: { Line: { LineRef: string } | { LineRef: string }[]; Exclude: boolean };
	NumberOfResults: number;
};

function paramsOf(xml: string): ParsedParams {
	const doc = new XMLParser({ removeNSPrefix: true }).parse(xml) as {
		Trias: { ServiceRequest: { RequestPayload: { StopEventRequest: { Params: ParsedParams } } } };
	};
	return doc.Trias.ServiceRequest.RequestPayload.StopEventRequest.Params;
}

describe('buildStopEventRequestXml', () => {
	it('omits the LineFilter when no lines are selected', () => {
		const xml = buildStopEventRequestXml(base);

		expect(xml).not.toContain('LineFilter');
	});

	it('omits the LineFilter for an empty selection', () => {
		const xml = buildStopEventRequestXml({ ...base, lineRefs: [] });

		expect(xml).not.toContain('LineFilter');
	});

	it('emits one <Line> per ref and an explicit Exclude=false', () => {
		const xml = buildStopEventRequestXml({
			...base,
			lineRefs: ['kvv:21003:E:H', 'kvv:21003:E:R']
		});

		expect(xml).toContain('<LineFilter>');
		expect(xml).toContain('<Line><LineRef>kvv:21003:E:H</LineRef></Line>');
		expect(xml).toContain('<Line><LineRef>kvv:21003:E:R</LineRef></Line>');
		// The XSD default for Exclude is true: without an explicit false the
		// filter would keep everything EXCEPT the selected lines.
		expect(xml).toContain('<Exclude>false</Exclude>');
		// The filter sits inside <Params>, before <NumberOfResults> — the
		// placement that the live KVV endpoint accepts.
		expect(xml).toMatch(/<Params>\s*<LineFilter>/);
		expect(xml.indexOf('<LineFilter>')).toBeLessThan(xml.indexOf('<NumberOfResults>'));
	});

	it('deduplicates refs so each line is sent once', () => {
		const xml = buildStopEventRequestXml({
			...base,
			lineRefs: ['kvv:21003:E:H', 'kvv:21003:E:H', 'kvv:21003:E:R']
		});

		expect(xml.match(/<Line><LineRef>/g)).toHaveLength(2);
	});

	it('escapes hostile ref values so the XML stays well-formed', () => {
		const xml = buildStopEventRequestXml({ ...base, lineRefs: ['kvv:a<b>&"c:d'] });

		expect(xml).toContain('<LineRef>kvv:a&lt;b&gt;&amp;&quot;c:d</LineRef>');
		expect(xml).not.toContain('<b>');

		// And it still parses back to the original value.
		const { LineFilter } = paramsOf(xml);
		expect(Array.isArray(LineFilter.Line) ? LineFilter.Line[0] : LineFilter.Line).toEqual({
			LineRef: 'kvv:a<b>&"c:d'
		});
	});

	it('stays well-formed XML with a large selection', () => {
		const distinct = Array.from({ length: 20 }, (_, i) => `kvv:210${i}:E:${i % 2 ? 'H' : 'R'}`);
		// Each ref twice: 40 entries must collapse to the 20 distinct refs.
		const xml = buildStopEventRequestXml({ ...base, lineRefs: [...distinct, ...distinct] });

		const params = paramsOf(xml);

		expect(params.LineFilter.Line).toHaveLength(20);
		expect(params.LineFilter.Exclude).toBe(false);
		expect(params.NumberOfResults).toBe(20);
	});
});
