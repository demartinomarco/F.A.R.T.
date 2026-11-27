import { describe, it, expect } from 'vitest';
import { getStationBanner } from './disruptions';
import type { Disruption, StationDepartures } from './types';

function situation(number: string, overrides: Partial<Disruption> = {}): Disruption {
	return {
		situationNumber: number,
		summary: `summary ${number}`,
		description: null,
		detail: null,
		priority: 2,
		scopeType: 'stopPoint',
		validFrom: new Date('2026-11-27T08:00:00.000Z'),
		validUntil: new Date('2026-11-28T08:00:00.000Z'),
		affectedStopIds: ['de:08212:89'],
		...overrides
	};
}

function board(overrides: Partial<StationDepartures> = {}): StationDepartures {
	return {
		stationName: 'Karlsruhe Hauptbahnhof',
		cityName: 'Karlsruhe',
		platforms: [],
		errorMessages: [],
		stationSituations: [],
		...overrides
	};
}

describe('getStationBanner', () => {
	it('returns an empty banner when there is nothing to show', () => {
		expect(getStationBanner(null)).toEqual({ messages: [], situations: [] });
		expect(getStationBanner(board())).toEqual({ messages: [], situations: [] });
	});

	it('carries machine messages through, deduplicated by text', () => {
		// TRIAS repeats the same message per requested mode; two identical red
		// chips above the board is one too many.
		const banner = getStationBanner(
			board({
				errorMessages: [
					{ code: '-4030', text: 'STOPEVENT_LOCATIONUNSERVED' },
					{ code: '-4030', text: 'STOPEVENT_LOCATIONUNSERVED' },
					{ code: '-4031', text: 'SOMETHING ELSE' }
				]
			})
		);

		expect(banner.messages).toEqual([
			{ code: '-4030', text: 'STOPEVENT_LOCATIONUNSERVED' },
			{ code: '-4031', text: 'SOMETHING ELSE' }
		]);
	});

	it('drops messages without text and situations without any wording', () => {
		const banner = getStationBanner(
			board({
				errorMessages: [
					{ code: '-4030', text: '' },
					{ code: '-1', text: 'kept' }
				],
				stationSituations: [
					situation('EMPTY', { summary: '', description: null, detail: null }),
					situation('KEEP', { summary: '', description: 'only a description' })
				]
			})
		);

		expect(banner.messages).toEqual([{ code: '-1', text: 'kept' }]);
		expect(banner.situations.map((s) => s.situationNumber)).toEqual(['KEEP']);
	});

	it('deduplicates situations by number', () => {
		const banner = getStationBanner(
			board({
				stationSituations: [
					situation('DUP', { summary: 'first copy' }),
					situation('DUP', { summary: 'second copy' })
				]
			})
		);

		expect(banner.situations).toHaveLength(1);
		expect(banner.situations[0].summary).toBe('first copy');
	});

	it('shows the most severe situation first and puts unknown priority last', () => {
		// TRIAS priority is inverted: a lower number is more urgent, and plenty of
		// situations arrive without one at all.
		const banner = getStationBanner(
			board({
				stationSituations: [
					situation('unknown1', { priority: null }),
					situation('minor', { priority: 5 }),
					situation('unknown2', { priority: null }),
					situation('severe', { priority: 1 })
				]
			})
		);

		expect(banner.situations.map((s) => s.situationNumber)).toEqual([
			'severe',
			'minor',
			'unknown1',
			'unknown2'
		]);
	});

	it('breaks a priority tie by the newest situation', () => {
		const banner = getStationBanner(
			board({
				stationSituations: [
					situation('older', { priority: 3, validFrom: new Date('2026-11-01T00:00:00.000Z') }),
					situation('newer', { priority: 3, validFrom: new Date('2026-11-20T00:00:00.000Z') }),
					situation('no-window', { priority: 3, validFrom: null })
				]
			})
		);

		expect(banner.situations.map((s) => s.situationNumber)).toEqual([
			'newer',
			'older',
			'no-window'
		]);
	});

	it('tolerates a payload that predates the new fields', () => {
		// Older cached /api/departures bodies have neither errorMessages nor
		// stationSituations, and the banner must not be the thing that breaks.
		const legacy = {
			stationName: 'X',
			cityName: 'Y',
			platforms: []
		} as unknown as StationDepartures;

		expect(getStationBanner(legacy)).toEqual({ messages: [], situations: [] });
	});
});
