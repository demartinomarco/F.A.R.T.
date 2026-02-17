import { nowUtcIso } from './time';

export type StopEventType = 'departure' | 'arrival';

export function buildStopEventRequestXml(args: {
	requestorRef: string;
	stopPlaceRef: string; // e.g. de:08212:89
	depArrTime: string; // ISO datetime
	stopEventType: StopEventType;
	numberOfResults: number;
}): string {
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
          <NumberOfResults>${args.numberOfResults}</NumberOfResults>
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

function escapeXml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
