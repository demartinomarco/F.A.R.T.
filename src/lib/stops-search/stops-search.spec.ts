import { describe, it, beforeAll, vi, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { searchStops } from './index';
import type { GeoPoint } from './types';

// Example location: Karlsruhe Marktplatz
const KARLSRUHE_GEO: GeoPoint = { lat: 49.0069, lon: 8.4037 };

describe('Stops Search Quality Tests', () => {
	beforeAll(() => {
		const csvPath = resolve(process.cwd(), 'src/lib/assets/kvv_stops.csv');
		const realCsv = readFileSync(csvPath, 'utf-8');

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(realCsv)
			} as Response)
		);
	});

	// =========================================================================
	// 2. Result Quality & Accuracy Checks
	// =========================================================================
	describe('Result Quality & Accuracy', () => {
		const qualityCases = [
			{
				query: 'Hau',
				expectedMatch: 'Hauptbahnhof',
				expectedMatchId: 'de:08212:90'
			},
			{
				query: 'Hauptbah',
				expectedMatch: 'Hauptbahnhof',
				expectedMatchId: 'de:08212:90'
			},
			{
				query: 'Karlsruhe Hauptbahnhof',
				expectedMatch: 'Hauptbahnhof',
				expectedMatchId: 'de:08212:90'
			},
			{
				query: 'Hauptbahnhof Karlsruhe',
				expectedMatch: 'Hauptbahnhof',
				expectedMatchId: 'de:08212:90'
			},
			{
				query: 'durlacher tor',
				expectedMatch: 'Durlacher Tor',
				expectedMatchId: 'de:08212:1001'
			},
			{
				query: 'markplatz', // test for spelling errors
				expectedMatch: 'Marktplatz (Pyramide U)',
				expectedMatchId: 'de:08212:1011'
			}
		];

		it.each(qualityCases)(
			'returns expected result for query: "$query"',
			async ({ query, expectedMatch, expectedMatchId }) => {
				const results = await searchStops(query);

				expect(results.length, `Query "${query}" returned 0 results`).toBeGreaterThan(0);

				const isPresent = results.slice(0, 5).some((res) => res.value === expectedMatchId);

				expect(
					isPresent,
					`Expected ${expectedMatch} (${expectedMatchId}) in top 5 results for query "${query}"`
				).toBe(true);
			}
		);

		it('returns Schäferstraße (de:08212:3205) for all umlaut spelling variations', async () => {
			const SCHAEFERSTRASSE_GID = 'de:08212:3205';
			const variations = ['schäferstraße', 'schaeferstraße', 'schaferstraße'];

			for (const query of variations) {
				const results = await searchStops(query);

				expect(results.length, `No results returned for query "${query}"`).toBeGreaterThan(0);

				// Check that Schäferstraße GID is in top 5 results
				const match = results.slice(0, 5).find((res) => res.value === SCHAEFERSTRASSE_GID);

				expect(
					match,
					`Query "${query}" failed to return stop ${SCHAEFERSTRASSE_GID} (Schäferstraße) in top results`
				).toBeDefined();
			}
		});
	});
});
