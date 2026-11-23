import { describe, expect, it } from 'vitest';
import {
	_getDepartureKey,
	_getPlatformKey,
	_extractLineOptions,
	_lineFilterOptions,
	_filterByLineName,
	_filterDepartures,
	_parseLinesParam,
	_serializeLines,
	_serializeQuery,
	_LINES_PARAM
} from './+page';
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
			'10',
			'2',
			'S1',
			'27'
		]);
	});

	it('ignores blank line names and returns nothing without departures', () => {
		expect(_extractLineOptions(null)).toEqual([]);

		const departures = makeStation([makePlatform('4', [makeDeparture({ lineName: '  ' })])]);

		expect(_extractLineOptions(departures)).toEqual([]);
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

		expect(merged.map((option) => option.name)).toEqual(['10', '2', 'S1', 'S41']);
		expect(merged.find((option) => option.name === 'S41')?.vehicleType).toBe('');
	});

	it('does not duplicate lines that are already available', () => {
		const merged = _lineFilterOptions(options, ['S1', 'S1']);

		expect(merged.map((option) => option.name)).toEqual(['10', '2', 'S1']);
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

	it('ignores a platform selection the station does not serve at all', () => {
		// Stale selection (platform gone from the live data): show everything
		// instead of stranding the user on a blank page.
		expect(_filterDepartures(station, [], ['X']).map((p) => p.platform.name)).toEqual(['1/2', 'G']);
	});
});

describe('lines URL parameter', () => {
	it('round-trips a comma-separated selection', () => {
		const serialized = _serializeLines(['S1', 'S4', '2']);

		expect(serialized).toBe('S1,S4,2');
		expect(_parseLinesParam(new URLSearchParams(`${_LINES_PARAM}=${serialized}`))).toEqual([
			'S1',
			'S4',
			'2'
		]);
	});

	it('keeps line names with spaces intact', () => {
		const searchParams = new URLSearchParams();
		searchParams.set(_LINES_PARAM, _serializeLines(['RE 7', 'ICE 2']));

		expect(_parseLinesParam(searchParams)).toEqual(['RE 7', 'ICE 2']);
	});

	it('trims and deduplicates entries', () => {
		const searchParams = new URLSearchParams();
		searchParams.set(_LINES_PARAM, ' S1 ,, S4 ,S1');

		expect(_parseLinesParam(searchParams)).toEqual(['S1', 'S4']);
		expect(_serializeLines([' S1 ', '', 'S4', 'S1'])).toBe('S1,S4');
	});

	it('is empty when cleared so the parameter can be dropped', () => {
		expect(_serializeLines([])).toBe('');
		expect(_serializeLines([' ', ''])).toBe('');
		expect(_parseLinesParam(new URLSearchParams(''))).toEqual([]);
		expect(_parseLinesParam(new URLSearchParams(`${_LINES_PARAM}=,,`))).toEqual([]);
	});
});

describe('lines URL parameter against hostile input', () => {
	function paramsWithLines(value: string): URLSearchParams {
		const searchParams = new URLSearchParams();
		searchParams.set(_LINES_PARAM, value);
		return searchParams;
	}

	it('caps the number of accepted lines at 100', () => {
		const names = Array.from({ length: 150 }, (_, i) => `L${i}`);

		expect(_parseLinesParam(paramsWithLines(names.join(',')))).toEqual(names.slice(0, 100));
	});

	it('drops individual names longer than a plausible line name', () => {
		const value = ['a'.repeat(50), 'b'.repeat(51), 'S1'].join(',');

		expect(_parseLinesParam(paramsWithLines(value))).toEqual(['a'.repeat(50), 'S1']);
	});

	it('does not materialize an unbounded array for a huge value', () => {
		expect(_parseLinesParam(paramsWithLines('x'.repeat(1_000_000)))).toEqual([]);
	});

	it('bounds a value with a huge number of entries to the first 100 distinct names', () => {
		const names = Array.from({ length: 5000 }, (_, i) => `L${i}`);

		const lines = _parseLinesParam(paramsWithLines(names.join(',')));

		expect(lines).toHaveLength(100);
		expect(lines).toEqual(names.slice(0, 100));
	});

	it('survives hostile characters without throwing', () => {
		const value = ['<script>alert(1)</script>', '\u0000', 'a"b\'c', 'tab\tname'].join(',');

		expect(() => _parseLinesParam(paramsWithLines(value))).not.toThrow();
		expect(_parseLinesParam(paramsWithLines(value))).toEqual([
			'<script>alert(1)</script>',
			'a"b\'c',
			'tabname'
		]);
	});

	it('strips control, zero-width and bidi characters from names', () => {
		const value = ['a\u200b', 'a\u202Eb', '\u2066S1\u2069', '\u0000'].join(',');

		// The lone NUL entry strips down to nothing and is dropped entirely.
		expect(_parseLinesParam(paramsWithLines(value))).toEqual(['a', 'ab', 'S1']);
	});

	it('keeps colons and commas readable in the serialized query', () => {
		const query = _serializeQuery([
			['stationId', 'de:08212:89'],
			['eventType', 'dep'],
			[_LINES_PARAM, _serializeLines(['S1', 'S4'])]
		]);

		expect(query).toBe('stationId=de:08212:89&eventType=dep&lines=S1,S4');

		// Still parses back to the same values.
		const parsed = new URLSearchParams(query);
		expect(parsed.get('stationId')).toBe('de:08212:89');
		expect(_parseLinesParam(parsed)).toEqual(['S1', 'S4']);
	});

	it('stays stable across serialize/parse round-trips at the cap', () => {
		const names = Array.from({ length: 250 }, (_, i) => `L${i}`);
		const once = _parseLinesParam(paramsWithLines(names.join(',')));
		const twice = _parseLinesParam(paramsWithLines(_serializeLines(once)));

		expect(once).toHaveLength(100);
		expect(twice).toEqual(once);
	});

	it('returns nothing for a parameter made only of empty or overlong entries', () => {
		expect(_parseLinesParam(paramsWithLines(',,,  ,  '))).toEqual([]);
		expect(_parseLinesParam(paramsWithLines(`${'y'.repeat(60)},${'z'.repeat(70)}`))).toEqual([]);
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
