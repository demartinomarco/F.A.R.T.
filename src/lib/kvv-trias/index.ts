import type { EventType, PlatformDepartures, StationDepartures } from './types';

import { getKvvTriasConfig } from './env';
import { nowBerlinIso } from './time';
import { buildStopEventRequestXml } from './xml';
import { postXml } from './http';
import { parseTriasXml, extractStopEventResults } from './parse';
import { mapStopEventResultToDeparture, consolidateWagons, type MappedDeparture } from './map';
import { KvvTriasError } from './errors';
import { stopsIdNameMap } from '@/server/stops';
import { getUpstreamDepartureResultCount } from '@/departure-limit';
import {
	dependencyHealth,
	classifyRequestFailure,
	classifyValidationFailure
} from '@/server/dependency-health';
import { logTriasFailure } from '@/server/logger';

function isValidStationId(id: string): boolean {
	// Keep it permissive; TRIAS IDs look like "de:08212:89"
	return typeof id === 'string' && id.length >= 4 && id.length <= 64;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function getDepartures(
	stationId: string,
	eventType: EventType,
	limit = 20
): Promise<StationDepartures> {
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
		// Over-fetch because merging below can drop entries. The final response
		// is sliced back to the requested limit.
		numberOfResults: getUpstreamDepartureResultCount(limit)
	});

	const startedAt = Date.now();
	dependencyHealth.recordAttempt(startedAt);

	let xmlResponse: string;
	try {
		xmlResponse = await postXml(apiUrl, xmlRequest);
	} catch (e) {
		const finishedAt = Date.now();
		const category = classifyRequestFailure(e);

		dependencyHealth.recordRequestFailure(finishedAt - startedAt, category, errorMessage(e));
		await logTriasFailure({
			stationId,
			eventType,
			limit,
			category,
			durationMs: finishedAt - startedAt,
			error: e
		});

		throw e;
	}

	const responseAt = Date.now();
	dependencyHealth.recordResponseReceived(responseAt, responseAt - startedAt);

	try {
		const parsed = parseTriasXml(xmlResponse);
		const results = extractStopEventResults(parsed);

		const mappedDepartures = results
			.map(mapStopEventResultToDeparture)
			.filter((x): x is NonNullable<typeof x> => x != null);

		// Merge duplicate wagon entries, then sort by effective departure time and
		// only keep the requested number of departures. Slicing happens before the
		// platform grouping so that the total (not just each platform) respects the
		// limit.
		const deduplicatedDepartures = consolidateWagons(mappedDepartures)
			.sort((a, b) => {
				const at = (a.departure.realTime ?? a.departure.plannedTime).getTime();
				const bt = (b.departure.realTime ?? b.departure.plannedTime).getTime();
				return at - bt;
			})
			.slice(0, limit);

		const result: StationDepartures = {
			stationName,
			cityName: station.place_name,
			platforms: groupByPlatform(deduplicatedDepartures)
		};

		dependencyHealth.recordValidationSuccess();
		return result;
	} catch (e) {
		const failure = classifyValidationFailure(e);
		const finishedAt = Date.now();

		dependencyHealth.recordValidationFailure(
			failure.category,
			failure.invalidResponse,
			errorMessage(e)
		);
		await logTriasFailure({
			stationId,
			eventType,
			limit,
			category: failure.category,
			durationMs: finishedAt - startedAt,
			error: e,
			rawResponse: xmlResponse
		});

		throw e;
	}
}

function groupByPlatform(mapped: MappedDeparture[]): PlatformDepartures[] {
	const platforms = new Map<string, PlatformDepartures>();

	for (const { platform, departure } of mapped) {
		const key = `${platform.type}:${platform.name}`;
		let group = platforms.get(key);

		if (!group) {
			group = {
				platform,
				departures: []
			};
			platforms.set(key, group);
		}

		group.departures.push(departure);
	}

	return [...platforms.values()];
}
