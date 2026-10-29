import type { Disruption, StationDepartures, StationMessage } from './types';

export type StationBanner = {
	/** Machine messages from TRIAS, e.g. "stop not served" (-4030). */
	messages: StationMessage[];
	/** Station-level situations (stop closures, construction work). */
	situations: Disruption[];
};

/**
 * Collects everything that belongs into the station-level banner, sorted by
 * importance. Defensive: tolerates payloads that (still) lack the new fields.
 */
export function getStationBanner(departures: StationDepartures | null): StationBanner {
	if (!departures) return { messages: [], situations: [] };

	const messages: StationMessage[] = [];
	const seenMessages = new Set<string>();
	for (const message of departures.errorMessages ?? []) {
		if (!message?.text) continue;
		if (seenMessages.has(message.text)) continue;
		seenMessages.add(message.text);
		messages.push(message);
	}

	const situations: Disruption[] = [];
	const seenSituations = new Set<string>();
	for (const situation of departures.stationSituations ?? []) {
		// Without any text, there is nothing to show.
		if (!situation?.summary && !situation?.description && !situation?.detail) continue;
		if (seenSituations.has(situation.situationNumber)) continue;
		seenSituations.add(situation.situationNumber);
		situations.push(situation);
	}

	// Lower priority value = more severe; unknown priority sorts last.
	situations.sort((a, b) => {
		const pa = a.priority ?? Number.POSITIVE_INFINITY;
		const pb = b.priority ?? Number.POSITIVE_INFINITY;
		if (pa !== pb) return pa - pb;

		return (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0);
	});

	return { messages, situations };
}
