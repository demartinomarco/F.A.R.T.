import { nowUtcIso } from './time';

export type StopEventType = 'departure' | 'arrival';

export function buildStopEventRequestXml(args: {
	requestorRef: string;
	stopPlaceRef: string; // e.g. de:08212:89
	depArrTime: string; // ISO datetime
	stopEventType: StopEventType;
	numberOfResults: number;
	// Internal TRIAS LineRefs to restrict the response to (include semantics).
	// TRIAS matches LineRefs, not published line names — the caller resolves
	// names to refs via the static line-ref dataset. Omit for no restriction.
	lineRefs?: string[];
}): string {
	const lineFilter = buildLineFilterXml(args.lineRefs);

	// Namespaces must match TRIAS expectations.
	return `<?xml version="1.0" encoding="UTF-8"?>
<Trias version="1.1"
  xmlns="http://www.vdv.de/trias"
  xmlns:siri="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ServiceRequest>
    <siri:RequestTimeStamp>${escapeXml(nowUtcIso())}</siri:RequestTimeStamp>
    <siri:RequestorRef>${escapeXml(args.requestorRef)}</siri:RequestorRef>
    <RequestPayload>
      <StopEventRequest>
        <Location>
          <LocationRef>
            <StopPlaceRef>${escapeXml(args.stopPlaceRef)}</StopPlaceRef>
          </LocationRef>
          <DepArrTime>${escapeXml(args.depArrTime)}</DepArrTime>
        </Location>
        <Params>
${lineFilter}          <NumberOfResults>${args.numberOfResults}</NumberOfResults>
          <StopEventType>${args.stopEventType}</StopEventType>
          <IncludeRealtimeData>true</IncludeRealtimeData>
          <IncludeOperatingDays>false</IncludeOperatingDays>
          <IncludePreviousCalls>false</IncludePreviousCalls>
          <IncludeOnwardCalls>false</IncludeOnwardCalls>
        </Params>
      </StopEventRequest>
    </RequestPayload>
  </ServiceRequest>
</Trias>`;
}

// Builds the <LineFilter> block for the given LineRefs, or '' when there is
// nothing to filter by. One <Line> element per ref; Exclude is sent
// explicitly because its XSD default is true — without an explicit
// <Exclude>false</Exclude> the filter would keep everything EXCEPT the
// selected lines.
function buildLineFilterXml(lineRefs: string[] | undefined): string {
	if (!lineRefs || lineRefs.length === 0) return '';

	// One <Line> per distinct ref; the union from the dataset is already
	// unique, this keeps the contract holding for direct callers too.
	const distinct = [...new Set(lineRefs)];
	const lines = distinct
		.map((ref) => `            <Line><LineRef>${escapeXml(ref)}</LineRef></Line>`)
		.join('\n');

	return `          <LineFilter>\n${lines}\n            <Exclude>false</Exclude>\n          </LineFilter>\n`;
}

function escapeXml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
