import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The HTTP boundary is the only mock here: parse, map and the station lookup all
// run for real against a verbatim TRIAS capture, so this covers the wiring of
// the warnings feature end to end, not just its parts.
const mocks = vi.hoisted(() => ({ postXml: vi.fn() }));

vi.mock('./http', () => ({ postXml: mocks.postXml }));
vi.mock('./env', () => ({
	getKvvTriasConfig: () => ({
		apiUrl: 'https://trias.example.test',
		requestorRef: 'test-requestor'
	})
}));

import { getDepartures } from './index';

function capture(name: string): string {
	return readFileSync(
		new URL(`../../../tests/fixtures/trias/${name}.xml`, import.meta.url),
		'utf8'
	);
}

const rowsOf = (result: Awaited<ReturnType<typeof getDepartures>>) =>
	result.platforms.flatMap((platform) => platform.departures);

// The capture is frozen, but two of its situations end in early December 2026,
// so the assertions below only lean on the one whose validity runs to 2027.
const DURABLE_SITUATION = '100004572_KVV_ICSKVV';

describe('getDepartures over a real capture: Karlsruhe Ebertstraße', () => {
	beforeEach(() => {
		mocks.postXml.mockReset().mockResolvedValue(capture('karlsruhe-ebertstrasse'));
	});

	it('delivers the board with its row warnings, cancellation and skipped stop', async () => {
		const result = await getDepartures('de:08212:91', 'dep', 20);
		const rows = rowsOf(result);

		expect(rows.length).toBeGreaterThan(0);
		expect(rows.length).toBeLessThanOrEqual(20);
		expect(
			rows.some((row) => row.situations.some((s) => s.situationNumber === DURABLE_SITUATION))
		).toBe(true);
		expect(rows.some((row) => row.cancelled)).toBe(true);
		expect(rows.some((row) => row.notServiced)).toBe(true);
	});

	it('leaves the banner empty because no situation names this stop', async () => {
		const result = await getDepartures('de:08212:91', 'dep', 20);

		expect(result.stationSituations).toEqual([]);
		expect(result.errorMessages).toEqual([]);
	});

	it('drops a situation whose validity period has passed, without dropping rides', async () => {
		const endTime = '2027-03-08T02:00:59Z';
		const xml = capture('karlsruhe-ebertstrasse');
		// Guard: without this the replacement below could silently be a no-op.
		expect(xml).toContain(endTime);
		mocks.postXml.mockResolvedValue(xml.replace(endTime, '2020-01-01T00:00:00Z'));

		const result = await getDepartures('de:08212:91', 'dep', 20);
		const seen = new Set([
			...result.stationSituations.map((s) => s.situationNumber),
			...rowsOf(result).flatMap((row) => row.situations.map((s) => s.situationNumber))
		]);

		expect(seen.has(DURABLE_SITUATION)).toBe(false);
		expect(rowsOf(result).length).toBeGreaterThan(0);
	});
});

describe('getDepartures over a real capture: Baden-Baden Festspielhaus', () => {
	beforeEach(() => {
		mocks.postXml.mockReset().mockResolvedValue(capture('baden-baden-festspielhaus'));
	});

	it('lifts the situations that name this stop into the banner', async () => {
		const result = await getDepartures('de:08211:32389', 'dep', 20);

		// One of the two ends in December 2026, so assert membership, not a count.
		// The other carries KVV's open-ended sentinel (year 2500) and stays.
		expect(result.stationSituations.map((s) => s.situationNumber)).toEqual(
			expect.arrayContaining(['100004294_KVV_ICSKVV'])
		);
	});

	it('never repeats a banner situation on a departure row', async () => {
		const result = await getDepartures('de:08211:32389', 'dep', 20);
		const banner = new Set(result.stationSituations.map((s) => s.situationNumber));
		const rows = rowsOf(result);

		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			for (const situation of row.situations) {
				expect(banner.has(situation.situationNumber)).toBe(false);
			}
		}
	});
});

describe('getDepartures over a real capture: a stop the feed does not answer', () => {
	beforeEach(() => {
		mocks.postXml.mockReset().mockResolvedValue(capture('unknown-stop'));
	});

	it('returns an empty board plus the machine message the banner localizes', async () => {
		const result = await getDepartures('de:08212:9999999', 'dep', 20);

		expect(result.platforms).toEqual([]);
		expect(result.stationSituations).toEqual([]);
		expect(result.errorMessages).toEqual([{ code: '-4030', text: 'STOPEVENT_NOEVENTFOUND' }]);
		expect(result.stationName).toBe('');
	});
});
