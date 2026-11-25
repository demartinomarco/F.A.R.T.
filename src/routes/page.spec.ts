import { describe, expect, it } from 'vitest';
import {
	_getDepartureKey,
	_getPlatformKey,
	_extractLineOptions,
	_fetchDepartures,
	_fetchStopLines,
	_boardView,
	_mergeLineOptions,
	_lineFilterOptions,
	_filterByLineName,
	_filterDepartures,
	_mergePlatformNames,
	_serializeQuery
} from './+page';
import { LINES_PARAM, parseLinesParam, serializeLines } from '@/lines-param';
import {
	PlatformType,
	type Departure,
	type PlatformDepartures,
	type StationDepartures
} from '@/kvv-trias/types';

function makeDeparture(overrides: Partial<Departure> = {}): Departure {
	return {
		lineName: 'S5',
		direction: ['Pforzheim Hauptbahnhof'],
		plannedTime: new Date('2026-10-30T14:20:00.000Z'),
		vehicleType: 'rail',
		realTime: null,
		wagonCount: 1,
		cancelled: false,
		...overrides
	};
}

const platform = { type: PlatformType.Rail, name: '4' };

describe('list keys', () => {
	it('keeps keys unique when identical departures reach the page', () => {
		const departures = [makeDeparture(), makeDeparture()];
		const keys = departures.map((departure, index) => _getDepartureKey(departure, platform, index));

		expect(new Set(keys).size).toBe(2);
	});

	it('keeps keys unique when identical platforms reach the page', () => {
		const platforms: PlatformDepartures[] = [
			{ platform: { ...platform }, departures: [] },
			{ platform: { ...platform }, departures: [] }
		];
		const keys = platforms.map((platformDepartures, index) =>
			_getPlatformKey(platformDepartures, index)
		);

		expect(new Set(keys).size).toBe(2);
	});
});

function makePlatform(
	name: string,
	departures: Departure[],
	type: PlatformType = PlatformType.Rail
): PlatformDepartures {
	return { platform: { name, type }, departures };
}

function makeStation(platforms: PlatformDepartures[]): StationDepartures {
	return { stationName: 'Hauptbahnhof', cityName: 'Karlsruhe', platforms };
}

describe('line options', () => {
	it('deduplicates line names and prefers a non-bus representative', () => {
		const departures = makeStation([
			makePlatform(
				'G',
				[makeDeparture({ lineName: '1', vehicleType: 'Stadtbus' })],
				PlatformType.Bus
			),
			makePlatform('4', [
				makeDeparture({ lineName: '1', vehicleType: 'tram' }),
				makeDeparture({ lineName: 'S1' })
			])
		]);

		const options = _extractLineOptions(departures);

		expect(options).toEqual([
			{ name: '1', vehicleType: 'tram' },
			{ name: 'S1', vehicleType: 'rail' }
		]);
	});

	it('sorts by name and moves bus lines after tram and rail lines', () => {
		const departures = makeStation([
			makePlatform('1', [
				makeDeparture({ lineName: '2' }),
				makeDeparture({ lineName: '27', vehicleType: 'bus' }),
				makeDeparture({ lineName: '10' }),
				makeDeparture({ lineName: 'S1' })
			])
		]);

		expect(_extractLineOptions(departures).map((option) => option.name)).toEqual([
			'2',
			'10',
			'S1',
			'27'
		]);
	});

	it('moves rail replacements into the bus group', () => {
		// The feed reports `SEV S4` as the replaced line's mode (`rail`), so the
		// name is what groups it with the buses rather than with the trains.
		const departures = makeStation([
			makePlatform('1', [
				makeDeparture({ lineName: 'SEV S4', vehicleType: 'rail' }),
				makeDeparture({ lineName: 'S4' }),
				makeDeparture({ lineName: '27', vehicleType: 'bus' }),
				makeDeparture({ lineName: '2' })
			])
		]);

		expect(_extractLineOptions(departures).map((option) => option.name)).toEqual([
			'2',
			'S4',
			'27',
			'SEV S4'
		]);
	});

	it('ignores blank line names and returns nothing without departures', () => {
		expect(_extractLineOptions(null)).toEqual([]);

		const departures = makeStation([makePlatform('4', [makeDeparture({ lineName: '  ' })])]);

		expect(_extractLineOptions(departures)).toEqual([]);
	});
});

describe('merging static and live line options', () => {
	const staticOptions = [
		{ name: '1', vehicleType: 'tram' },
		{ name: 'S1', vehicleType: 'rail' },
		{ name: 'S41', vehicleType: 'rail' }
	];
	const liveOptions = [
		{ name: 'S1', vehicleType: 'rail' },
		{ name: '27', vehicleType: 'bus' }
	];

	it('adds lines from the static list that are not in the live window', () => {
		const merged = _mergeLineOptions(staticOptions, liveOptions);

		expect(merged.map((option) => option.name)).toEqual(['1', 'S1', 'S41', '27']);
	});

	it('keeps live lines the static list does not know (detours, new services)', () => {
		const merged = _mergeLineOptions([{ name: '1', vehicleType: 'tram' }], liveOptions);

		expect(merged.map((option) => option.name)).toEqual(['1', 'S1', '27']);
	});

	it('deduplicates shared names and prefers the non-bus representative', () => {
		const merged = _mergeLineOptions(
			[{ name: '1', vehicleType: 'bus' }],
			[{ name: '1', vehicleType: 'tram' }]
		);

		expect(merged).toEqual([{ name: '1', vehicleType: 'tram' }]);
	});

	it('keeps the bus-last order across both sources', () => {
		const merged = _mergeLineOptions(
			[
				{ name: '7', vehicleType: 'bus' },
				{ name: 'S2', vehicleType: 'rail' }
			],
			[{ name: '10', vehicleType: 'tram' }]
		);

		expect(merged.map((option) => option.name)).toEqual(['10', 'S2', '7']);
	});

	it('groups a replacement bus with the buses even when both sources call it rail', () => {
		// src/lib/assets/stop-lines.json mirrors the feed, so it lists `SEV S4`
		// as rail too; neither side can group it, the name has to.
		const merged = _mergeLineOptions(
			[{ name: 'SEV S4', vehicleType: 'rail' }],
			[
				{ name: 'S4', vehicleType: 'rail' },
				{ name: '47', vehicleType: 'bus' }
			]
		);

		expect(merged.map((option) => option.name)).toEqual(['S4', '47', 'SEV S4']);
	});

	it('tolerates an empty side', () => {
		expect(_mergeLineOptions([], liveOptions).map((option) => option.name)).toEqual(['S1', '27']);
		expect(_mergeLineOptions(staticOptions, []).map((option) => option.name)).toEqual([
			'1',
			'S1',
			'S41'
		]);
	});

	it('sorts line names: leading numbers as numbers, prefix lines grouped, buses last', () => {
		const merged = _mergeLineOptions(
			[
				{ name: '18', vehicleType: 'tram' },
				{ name: '2', vehicleType: 'tram' },
				{ name: '1', vehicleType: 'tram' },
				{ name: '17', vehicleType: 'tram' },
				{ name: 'E', vehicleType: 'tram' },
				{ name: 'S11', vehicleType: 'rail' },
				{ name: 'S7', vehicleType: 'rail' },
				{ name: 'S1', vehicleType: 'rail' },
				{ name: 'S5', vehicleType: 'rail' },
				{ name: 'S51', vehicleType: 'rail' }
			],
			[{ name: '47', vehicleType: 'bus' }]
		);

		expect(merged.map((option) => option.name)).toEqual([
			'1',
			'2',
			'17',
			'18',
			'E',
			'S1',
			'S11',
			'S5',
			'S51',
			'S7',
			'47'
		]);
	});
});

describe('line filter options (selected lines without current departures)', () => {
	const options = [
		{ name: '10', vehicleType: 'tram' },
		{ name: '2', vehicleType: 'tram' },
		{ name: 'S1', vehicleType: 'rail' }
	];

	it('adds a badge for selected lines that are not in the current data', () => {
		const merged = _lineFilterOptions(options, ['S41']);

		expect(merged.map((option) => option.name)).toEqual(['2', '10', 'S1', 'S41']);
		expect(merged.find((option) => option.name === 'S41')?.vehicleType).toBe('');
	});

	it('does not duplicate lines that are already available', () => {
		const merged = _lineFilterOptions(options, ['S1', 'S1']);

		expect(merged.map((option) => option.name)).toEqual(['2', '10', 'S1']);
	});

	it('keeps the bus-last order for ghost lines that are not buses', () => {
		const merged = _lineFilterOptions(
			[
				{ name: 'S1', vehicleType: 'rail' },
				{ name: '47', vehicleType: 'bus' }
			],
			['1']
		);

		expect(merged.map((option) => option.name)).toEqual(['1', 'S1', '47']);
	});

	it('groups a ghost replacement bus with the buses', () => {
		// A bookmarked `SEV S4` has no vehicle type at all (ghost badge), so only
		// the name can tell it belongs with the buses.
		const merged = _lineFilterOptions(
			[
				{ name: 'S4', vehicleType: 'rail' },
				{ name: '47', vehicleType: 'bus' }
			],
			['SEV S4']
		);

		expect(merged.map((option) => option.name)).toEqual(['S4', '47', 'SEV S4']);
	});
});

describe('line filter', () => {
	const s1 = makeDeparture({ lineName: 'S1' });
	const s11 = makeDeparture({ lineName: 'S11' });
	const bus27 = makeDeparture({ lineName: '27', vehicleType: 'bus' });
	const station = makeStation([
		makePlatform('1/2', [s1, s11]),
		makePlatform('G', [bus27], PlatformType.Bus)
	]);

	it('keeps everything when nothing is selected', () => {
		const platforms = _filterByLineName(station, []);

		expect(platforms.map((p) => p.platform.name)).toEqual(['1/2', 'G']);
		expect(platforms[0].departures).toHaveLength(2);
	});

	it('keeps only departures of selected lines and drops emptied platforms', () => {
		const platforms = _filterByLineName(station, ['S1']);

		expect(platforms).toHaveLength(1);
		expect(platforms[0].platform.name).toBe('1/2');
		expect(platforms[0].departures).toEqual([s1]);
	});

	it('keeps the filter active when no selected line currently runs', () => {
		const platforms = _filterByLineName(station, ['S9']);

		expect(platforms).toEqual([]);
	});

	it('returns nothing without departures', () => {
		expect(_filterByLineName(null, ['S1'])).toEqual([]);
	});

	it('composes with the platform filter', () => {
		const platforms = _filterDepartures(station, ['27'], ['G']);

		expect(platforms.map((p) => p.platform.name)).toEqual(['G']);
		expect(platforms[0].departures).toEqual([bus27]);
	});

	it('drops the result when the line filter excludes the selected platform', () => {
		// S1 runs on platform 1/2 only: filtering to S1 + platform G must
		// intersect to nothing, not silently ignore the platform selection.
		expect(_filterDepartures(station, ['S1'], ['G'])).toEqual([]);
	});

	it('drops the result when the line-filtered response no longer has the platform', () => {
		// With a line selection the API already returns only the selected
		// lines' platforms, so platform G is absent from what the client sees.
		// That is still a real intersection (empty), not a stale selection.
		const lineFiltered = makeStation([makePlatform('1/2', [s1])]);

		expect(_filterDepartures(lineFiltered, ['S1'], ['G'])).toEqual([]);
	});

	it('ignores a platform selection the station does not serve at all', () => {
		// Stale selection (platform gone from the live data): show everything
		// instead of stranding the user on a blank page.
		expect(_filterDepartures(station, [], ['X']).map((p) => p.platform.name)).toEqual(['1/2', 'G']);
	});
});

describe('board view', () => {
	const station = makeStation([makePlatform('1/2', [makeDeparture({ lineName: '6' })])]);
	const settled = { error: null, departures: station, shownCount: 0, awaitingSelection: false };

	it('shows the board when departures are visible', () => {
		expect(_boardView({ ...settled, shownCount: 3, hasFilter: false })).toBe('board');
	});

	it('keeps visible departures on screen while a new selection is on its way', () => {
		// Adding a line to the selection keeps the old rows valid (they match
		// both selections), so swapping them for a loading message would be a
		// flash of its own.
		expect(
			_boardView({ ...settled, shownCount: 3, awaitingSelection: true, hasFilter: true })
		).toBe('board');
	});

	it('loads without announcing an empty board while a filter change is in flight', () => {
		// Switching from tram 6 to tram 1 empties the intersection with the
		// tram-6 response: the gap must read as loading, not as "none match".
		expect(_boardView({ ...settled, awaitingSelection: true, hasFilter: true })).toBe(
			'loadingSelection'
		);
	});

	it('announces an empty result only once the response has landed', () => {
		expect(_boardView({ ...settled, hasFilter: true })).toBe('emptyFiltered');
		expect(_boardView({ ...settled, hasFilter: false })).toBe('emptyStop');
	});

	it('shows loading before any data has arrived', () => {
		expect(_boardView({ ...settled, departures: null, hasFilter: false })).toBe('loading');
	});

	it('names a station the feed does not know', () => {
		const unknown = { ...station, stationName: '' };

		expect(_boardView({ ...settled, departures: unknown, hasFilter: true })).toBe('unknownStation');
	});

	it('keeps reporting an error while a new selection is being fetched', () => {
		// The poll keeps retrying upstream, so the banner must not flicker into
		// a loading message on every attempt.
		const error = { code: 'UPSTREAM_TIMEOUT', message: 'timeout' };

		expect(_boardView({ ...settled, error, awaitingSelection: true, hasFilter: true })).toBe(
			'error'
		);
	});
});

describe('_mergePlatformNames', () => {
	it('unions the lists while keeping the current order', () => {
		expect(_mergePlatformNames(['1/2', 'G'], ['1/2'])).toEqual(['1/2', 'G']);
		expect(_mergePlatformNames(['1/2'], ['G', '3'])).toEqual(['1/2', 'G', '3']);
		expect(_mergePlatformNames([], ['1'])).toEqual(['1']);
	});
});

describe('bounded line selection', () => {
	it('keeps colons and commas readable in the serialized query', () => {
		const query = _serializeQuery([
			['stationId', 'de:08212:89'],
			['eventType', 'dep'],
			[LINES_PARAM, serializeLines(['S1', 'S4'])]
		]);

		expect(query).toBe('stationId=de:08212:89&eventType=dep&lines=S1,S4');

		// Still parses back to the same values.
		const parsed = new URLSearchParams(query);
		expect(parsed.get('stationId')).toBe('de:08212:89');
		expect(parseLinesParam(parsed)).toEqual(['S1', 'S4']);
	});

	it('caps the ghost badges built for selected lines', () => {
		const names = Array.from({ length: 5000 }, (_, i) => `L${i}`);

		const options = _lineFilterOptions([], names);

		expect(options).toHaveLength(100);
		expect(options.every((option) => option.name.length <= 50)).toBe(true);
	});

	it('still filters correctly with an oversized selection', () => {
		const s1 = makeDeparture({ lineName: 'S1' });
		const bus27 = makeDeparture({ lineName: '27', vehicleType: 'bus' });
		const station = makeStation([
			makePlatform('1/2', [s1]),
			makePlatform('G', [bus27], PlatformType.Bus)
		]);

		const selection = ['S1', ...Array.from({ length: 200 }, (_, i) => `X${i}`)];
		const platforms = _filterByLineName(station, selection);

		expect(platforms).toHaveLength(1);
		expect(platforms[0].departures).toEqual([s1]);
	});
});

describe('_fetchDepartures (GET /api/departures)', () => {
	function capturingFetch(): { urls: string[]; fetchFn: typeof fetch } {
		const urls: string[] = [];
		const body = { ok: true, data: makeStation([]) };
		const fetchFn = (async (input: RequestInfo | URL) => {
			urls.push(String(input));
			return new Response(JSON.stringify(body));
		}) as typeof fetch;
		return { urls, fetchFn };
	}

	it('omits the lines parameter when nothing is selected', async () => {
		const { urls, fetchFn } = capturingFetch();

		await _fetchDepartures(fetchFn, 'de:08212:89', 'dep');

		expect(urls).toEqual(['/api/departures?stationId=de%3A08212%3A89&eventType=dep']);
	});

	it('sends an explicit empty selection as no lines parameter', async () => {
		const { urls, fetchFn } = capturingFetch();

		await _fetchDepartures(fetchFn, 'de:08212:89', 'arr', []);

		expect(urls).toEqual(['/api/departures?stationId=de%3A08212%3A89&eventType=arr']);
	});

	it('sends the selected lines encoded as a lines parameter', async () => {
		const { urls, fetchFn } = capturingFetch();

		await _fetchDepartures(fetchFn, 'de:08212:89', 'dep', ['S1', '3']);

		expect(urls).toEqual(['/api/departures?stationId=de%3A08212%3A89&eventType=dep&lines=S1%2C3']);
	});

	it('encodes names that need escaping', async () => {
		const { urls, fetchFn } = capturingFetch();

		await _fetchDepartures(fetchFn, 'de:08212:89', 'dep', ['RE 7', 'a&b']);

		// The server re-parses and re-bounds the value; this is only about
		// the URL being well-formed and round-trippable.
		const parsed = new URL(urls[0], 'http://localhost');
		expect(parsed.searchParams.get('lines')).toBe('RE 7,a&b');
	});
});

describe('_fetchStopLines (GET /api/stop-lines)', () => {
	const jsonFetch =
		(body: unknown, status = 200) =>
		async () =>
			new Response(JSON.stringify(body), { status });

	it('returns the lines from a well-formed envelope', async () => {
		const fetchFn = jsonFetch({
			ok: true,
			data: {
				stationId: 'de:08212:1002',
				lines: [
					{ name: 'S4', vehicleType: 'rail' },
					{ name: 'NL1', vehicleType: 'tram' }
				]
			}
		});

		const lines = await _fetchStopLines(fetchFn as typeof fetch, 'de:08212:1002');

		expect(lines).toEqual([
			{ name: 'S4', vehicleType: 'rail' },
			{ name: 'NL1', vehicleType: 'tram' }
		]);
	});

	it('requests the given station id encoded', async () => {
		const urls: string[] = [];
		const fetchFn = (async (input: RequestInfo | URL) => {
			urls.push(String(input));
			return new Response(JSON.stringify({ ok: true, data: { lines: [] } }));
		}) as typeof fetch;

		await _fetchStopLines(fetchFn, 'de:08212:1002');

		expect(urls).toEqual(['/api/stop-lines?stationId=de%3A08212%3A1002']);
	});

	it('drops malformed entries instead of passing them to the filter', async () => {
		const fetchFn = jsonFetch({
			ok: true,
			data: {
				stationId: 'de:08212:1002',
				lines: [{ name: 'S4', vehicleType: 'rail' }, { name: 7 }, null, 'x']
			}
		});

		const lines = await _fetchStopLines(fetchFn as typeof fetch, 'de:08212:1002');

		expect(lines).toEqual([{ name: 'S4', vehicleType: 'rail' }]);
	});

	it('degrades to an empty list on HTTP errors, bad payloads and network failures', async () => {
		expect(await _fetchStopLines(jsonFetch({}, 500) as typeof fetch, 'x')).toEqual([]);
		expect(
			await _fetchStopLines(
				jsonFetch({ ok: false, error: { code: 'E', message: 'm' } }) as typeof fetch,
				'x'
			)
		).toEqual([]);
		expect(
			await _fetchStopLines(jsonFetch({ ok: true, data: { lines: 'nope' } }) as typeof fetch, 'x')
		).toEqual([]);
		expect(
			await _fetchStopLines((async () => new Response('<html>')) as typeof fetch, 'x')
		).toEqual([]);
		expect(
			await _fetchStopLines(
				(async () => {
					throw new Error('offline');
				}) as typeof fetch,
				'x'
			)
		).toEqual([]);
	});
});
