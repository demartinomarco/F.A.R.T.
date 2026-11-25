// Generates src/lib/assets/stop-lines.json — which lines (tram/bus) serve which stop.
//
// Sources:
//  1. KVV GTFS (https://projekte.kvv-efa.de/GTFS/google_transit.zip, CC0, updated
//     nearly daily): the full network as planned service including known
//     construction works. Stop-to-line mapping comes from stops.txt +
//     trips.txt + stop_times.txt, restricted to services whose validity window
//     has not ended. Caveat: the feed encodes most of the regional bus network
//     with route_type 3 ("rail"); expandRoutes() re-classifies such a route as
//     bus when the probe (2) saw its line name as a bus at any of its stops.
//  2. KVV TRIAS (EFA): a bus-only probe. For every stop in kvv_stops.csv we
//     request bus departures for three 12 h windows (weekday 00-12, weekday
//     12-24, Saturday 00-12) and collect the distinct PublishedLineNames. The
//     probe both contributes bus lines and serves as the ground truth for (1).
//  3. KVV TRIAS (EFA): a line-ref probe. For every stop we request all
//     departures (no mode filter) for one 12 h window (as-of day 00-12) and
//     collect the (PublishedLineName, LineRef) pairs. The output `lines` map
//     (global published name -> internal LineRefs) is what the live API uses
//     to translate the sidebar selection into a TRIAS LineFilter: TRIAS only
//     filters by internal LineRef, not by published line name. Each direction
//     has its own ref (kvv:21003:E:H / :R) and DDB mirrors KVV services under
//     its own refs, so a line normally maps to several refs (the union of
//     everything observed, across all stops and feeds).
//
// Usage:
//   node scripts/stop-lines/generate.mjs [options]
//     --gtfs-only        skip the TRIAS probes (previous checkpoints are
//                        reused as the bus ground truth and the line-ref map
//                        when present)
//     --bus-only         skip the GTFS download/parsing
//     --local-zip <p>    use an already downloaded google_transit.zip
//     --as-of YYYYMMDD   reference date (default: today, Europe/Berlin)
//     --workdir <p>      scratch dir (default: /tmp/opencode/stop-lines)
//     --sleep-ms <n>     pause between TRIAS requests (default: 200)
//     --resume           continue the TRIAS probes from their checkpoints
//     --stops a,b,c      only probe/emit these stop ids (testing)
//
// The GTFS part is safe to re-run anytime (static download). The probe parts
// send ~4 requests per stop to the live KVV TRIAS endpoint — run them after
// timetable changes or when the feed's data has gone stale.

import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseStream } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';

const REPO_ROOT = join(fileURLToPath(new URL('../../', import.meta.url)));
const OUT_FILE = join(REPO_ROOT, 'src/lib/assets/stop-lines.json');
const GTFS_URL = 'https://projekte.kvv-efa.de/GTFS/google_transit.zip';

// ---------------------------------------------------------------- CLI args
const args = process.argv.slice(2);
function arg(name, fallback) {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : fallback;
}
const opts = {
	gtfsOnly: args.includes('--gtfs-only'),
	busOnly: args.includes('--bus-only'),
	localZip: arg('--local-zip', null),
	asOf: arg('--as-of', berlinDateStr(new Date())),
	workdir: arg('--workdir', '/tmp/opencode/stop-lines'),
	sleepMs: Number(arg('--sleep-ms', '200')),
	resume: args.includes('--resume'),
	stops: arg('--stops', null)
		?.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
};

// Berlin time helpers (all anchor dates are wall-clock Europe/Berlin).
function berlinDateStr(d) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })
		.format(d)
		.replaceAll('-', '');
}
function berlinOffsetFor(dateStr) {
	// dateStr: 'YYYY-MM-DD' — returns '+01:00' | '+02:00'
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		timeZoneName: 'longOffset'
	});
	const parts = Object.fromEntries(
		fmt.formatToParts(new Date(dateStr + 'T12:00:00Z')).map((p) => [p.type, p.value])
	);
	let off = parts.timeZoneName.replace('GMT', '') || '+00:00';
	if (off !== 'Z' && !off.includes(':')) off = off[0] + off.slice(1).padStart(2, '0') + ':00';
	return off;
}
function isoBerlin(dateStr, hhmm) {
	return `${dateStr}T${hhmm}:00${berlinOffsetFor(dateStr)}`;
}
function nextSaturdayOnOrAfter(dateStr) {
	const d = new Date(dateStr + 'T12:00:00Z');
	const day = (d.getUTCDay() + 7) % 7; // 0=Sun
	const delta = (6 - day + 7) % 7 || 7; // strictly next Saturday (>= +1 day)
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- CSV helpers
function readCsvTable(file, { delimiter = ',' } = {}) {
	return parseSync(readFileSync(file), {
		columns: true,
		bom: true,
		relax_record_delimiter: true,
		skip_empty_lines: true,
		trim: true,
		delimiter
	});
}
// csv-parse's parse() is a Node Transform (object mode); pipe the file through it.
function streamCsvRows(file) {
	return createReadStream(file).pipe(
		parseStream({ columns: true, bom: true, skip_empty_lines: true, trim: true })
	);
}

// ---------------------------------------------------------------- GTFS part
// Returns { routeStations: Map<routeId, Set<stationId>>, routes, feedVersion }.
// The station->lines map is only built in expandRoutes(), because a route's
// true vehicle type needs the bus probe as ground truth (see below).
async function buildFromGtfs(workdir, asOf, localZip) {
	const zipPath = localZip ?? join(workdir, 'google_transit.zip');
	if (!localZip) {
		console.log(`[gtfs] downloading ${GTFS_URL}`);
		const res = await fetch(GTFS_URL);
		if (!res.ok) throw new Error(`GTFS download failed: HTTP ${res.status}`);
		writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
	}
	const dir = join(workdir, 'gtfs');
	mkdirSync(dir, { recursive: true });
	console.log('[gtfs] extracting');
	const unzip = spawnSync('unzip', ['-o', '-q', zipPath, '-d', dir], { stdio: 'inherit' });
	if (unzip.status !== 0) throw new Error('unzip failed');

	// stops.txt: station rows have location_type '1'; stop-point rows reference
	// their parent station via parent_station = 'P' + stationId.
	const stopPointToStation = new Map();
	for (const row of readCsvTable(join(dir, 'stops.txt'))) {
		if (row.location_type === '1') {
			// the station itself (also a valid stop id)
			if (!stopPointToStation.has(row.stop_id)) stopPointToStation.set(row.stop_id, row.stop_id);
		} else if (row.parent_station?.startsWith('P')) {
			stopPointToStation.set(row.stop_id, row.parent_station.slice(1));
		}
	}

	// routes.txt
	const routes = new Map();
	for (const row of readCsvTable(join(dir, 'routes.txt'))) {
		routes.set(row.route_id, {
			name: row.route_short_name || row.route_long_name,
			type: row.route_type
		});
	}

	// calendar.txt: a service is active while its validity window has not ended.
	const activeServices = new Set();
	for (const row of readCsvTable(join(dir, 'calendar.txt'))) {
		if ((row.end_date ?? '99999999') >= asOf) activeServices.add(row.service_id);
	}
	console.log(`[gtfs] ${activeServices.size} active service patterns (end_date >= ${asOf})`);

	// trips.txt: trip_id -> route_id (active services only)
	const tripToRoute = new Map();
	for (const row of readCsvTable(join(dir, 'trips.txt'))) {
		if (activeServices.has(row.service_id)) tripToRoute.set(row.trip_id, row.route_id);
	}

	// stop_times.txt (342 MB): stream it, accumulate which stations each
	// active route serves.
	const routeStations = new Map();
	let rows = 0;
	for await (const row of streamCsvRows(join(dir, 'stop_times.txt'))) {
		rows++;
		const routeId = tripToRoute.get(row.trip_id);
		const stationId = stopPointToStation.get(row.stop_id);
		if (!routeId || !stationId) continue;
		let stops = routeStations.get(routeId);
		if (!stops) {
			stops = new Set();
			routeStations.set(routeId, stops);
		}
		stops.add(stationId);
	}
	const allStations = new Set();
	for (const stops of routeStations.values()) for (const s of stops) allStations.add(s);
	console.log(
		`[gtfs] stop_times rows: ${rows} -> ${routeStations.size} routes, ${allStations.size} stations`
	);

	const feedVersion = readCsvTable(join(dir, 'feed_info.txt'))[0]?.feed_version ?? '';
	return { routeStations, routes, feedVersion };
}

// KVV's GTFS encodes most of the regional BUS network with route_type 3
// ("rail") — 235 of the 294 type-3 routes are in fact buses (same stops and
// headways as the TRIAS bus services). The bus probe is ground truth: if the
// probe saw the route's published name as a bus at one of its stops, the
// route is a bus, at all of its stops.
function expandRoutes(routeStations, routes, busStations) {
	let reclassified = 0;
	const stations = new Map(); // stationId -> Map<lineName, vehicleType>

	for (const [routeId, stopSet] of routeStations) {
		const route = routes.get(routeId);
		if (!route?.name || stopSet.size === 0) continue;

		const isBus = [...stopSet].some((st) => busStations.get(st)?.has(route.name));
		if (isBus && route.type !== '0') reclassified++;
		const vt = isBus ? 'bus' : gtfsVehicleType(route.type);

		for (const stationId of stopSet) {
			let byStation = stations.get(stationId);
			if (!byStation) {
				byStation = new Map();
				stations.set(stationId, byStation);
			}
			// One entry per line name; keep the non-bus vehicleType when a
			// name collides across types (consistent with _extractLineOptions).
			const existing = byStation.get(route.name);
			if (!existing || (existing === 'bus' && vt !== 'bus')) byStation.set(route.name, vt);
		}
	}
	console.log(
		`[gtfs] ${reclassified} routes classified as bus via the probe -> ${stations.size} stations`
	);
	return stations;
}

// GTFS route_type -> TRIAS PtMode vocabulary used by the live API
// (the app's Departure.vehicleType is Mode.PtMode: 'tram' | 'rail' | 'bus').
// KVV's feed uses 0 (tram), 2 (Stadtbahn — S-lines and regional trams,
// coded 'rail' in TRIAS) and 3 (rail). The 10x spec values are mapped for
// completeness; everything unknown falls back to 'bus' (bus-last grouping).
function gtfsVehicleType(routeType) {
	switch (routeType) {
		case '0':
		case '100':
			return 'tram';
		case '2':
		case '3':
		case '4':
		case '103':
		case '104':
			return 'rail';
		default:
			return 'bus';
	}
}

// ---------------------------------------------------------------- TRIAS env
function readTriasEnv() {
	const envFile = join(REPO_ROOT, '.env');
	const env = Object.fromEntries(
		readFileSync(envFile, 'utf8')
			.split('\n')
			.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
			.filter(Boolean)
			.map((m) => [m[1], m[2].replaceAll(/^["']|["']$/g, '')])
	);
	const apiUrl = env.KVV_TRIAS_API_URL;
	const requestorRef = env.KVV_TRIAS_REQUESTOR_REF;
	if (!apiUrl || !requestorRef)
		throw new Error('KVV_TRIAS_API_URL / KVV_TRIAS_REQUESTOR_REF missing in .env');
	return { apiUrl, requestorRef };
}

// ---------------------------------------------------------------- Bus probe
// Returns Map<stationId, Map<lineName, 'bus'>>
async function probeBusLines(stops, asOf, workdir, sleepMs, resume) {
	const { apiUrl, requestorRef } = readTriasEnv();

	// Windows (Berlin wall-clock): full weekday + the Saturday night block.
	const weekday = asOf.slice(0, 4) + '-' + asOf.slice(4, 6) + '-' + asOf.slice(6, 8);
	const windows = [
		isoBerlin(weekday, '00:00'),
		isoBerlin(weekday, '12:00'),
		isoBerlin(nextSaturdayOnOrAfter(weekday), '00:00')
	];

	// Checkpoint: progress[stopId][stopId|anchor] = { lineName: mode, ... }.
	// A failed window is stored as null so `--resume` retries it instead of
	// treating it as "no buses".
	const checkpoint = join(workdir, 'bus-progress.json');
	let progress =
		resume && existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : {};

	let sent = 0;
	for (const stop of stops) {
		const id = stop.gid;
		const collected = (progress[id] ??= {});
		for (const anchor of windows) {
			const key = id + '|' + anchor;
			if (collected[key] !== undefined && collected[key] !== null) continue; // done

			const events = await fetchBusEvents(apiUrl, requestorRef, id, anchor);
			collected[key] =
				events === null ? null : Object.fromEntries(events.map((e) => [e.name, e.mode]));
			sent++;
			if (sent % 200 === 0) {
				const total = stops.length * windows.length;
				console.log(`[bus] ${sent}/${total} requests done`);
				writeFileSync(checkpoint, JSON.stringify(progress));
			}
			await new Promise((r) => setTimeout(r, sleepMs));
		}
	}
	writeFileSync(checkpoint, JSON.stringify(progress));

	// Build the map from the (complete) checkpoint.
	const busMap = new Map();
	let failedWindows = 0;
	for (const [id, windows_] of Object.entries(progress)) {
		for (const names of Object.values(windows_)) {
			if (names === null) {
				failedWindows++;
				continue;
			}
			for (const [name, mode] of Object.entries(names ?? {})) {
				if (mode !== 'bus') continue;
				let byStop = busMap.get(id);
				if (!byStop) {
					byStop = new Map();
					busMap.set(id, byStop);
				}
				byStop.set(name, 'bus');
			}
		}
	}
	if (failedWindows > 0) {
		console.warn(`[bus] ${failedWindows} windows failed — re-run with --resume to retry them`);
	}
	return busMap;
}

async function fetchBusEvents(apiUrl, requestorRef, stopId, anchor, attempt = 1) {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Trias version="1.1" xmlns="http://www.vdv.de/trias" xmlns:siri="http://www.siri.org.uk/siri">
  <ServiceRequest>
    <siri:RequestTimeStamp>${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</siri:RequestTimeStamp>
    <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
    <RequestPayload>
      <StopEventRequest>
        <Location><LocationRef><StopPlaceRef>${stopId}</StopPlaceRef></LocationRef><DepArrTime>${anchor}</DepArrTime></Location>
        <Params>
          <PtModeFilter><Exclude>false</Exclude><PtMode>bus</PtMode></PtModeFilter>
          <NumberOfResults>300</NumberOfResults>
          <TimeWindow>PT12H</TimeWindow>
          <StopEventType>departure</StopEventType>
          <IncludePreviousCalls>false</IncludePreviousCalls>
          <IncludeOnwardCalls>false</IncludeOnwardCalls>
          <IncludeOperatingDays>false</IncludeOperatingDays>
          <IncludeRealtimeData>false</IncludeRealtimeData>
        </Params>
      </StopEventRequest>
    </RequestPayload>
  </ServiceRequest>
</Trias>`;
	try {
		const res = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/xml; charset=UTF-8', Accept: 'application/xml' },
			body: xml,
			signal: AbortSignal.timeout(30000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		if (text.includes('STOPEVENT_NOEVENTFOUND') || text.includes('STOPEVENT_LOCATIONUNSERVED'))
			return [];
		const out = [];
		for (const m of text.matchAll(/<trias:StopEventResult>[\s\S]*?<\/trias:StopEventResult>/g)) {
			const b = m[0];
			const name = b.match(/<trias:PublishedLineName>\s*<trias:Text>([^<]*)<\/trias:Text>/);
			const mode = b.match(/<trias:PtMode>([^<]*)<\/trias:PtMode>/);
			if (name?.[1]) out.push({ name: name[1].trim(), mode: mode?.[1] ?? '' });
		}
		return out;
	} catch (e) {
		if (attempt < 3) {
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
			return fetchBusEvents(apiUrl, requestorRef, stopId, anchor, attempt + 1);
		}
		console.warn(`[bus] giving up on ${stopId} @ ${anchor}: ${e.message}`);
		return null; // failed window: checkpoint stores null, --resume retries it
	}
}

// ---------------------------------------------------------------- Line-ref probe
// One unfiltered request per stop (12 h window, as-of day 00:00): every
// StopEvent contributes its (PublishedLineName, LineRef) pair. Builds the
// global `lines` map: published name -> union of all LineRefs observed
// (both directions, all data feeds). Returns the map
// (Record<lineName, string[]>), sorted for stable diffs.
async function probeLineRefs(stops, asOf, workdir, sleepMs, resume) {
	const { apiUrl, requestorRef } = readTriasEnv();

	const weekday = asOf.slice(0, 4) + '-' + asOf.slice(4, 6) + '-' + asOf.slice(6, 8);
	const anchor = isoBerlin(weekday, '00:00');

	// Checkpoint: progress[stopId|anchor] = { [lineName]: [ref, ...] } | null.
	// The anchor in the key keeps a --resume with a different --as-of from
	// reusing stale data; a failed stop is stored as null so `--resume`
	// retries it instead of treating it as "no lines".
	const checkpoint = join(workdir, 'line-ref-progress.json');
	let progress =
		resume && existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : {};

	let sent = 0;
	for (const stop of stops) {
		const id = stop.gid;
		const key = id + '|' + anchor;
		const collected = progress[key];
		if (collected !== undefined && collected !== null) continue; // done

		const byName = await fetchLineRefEvents(apiUrl, requestorRef, id, anchor);
		progress[key] =
			byName === null
				? null
				: Object.fromEntries([...byName.entries()].map(([name, refs]) => [name, [...refs]]));
		sent++;
		if (sent % 200 === 0) {
			console.log(`[lines] ${sent}/${stops.length} stops done`);
			writeFileSync(checkpoint, JSON.stringify(progress));
		}
		await new Promise((r) => setTimeout(r, sleepMs));
	}
	writeFileSync(checkpoint, JSON.stringify(progress));

	return buildLineRefMap(progress);
}

// Builds the global name -> refs union from a (partial) checkpoint. Failed
// stops (null) are skipped; the caller reports them.
function buildLineRefMap(progress) {
	const byName = new Map(); // name -> Set<ref>
	for (const entries of Object.values(progress)) {
		for (const [name, refs] of Object.entries(entries ?? {})) {
			let set = byName.get(name);
			if (!set) {
				set = new Set();
				byName.set(name, set);
			}
			for (const ref of refs) set.add(ref);
		}
	}
	return Object.fromEntries(
		[...byName.entries()]
			.sort(([a], [b]) => compareLineNames(a, b))
			.map(([name, refs]) => [name, [...refs].sort()])
	);
}

async function fetchLineRefEvents(apiUrl, requestorRef, stopId, anchor, attempt = 1) {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Trias version="1.1" xmlns="http://www.vdv.de/trias" xmlns:siri="http://www.siri.org.uk/siri">
  <ServiceRequest>
    <siri:RequestTimeStamp>${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</siri:RequestTimeStamp>
    <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
    <RequestPayload>
      <StopEventRequest>
        <Location><LocationRef><StopPlaceRef>${stopId}</StopPlaceRef></LocationRef><DepArrTime>${anchor}</DepArrTime></Location>
        <Params>
          <NumberOfResults>300</NumberOfResults>
          <TimeWindow>PT12H</TimeWindow>
          <StopEventType>departure</StopEventType>
          <IncludePreviousCalls>false</IncludePreviousCalls>
          <IncludeOnwardCalls>false</IncludeOnwardCalls>
          <IncludeOperatingDays>false</IncludeOperatingDays>
          <IncludeRealtimeData>false</IncludeRealtimeData>
        </Params>
      </StopEventRequest>
    </RequestPayload>
  </ServiceRequest>
</Trias>`;
	try {
		const res = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/xml; charset=UTF-8', Accept: 'application/xml' },
			body: xml,
			signal: AbortSignal.timeout(30000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		if (text.includes('STOPEVENT_NOEVENTFOUND') || text.includes('STOPEVENT_LOCATIONUNSERVED'))
			return new Map();
		const byName = new Map(); // name -> Set<ref>
		for (const m of text.matchAll(/<trias:StopEventResult>[\s\S]*?<\/trias:StopEventResult>/g)) {
			const b = m[0];
			const ref = b.match(/<trias:LineRef>([^<]*)<\/trias:LineRef>/);
			const name = b.match(/<trias:PublishedLineName>\s*<trias:Text>([^<]*)<\/trias:Text>/);
			const lineName = name?.[1]?.trim();
			const lineRef = ref?.[1]?.trim();
			if (!lineName || !lineRef) continue;
			let refs = byName.get(lineName);
			if (!refs) {
				refs = new Set();
				byName.set(lineName, refs);
			}
			refs.add(lineRef);
		}
		return byName;
	} catch (e) {
		if (attempt < 3) {
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
			return fetchLineRefEvents(apiUrl, requestorRef, stopId, anchor, attempt + 1);
		}
		console.warn(`[lines] giving up on ${stopId} @ ${anchor}: ${e.message}`);
		return null; // failed stop: checkpoint stores null, --resume retries it
	}
}

// ---------------------------------------------------------------- Merge + output
// The output is restricted to the site's stop universe (kvv_stops.csv): the
// sidebar can only look up stops the search index offers, so GTFS stations
// outside it (e.g. stops the feed carries but the site does not index) are
// dropped.
function mergeLineMaps(gtfsStations, busStations, kvvStops) {
	const stationIds = new Set(kvvStops.map((s) => s.gid));
	const stops = {};
	for (const id of stationIds) {
		const merged = new Map();
		for (const [name, vt] of gtfsStations.get(id) ?? []) merged.set(name, vt);
		for (const [name, vt] of busStations.get(id) ?? []) {
			const existing = merged.get(name);
			if (!existing || (existing === 'bus' && vt !== 'bus')) merged.set(name, vt);
		}
		if (merged.size === 0) continue;
		stops[id] = [...merged.entries()]
			.map(([name, vehicleType]) => ({ name, vehicleType }))
			.sort(compareLineOptions);
	}
	return stops;
}

// Comparison for line names: a leading digit run is the line number and
// compares numerically (1 < 2 < 11 < 12); a digit run after a letter is a
// prefix extension and compares lexicographically, so a line sorts next to
// its family (S5 < S51 < S7). Mirrors compareLineOptions() in
// src/routes/+page.ts.
function compareLineNames(a, b) {
	let i = 0;
	let j = 0;

	while (i < a.length && j < b.length) {
		const ca = a[i];
		const cb = b[j];
		const aDigit = ca >= '0' && ca <= '9';
		const bDigit = cb >= '0' && cb <= '9';

		if (aDigit && bDigit) {
			let ia = i;
			let ib = j;
			while (ia < a.length && a[ia] >= '0' && a[ia] <= '9') ia++;
			while (ib < b.length && b[ib] >= '0' && b[ib] <= '9') ib++;

			const ra = a.slice(i, ia);
			const rb = b.slice(j, ib);

			if (i === 0) {
				const diff = Number(ra) - Number(rb);
				if (diff !== 0) return diff;
			} else if (ra !== rb) {
				return ra < rb ? -1 : 1;
			}
			i = ia;
			j = ib;
		} else if (ca !== cb) {
			return ca < cb ? -1 : 1;
		} else {
			i++;
			j++;
		}
	}

	return a.length - b.length;
}

// Same ordering as compareLineOptions() in src/routes/+page.ts
function compareLineOptions(a, b) {
	const isBus = (v) => v.vehicleType === 'bus';
	const typeCmp = Number(isBus(a)) - Number(isBus(b));
	if (typeCmp !== 0) return typeCmp;
	return compareLineNames(a.name, b.name);
}

// ---------------------------------------------------------------- main
async function main() {
	mkdirSync(opts.workdir, { recursive: true });
	const asOf = opts.asOf;
	console.log(`stop-lines generator, as-of ${asOf}`);

	// The site's stop universe (also the probe target list).
	const kvvStops = readCsvTable(join(REPO_ROOT, 'src/lib/assets/kvv_stops.csv'), {
		delimiter: ';'
	});
	console.log(`stops in kvv_stops.csv: ${kvvStops.length}`);
	const probeStops = opts.stops ? kvvStops.filter((s) => opts.stops.includes(s.gid)) : kvvStops;
	if (opts.stops) console.log(`--stops filter: probing ${probeStops.length} stops`);

	let routeStations = new Map();
	let routes = new Map();
	let feedVersion = '';
	if (!opts.busOnly) {
		const built = await buildFromGtfs(opts.workdir, asOf, opts.localZip);
		routeStations = built.routeStations;
		routes = built.routes;
		feedVersion = built.feedVersion;
	}
	let busStations = new Map();
	if (!opts.gtfsOnly) {
		const started = Date.now();
		busStations = await probeBusLines(probeStops, asOf, opts.workdir, opts.sleepMs, opts.resume);
		console.log(
			`[bus] ${busStations.size} stops have bus lines (${((Date.now() - started) / 1000).toFixed(0)}s)`
		);
	} else if (existsSync(join(opts.workdir, 'bus-progress.json'))) {
		// A fresh GTFS parse still needs the bus probe as ground truth to
		// classify the feed's mislabeled bus routes: reuse the last checkpoint.
		const progress = JSON.parse(readFileSync(join(opts.workdir, 'bus-progress.json'), 'utf8'));
		for (const [id, windows] of Object.entries(progress)) {
			for (const v of Object.values(windows)) {
				for (const [name] of Object.entries(v ?? {})) {
					let byStop = busStations.get(id);
					if (!byStop) {
						byStop = new Map();
						busStations.set(id, byStop);
					}
					byStop.set(name, 'bus');
				}
			}
		}
		console.log(
			`[bus] --gtfs-only: reused checkpoint for ${busStations.size} stops (route classification)`
		);
	}

	const gtfsStations = !opts.busOnly ? expandRoutes(routeStations, routes, busStations) : new Map();

	let lineRefMap = {};
	if (!opts.gtfsOnly) {
		const started = Date.now();
		lineRefMap = await probeLineRefs(probeStops, asOf, opts.workdir, opts.sleepMs, opts.resume);
		const failedStops = Object.values(
			JSON.parse(readFileSync(join(opts.workdir, 'line-ref-progress.json'), 'utf8'))
		).filter((v) => v === null).length;
		if (failedStops > 0)
			console.warn(`[lines] ${failedStops} stops failed — re-run with --resume to retry them`);
		console.log(
			`[lines] ${Object.keys(lineRefMap).length} lines mapped (${((Date.now() - started) / 1000).toFixed(0)}s)`
		);
	} else if (existsSync(join(opts.workdir, 'line-ref-progress.json'))) {
		// The line-ref map is TRIAS-derived: reuse the last checkpoint when
		// the probe is skipped, like the bus ground truth above.
		const progress = JSON.parse(readFileSync(join(opts.workdir, 'line-ref-progress.json'), 'utf8'));
		lineRefMap = buildLineRefMap(progress);
		console.log(
			`[lines] --gtfs-only: reused checkpoint for ${Object.keys(lineRefMap).length} lines`
		);
	}

	let stops = mergeLineMaps(gtfsStations, busStations, kvvStops);
	if (opts.stops) {
		stops = Object.fromEntries(Object.entries(stops).filter(([id]) => opts.stops.includes(id)));
	}
	const output = {
		generatedAt: new Date().toISOString(),
		asOf: asOf,
		sources: {
			gtfs: opts.busOnly
				? null
				: {
						url: GTFS_URL,
						feedVersion,
						note: 'full network as planned service (services active on/after asOf); routes the probe confirms as buses are re-classified (the feed encodes most of the regional bus network with route_type 3)'
					},
			trias: opts.gtfsOnly
				? null
				: {
						note: `bus probe, 3 windows of 12h (weekday 00-12, 12-24, next Saturday 00-12) + line-ref probe, 1 window of 12h (as-of day 00:00-12:00), as of ${asOf}`
					}
		},
		lines: lineRefMap,
		stops
	};
	writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n');
	const withLines = Object.keys(stops).length;
	const totalLines = Object.values(stops).reduce((n, l) => n + l.length, 0);
	const totalRefs = Object.values(lineRefMap).reduce((n, refs) => n + refs.length, 0);
	console.log(
		`wrote ${OUT_FILE}: ${withLines} stops, ${totalLines} line entries, ${Object.keys(lineRefMap).length} line names / ${totalRefs} refs`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
