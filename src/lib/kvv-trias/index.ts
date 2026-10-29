import type {
	Disruption,
	EventType,
	PlatformDepartures,
	StationDepartures,
	StationMessage
} from './types';

import { getKvvTriasConfig } from './env';
import { nowBerlinIso } from './time';
import { buildStopEventRequestXml } from './xml';
import { postXml } from './http';
import {
	parseTriasXml,
	extractStopEventResults,
	extractSituationNodes,
	extractErrorMessages
} from './parse';
import {
	mapStopEventResultToDeparture,
	consolidateWagons,
	mapSituationNode,
	mapErrorMessageNode,
	type MappedDeparture
} from './map';
import { KvvTriasError } from './errors';
import { stopsIdNameMap } from '@/server/stops';

function isValidStationId(id: string): boolean {
	// Keep it permissive; TRIAS IDs look like "de:08212:89"
	return typeof id === 'string' && id.length >= 4 && id.length <= 64;
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
		numberOfResults: limit
	});

	const xmlResponse = await postXml(apiUrl, xmlRequest);
	const parsed = parseTriasXml(xmlResponse);
	const results = extractStopEventResults(parsed);

	// Warnings & info messages — parsing must never break the board.
	const disruptions = mapDisruptions(parsed);
	const situationsByNumber = new Map(disruptions.map((s) => [s.situationNumber, s]));
	const errorMessages = mapErrorMessages(parsed);

	const mappedDepartures = results
		.map((r) => mapStopEventResultToDeparture(r, situationsByNumber))
		.filter((x): x is NonNullable<typeof x> => x != null);

	// Merge duplicate wagon entries, then sort by effective departure time.
	const deduplicatedDepartures = consolidateWagons(mappedDepartures).sort((a, b) => {
		const at = (a.departure.realTime ?? a.departure.plannedTime).getTime();
		const bt = (b.departure.realTime ?? b.departure.plannedTime).getTime();
		return at - bt;
	});

	// Situations whose affected-stop list mentions this station are station-level
	// disruptions: they belong into the banner, not into single departure rows.
	const stationSituations = disruptions.filter((s) => isStationSituation(s, stationId));
	const stationSituationsByNumber = new Set(stationSituations.map((s) => s.situationNumber));

	// Everything the station banner already shows is not repeated per departure.
	for (const { departure } of deduplicatedDepartures) {
		departure.situations = departure.situations.filter(
			(s) => !stationSituationsByNumber.has(s.situationNumber)
		);
	}

	return {
		stationName,
		cityName: station.place_name,
		platforms: groupByPlatform(deduplicatedDepartures),
		errorMessages,
		stationSituations
	};
}

/**
 * Normalizes all PtSituation nodes, silently dropping malformed entries.
 * Deliberately keeps situations even without a validity period.
 */
function mapDisruptions(doc: unknown): Disruption[] {
	const disruptions: Disruption[] = [];
	const seen = new Set<string>();

	for (const node of extractSituationNodes(doc)) {
		try {
			const situation = mapSituationNode(node);
			if (!situation) continue;
			if (seen.has(situation.situationNumber)) continue;
			seen.add(situation.situationNumber);
			// Drop only when definitively expired (provider may keep them cached).
			if (situation.validUntil && situation.validUntil.getTime() < Date.now()) continue;

			disruptions.push(situation);
		} catch {
			// Never let one broken situation take down the departure board.
		}
	}

	return disruptions;
}

function mapErrorMessages(doc: unknown): StationMessage[] {
	const messages: StationMessage[] = [];
	const seen = new Set<string>();

	for (const node of extractErrorMessages(doc)) {
		try {
			const message = mapErrorMessageNode(node);
			if (!message) continue;
			const key = `${message.code}:${message.text}`;
			if (seen.has(key)) continue;
			seen.add(key);
			messages.push(message);
		} catch {
			// Same policy as mapDisruptions.
		}
	}

	return messages;
}

/**
 * A situation is station-level when its affected-stop list contains this stop
 * (exact match, or the ref with additional segments after the stop id).
 */
function isStationSituation(s: Disruption, stationId: string): boolean {
	return s.affectedStopIds.some((ref) => ref === stationId || ref.startsWith(`${stationId}:`));
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
