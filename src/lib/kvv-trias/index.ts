import type { ApiResponse, EventType } from './types';
import { stopsIdNameMap } from '@/server/stops-search.server';

import { getKvvTriasConfig } from './env';
import { nowBerlinIso } from './time';
import { buildStopEventRequestXml } from './xml';
import { postXml } from './http';
import { parseTriasXml, extractStopEventResults } from './parse';
import { mapStopEventResultToDeparture } from './map';
import { KvvTriasError } from './errors';

function isValidStationId(id: string): boolean {
	// Keep it permissive; TRIAS IDs look like "de:08212:89"
	return typeof id === 'string' && id.length >= 4 && id.length <= 64;
}

export async function getDepartures(
	stationId: string,
	eventType: EventType,
	limit = 20
): Promise<ApiResponse> {
	if (!isValidStationId(stationId)) {
		throw new KvvTriasError({
			code: 'BAD_PARAMS',
			status: 400,
			message: 'Invalid stationId'
		});
	}
	if (eventType !== 'dep' && eventType !== 'arr') {
		throw new KvvTriasError({
			code: 'BAD_PARAMS',
			status: 400,
			message: 'Invalid eventType (must be dep|arr)'
		});
	}
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new KvvTriasError({
			code: 'BAD_PARAMS',
			status: 400,
			message: 'Invalid limit (must be 1..100)'
		});
	}

	const station = stopsIdNameMap.get(stationId) ?? { place_name: '', stop_name: '' };
	const stationName = station.place_name
		? `${station.stop_name} (${station.place_name})`
		: station.stop_name;

	const { apiUrl, requestorRef } = getKvvTriasConfig();

	const xmlRequest = buildStopEventRequestXml({
		requestorRef,
		stopPlaceRef: stationId,
		depArrTime: nowBerlinIso(),
		stopEventType: eventType === 'dep' ? 'departure' : 'arrival',
		numberOfResults: limit
	});

	const xmlResponse = await postXml(apiUrl, xmlRequest);
	const parsed = parseTriasXml(xmlResponse);
	const results = extractStopEventResults(parsed);

	const departureList = results
		.map(mapStopEventResultToDeparture)
		.filter((x): x is NonNullable<typeof x> => x != null)
		.sort((a, b) => {
			const at = (a.realTime ?? a.plannedTime).getTime();
			const bt = (b.realTime ?? b.plannedTime).getTime();
			return at - bt;
		});

	return {
		stationName,
		cityName: station.place_name,
		departureList
	};
}
