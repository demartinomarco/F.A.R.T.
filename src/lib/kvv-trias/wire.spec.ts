import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { toWireDepartures, wireToStationDepartures } from './wire';
import { parseTriasXml, extractStopEventResults, extractSituationNodes } from './parse';
import { mapStopEventResultToDeparture, consolidateWagons, mapSituationNode } from './map';
import { PlatformType, type Departure, type Disruption, type StationDepartures } from './types';

function baseDeparture(overrides: Partial<Departure> = {}): Departure {
	return {
		lineName: 'S5',
		direction: ['Bretten'],
		plannedTime: new Date('2026-11-27T14:20:00.000Z'),
		vehicleType: 'rail',
		realTime: null,
		wagonCount: 2,
		cancelled: false,
		situations: [],
		notServiced: false,
		...overrides
	};
}

function situation(number: string, overrides: Partial<Disruption> = {}): Disruption {
	return {
		situationNumber: number,
		summary: `summary ${number}`,
		description: `description ${number}`,
		detail: null,
		priority: 2,
		scopeType: 'line',
		validFrom: new Date('2026-11-27T08:00:00.000Z'),
		validUntil: new Date('2026-11-28T08:00:00.000Z'),
		affectedStopIds: [],
		...overrides
	};
}

function station(platforms: Departure[][]): StationDepartures {
	return {
		stationName: 'Karlsruhe Hauptbahnhof',
		cityName: 'Karlsruhe',
		platforms: platforms.map((departures, index) => ({
			platform: { name: `Gleis ${index + 1}`, type: PlatformType.Rail },
			departures
		})),
		errorMessages: [],
		stationSituations: []
	};
}

describe('toWireDepartures', () => {
	it('delivers each situation text once and references it by number', () => {
		// The same network warning applies to most of a board; repeating its text
		// per departure is what the dictionary exists to avoid.
		const shared = situation('KVV_SHARED');
		const other = situation('KVV_OTHER');
		const wire = toWireDepartures(
			station([
				[
					baseDeparture({ lineName: 'S1', situations: [shared] }),
					baseDeparture({ lineName: 'S2', situations: [shared] }),
					baseDeparture({ lineName: 'S4', situations: [shared, other] })
				]
			])
		);

		expect(wire.situations.map((s) => s.situationNumber)).toEqual(['KVV_SHARED', 'KVV_OTHER']);
		expect(wire.platforms[0].departures.map((d) => d.situationRefs)).toEqual([
			['KVV_SHARED'],
			['KVV_SHARED'],
			['KVV_SHARED', 'KVV_OTHER']
		]);
		// Departures carry refs only, never the texts.
		for (const d of wire.platforms[0].departures) {
			expect(d).not.toHaveProperty('situations');
		}
	});

	it('is smaller than repeating the text on every departure', () => {
		const long = situation('KVV_LONG', { detail: 'x'.repeat(500) });
		const board = station([
			Array.from({ length: 12 }, (_, i) => baseDeparture({ lineName: `L${i}`, situations: [long] }))
		]);

		const wireSize = JSON.stringify(toWireDepartures(board)).length;
		const naiveSize = JSON.stringify(board).length;

		expect(wireSize).toBeLessThan(naiveSize);
	});

	it('keeps every departure field that the row renders', () => {
		// A field missing here is silently absent on the client: the cancelled
		// flag once was, which made cancelled services render as normal ones.
		const wire = toWireDepartures(
			station([
				[
					baseDeparture({
						lineName: '27',
						vehicleType: 'bus',
						realTime: new Date('2026-11-27T14:23:00.000Z'),
						cancelled: true,
						notServiced: true,
						wagonCount: 1
					})
				]
			])
		);

		expect(wire.platforms[0].departures[0]).toMatchObject({
			lineName: '27',
			direction: ['Bretten'],
			vehicleType: 'bus',
			wagonCount: 1,
			cancelled: true,
			notServiced: true,
			situationRefs: []
		});
		expect(wire.platforms[0].departures[0].plannedTime).toBeInstanceOf(Date);
		expect(wire.platforms[0].departures[0].realTime).toBeInstanceOf(Date);
	});
});

describe('wireToStationDepartures', () => {
	it('round-trips a board without losing anything the UI reads', () => {
		const shared = situation('KVV_SHARED');
		const original = station([
			[
				baseDeparture({ situations: [shared], realTime: new Date('2026-11-27T14:25:00.000Z') }),
				baseDeparture({ lineName: '6', cancelled: true, notServiced: true, situations: [shared] }),
				baseDeparture({ lineName: 'N6', wagonCount: 1, situations: [] })
			]
		]);
		original.errorMessages = [{ code: '-4030', text: 'STOPEVENT_NOEVENTFOUND' }];
		original.stationSituations = [situation('KVV_STATION')];

		const revived = wireToStationDepartures(toWireDepartures(original));

		expect(revived).toEqual(original);
	});

	it('revives the wire dates back into Date objects', () => {
		const wire = JSON.parse(
			JSON.stringify(toWireDepartures(station([[baseDeparture()]])))
		) as ReturnType<typeof toWireDepartures>;

		const revived = wireToStationDepartures(wire);
		const departure = revived.platforms[0].departures[0];

		expect(departure.plannedTime).toBeInstanceOf(Date);
		expect(departure.realTime).toBeNull();
		expect(departure.plannedTime.toISOString()).toBe('2026-11-27T14:20:00.000Z');

		const withRealTime = wireToStationDepartures(
			JSON.parse(
				JSON.stringify(
					toWireDepartures(
						station([[baseDeparture({ realTime: new Date('2026-11-27T14:31:00.000Z') })]])
					)
				)
			) as ReturnType<typeof toWireDepartures>
		);
		expect(withRealTime.platforms[0].departures[0].realTime).toBeInstanceOf(Date);
	});

	it('drops a reference that points at a situation nobody delivered', () => {
		// A dangling SituationNumber must not become undefined and then crash the
		// row renderer.
		const wire = toWireDepartures(station([[baseDeparture({ situations: [situation('KVV_A')] })]]));
		wire.situations = [];

		const revived = wireToStationDepartures(wire);
		expect(revived.platforms[0].departures[0].situations).toEqual([]);
	});

	it('falls back to safe defaults for a payload that is missing fields', () => {
		const revived = wireToStationDepartures({
			platforms: [{ platform: { name: '1', type: 'rail' } }],
			situations: []
		} as unknown as ReturnType<typeof toWireDepartures>);

		expect(revived.stationName).toBe('');
		expect(revived.cityName).toBe('');
		expect(revived.errorMessages).toEqual([]);
		expect(revived.stationSituations).toEqual([]);
		expect(revived.platforms[0].departures).toEqual([]);
	});
});

describe('wire round-trip over a real TRIAS capture', () => {
	it('survives serialize → parse for a board with live situations', () => {
		const xml = readFileSync(
			new URL('../../../tests/fixtures/trias/karlsruhe-ebertstrasse.xml', import.meta.url),
			'utf8'
		);
		const doc = parseTriasXml(xml);
		const situations = extractSituationNodes(doc)
			.map(mapSituationNode)
			.filter((s): s is Disruption => !!s);
		const byNumber = new Map(situations.map((s) => [s.situationNumber, s]));
		const departures = consolidateWagons(
			extractStopEventResults(doc)
				.map((r) => mapStopEventResultToDeparture(r, byNumber))
				.filter((d): d is NonNullable<typeof d> => !!d)
		);
		const board: StationDepartures = {
			stationName: 'Karlsruhe Ebertstraße',
			cityName: 'Karlsruhe',
			platforms: [
				{
					platform: { name: '1', type: PlatformType.Rail },
					departures: departures.map((d) => d.departure)
				}
			],
			errorMessages: [],
			stationSituations: []
		};

		const revived = wireToStationDepartures(toWireDepartures(board));
		const originalRows = board.platforms[0].departures;
		const revivedRows = revived.platforms[0].departures;

		expect(revivedRows).toHaveLength(originalRows.length);
		expect(revived).toEqual(board);

		// The capture really does exercise the interesting parts: warnings, a
		// cancelled ride and a skipped stop.
		expect(originalRows.some((d) => d.situations.length > 0)).toBe(true);
		expect(originalRows.some((d) => d.cancelled)).toBe(true);
		expect(originalRows.some((d) => d.notServiced)).toBe(true);
	});
});
