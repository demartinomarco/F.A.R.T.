import type {
	Departure,
	Disruption,
	Platform,
	PlatformDepartures,
	StationDepartures
} from './types';

/**
 * Wire format for /api/departures: every situation text (summary/detail) is
 * delivered only once, in a top-level dictionary; departures reference it by
 * situationNumber. Without this, the same situation text would be repeated on
 * every departure that references it (easily >10x the necessary size).
 */
export type WireDeparture = Omit<Departure, 'situations'> & {
	situationRefs: string[];
};

export type WirePlatformDepartures = {
	platform: Platform;
	departures: WireDeparture[];
};

export type WireStationDepartures = Omit<StationDepartures, 'platforms'> & {
	/** All situations referenced by any departure below; deduplicated. */
	situations: Disruption[];
	platforms: WirePlatformDepartures[];
};

export function toWireDepartures(data: StationDepartures): WireStationDepartures {
	const byNumber = new Map<string, Disruption>();

	const platforms: WirePlatformDepartures[] = (data.platforms ?? []).map(
		(p: PlatformDepartures) => ({
			platform: p.platform,
			departures: p.departures.map((d) => {
				const situations = d.situations ?? [];
				for (const s of situations) {
					if (s?.situationNumber) byNumber.set(s.situationNumber, s);
				}

				return {
					lineName: d.lineName,
					direction: d.direction,
					plannedTime: d.plannedTime,
					vehicleType: d.vehicleType,
					realTime: d.realTime,
					wagonCount: d.wagonCount,
					notServiced: d.notServiced ?? false,
					situationRefs: situations.map((s) => s?.situationNumber).filter((n): n is string => !!n)
				};
			})
		})
	);

	return {
		stationName: data.stationName,
		cityName: data.cityName,
		errorMessages: data.errorMessages ?? [],
		stationSituations: data.stationSituations ?? [],
		// Map preserves first-insertion order → deterministic output.
		situations: [...byNumber.values()],
		platforms
	};
}

/**
 * Client-side inverse of toWireDepartures(): re-attaches the referenced
 * situation objects to the departures and revives ISO date strings.
 * Defensive on purpose: missing/null fields become safe defaults.
 */
export function wireToStationDepartures(wire: WireStationDepartures): StationDepartures {
	const byNumber = new Map<string, Disruption>();
	for (const s of wire.situations ?? []) {
		if (s?.situationNumber) byNumber.set(s.situationNumber, reviveDisruptionDates(s));
	}

	return {
		stationName: wire.stationName ?? '',
		cityName: wire.cityName ?? '',
		errorMessages: wire.errorMessages ?? [],
		stationSituations: (wire.stationSituations ?? []).map(reviveDisruptionDates),
		platforms: (wire.platforms ?? []).map((p) => ({
			platform: p.platform,
			departures: (p.departures ?? []).map((d): Departure => ({
				lineName: d.lineName ?? '',
				direction: d.direction ?? [],
				plannedTime: new Date(d.plannedTime),
				vehicleType: d.vehicleType ?? '',
				realTime: d.realTime ? new Date(d.realTime) : null,
				wagonCount: d.wagonCount ?? 1,
				notServiced: !!d.notServiced,
				situations: (d.situationRefs ?? [])
					.map((ref) => byNumber.get(ref))
					// A ref that points nowhere is dropped instead of crashing the UI.
					.filter((s): s is Disruption => s != null)
			}))
		}))
	};
}

function reviveDisruptionDates(s: Disruption): Disruption {
	return {
		...s,
		validFrom: s.validFrom ? new Date(s.validFrom) : null,
		validUntil: s.validUntil ? new Date(s.validUntil) : null
	};
}
