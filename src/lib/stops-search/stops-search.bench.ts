import { beforeAll, expect, test } from 'vitest';
import { searchStops } from './index';
import type { GeoPoint } from './types';

const KARLSRUHE_GEO: GeoPoint = {
	lat: 49.0069,
	lon: 8.4037
};

const ITERATIONS = 100;

beforeAll(async () => {
	// Warmup run to ensure any lazy initialization is done
	await searchStops('warmup', KARLSRUHE_GEO);
});

async function measure(name: string, fn: () => Promise<void>) {
	// Extra warmup iteration for the specific query
	await fn();

	const times: number[] = [];

	for (let i = 0; i < ITERATIONS; i++) {
		const start = performance.now();
		await fn();
		times.push(performance.now() - start);
	}

	times.sort((a, b) => a - b);
	const mean = times.reduce((a, b) => a + b, 0) / times.length;

	// This will print a beautiful table in your terminal console
	console.log(
		`  ├─ ${name}\n` +
			`  │  Avg: ${mean.toFixed(3)}ms | Min: ${times[0].toFixed(3)}ms | Max: ${times[times.length - 1].toFixed(3)}ms (${ITERATIONS} iterations)`
	);

	return { mean };
}

test('Stops Search Performance SLAs', async () => {
	const emptyQuery = await measure('Empty Query + Geo', async () => {
		await searchStops('', KARLSRUHE_GEO);
	});
	expect(emptyQuery.mean).toBeLessThan(4);

	const threeChars = await measure('3 Chars + Geo ("Hau")', async () => {
		await searchStops('Hau', KARLSRUHE_GEO);
	});
	expect(threeChars.mean).toBeLessThan(2);

	const eightChars = await measure('8 Chars + Geo ("Hauptbah")', async () => {
		await searchStops('Hauptbah', KARLSRUHE_GEO);
	});
	expect(eightChars.mean).toBeLessThan(2);

	const longQuery = await measure('24 Chars ("Durlacher Tor Campus Süd")', async () => {
		await searchStops('Durlacher Tor Campus Süd');
	});
	expect(longQuery.mean).toBeLessThan(2);
});
