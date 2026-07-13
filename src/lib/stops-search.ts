import Fuse from 'fuse.js';
import stopsCsvUrl from '$lib/assets/kvv_stops.csv?url';

export type StopRow = {
	gid: string;
	place_name: string;
	stop_name: string;
	lon: number;
	lat: number;
	search: string;
};

export type SearchResult = {
	value: string;
	label: string;
	placeName: string;
	stopName: string;
	distanceKm?: number;
};

export type GeoPoint = {
	lat: number;
	lon: number;
};

// ============================================================================
// Type definitions for internal use
// ============================================================================

type SearchIndex = {
	stops: StopRow[];
	fuse: Fuse<StopRow>;
};

type ScoredCandidate = {
	item: StopRow;
	textScore: number;
};

type RankedResult = {
	item: StopRow;
	distanceKm?: number;
	combinedScore: number;
};

// ============================================================================
// Constants and configuration
// ============================================================================

const FUSE_CONFIG = {
	threshold: 0.35,
	ignoreLocation: true,
	minMatchCharLength: 1,
	includeScore: true,
	keys: [
		{ name: 'search', weight: 1.0 },
		{ name: 'stop_name', weight: 0.6 },
		{ name: 'place_name', weight: 0.4 }
	]
} as const;

const SEARCH_LIMITS = {
	MIN_QUERY_LENGTH: 1,
	FUZZY_RESULTS: 50,
	FINAL_RESULTS: 9,
	DISTANCE_WEIGHT: 0.5,
	KARLSRUHE_BONUS: 0.08,
	DISTANCE_NORMALIZATION_KM: 25
} as const;

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;

// ============================================================================
// Caching
// ============================================================================

let indexPromise: Promise<SearchIndex> | undefined;

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parses a semicolon-delimited CSV string into StopRow objects.
 * Builds a searchable field combining place and stop names in various formats.
 */
function parseStopsCsv(csv: string): StopRow[] {
	const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
	const headers = headerLine.split(';');

	return lines.map((line) => {
		const cols = line.split(';');
		const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));

		return {
			gid: row.gid,
			place_name: row.place_name,
			stop_name: row.stop_name,
			lon: Number(row.lon),
			lat: Number(row.lat),
			search: buildSearchField(row.place_name, row.stop_name)
		};
	});
}

/**
 * Creates a searchable field that includes multiple name formats for better fuzzy matching.
 */
function buildSearchField(placeName: string, stopName: string): string {
	return `${placeName} ${stopName} ${stopName} (${placeName})`.toLowerCase();
}

/**
 * Fetches and parses the stops CSV file, building a Fuse.js search index.
 * Results are cached to avoid re-fetching on subsequent calls.
 */
async function getSearchIndex(): Promise<SearchIndex> {
	if (indexPromise) {
		return indexPromise;
	}

	indexPromise = fetch(stopsCsvUrl)
		.then(validateResponse)
		.then((csv) => {
			const stops = parseStopsCsv(csv);
			const fuse = new Fuse(stops, FUSE_CONFIG);
			return { stops, fuse };
		});

	return indexPromise;
}

/**
 * Validates an HTTP response and returns the text content.
 * Throws an error if the response is not OK.
 */
async function validateResponse(res: Response): Promise<string> {
	if (!res.ok) {
		throw new Error(`Could not load stops CSV: ${res.status}`);
	}
	return res.text();
}

// ============================================================================
// Geolocation and Scoring
// ============================================================================

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
	return degrees * DEGREES_TO_RADIANS;
}

/**
 * Calculates the great-circle distance between two geographic points
 * using the Haversine formula. Returns distance in kilometers.
 */
export function haversineKm(pointA: GeoPoint, pointB: GeoPoint): number {
	const dLat = toRadians(pointB.lat - pointA.lat);
	const dLon = toRadians(pointB.lon - pointA.lon);
	const lat1 = toRadians(pointA.lat);
	const lat2 = toRadians(pointB.lat);

	const sinLat = Math.sin(dLat / 2);
	const sinLon = Math.sin(dLon / 2);
	const x = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLon ** 2;

	return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Normalizes a search query by trimming whitespace and collapsing multiple spaces.
 */
export function normalizeQuery(q: string): string {
	return q.trim().replace(/\s+/g, ' ');
}

/**
 * Calculates a normalized distance score (0 = nearby, 1 = far away).
 * Distances beyond DISTANCE_NORMALIZATION_KM are capped at 1.
 */
function getDistanceScore(distanceKm: number): number {
	return Math.min(distanceKm / SEARCH_LIMITS.DISTANCE_NORMALIZATION_KM, 1);
}

/**
 * Applies bonus/penalty for well-known cities like Karlsruhe.
 * Lower scores rank higher, so we subtract the bonus.
 */
function getLocationBonus(item: StopRow): number {
	return item.place_name?.toLowerCase() === 'karlsruhe' ? SEARCH_LIMITS.KARLSRUHE_BONUS : 0;
}

/**
 * Combines text relevance score with distance and location bonuses.
 * Text relevance is dominant; distance and location modifiers bias results.
 */
function calculateCombinedScore(
	textScore: number,
	distanceKm: number | undefined,
	queryLength: number,
	locationBonus: number
): number {
	if (queryLength < SEARCH_LIMITS.MIN_QUERY_LENGTH) {
		// No text query: rank purely by distance
		return distanceKm === undefined ? 0 : getDistanceScore(distanceKm);
	}

	// Text query present: text score dominates, distance biases tiebreaks
	const distanceScore = distanceKm === undefined ? 0 : getDistanceScore(distanceKm);
	return textScore + distanceScore * SEARCH_LIMITS.DISTANCE_WEIGHT - locationBonus;
}

// ============================================================================
// Search Candidates
// ============================================================================

/**
 * Generates initial search candidates from either fuzzy matching or all stops.
 * Returns candidates with their text search scores.
 */
function getCandidates(query: string, stops: StopRow[], fuse: Fuse<StopRow>): ScoredCandidate[] {
	if (query.length >= SEARCH_LIMITS.MIN_QUERY_LENGTH) {
		return fuse.search(query, { limit: SEARCH_LIMITS.FUZZY_RESULTS }).map((result) => ({
			item: result.item,
			textScore: result.score ?? 1
		}));
	}

	// No query: return all stops with neutral score
	return stops.map((item) => ({
		item,
		textScore: 0.5
	}));
}

/**
 * Ranks and filters candidates based on text relevance, distance, and location bonuses.
 * Returns top FINAL_RESULTS sorted by combined score.
 */
function rankAndFilterCandidates(
	candidates: ScoredCandidate[],
	location: GeoPoint | undefined,
	queryLength: number
): RankedResult[] {
	return candidates
		.map(({ item, textScore }) => {
			const distanceKm = location ? haversineKm(location, item) : undefined;
			const locationBonus = getLocationBonus(item);
			const combinedScore = calculateCombinedScore(
				textScore,
				distanceKm,
				queryLength,
				locationBonus
			);

			return { item, distanceKm, combinedScore };
		})
		.sort((a, b) => a.combinedScore - b.combinedScore)
		.slice(0, SEARCH_LIMITS.FINAL_RESULTS);
}

/**
 * Converts ranked results to the final SearchResult format.
 */
function formatResults(rankedResults: RankedResult[]): SearchResult[] {
	return rankedResults.map(({ item, distanceKm }) => ({
		value: item.gid,
		label: item.place_name ? `${item.stop_name} (${item.place_name})` : item.stop_name,
		placeName: item.place_name,
		stopName: item.stop_name,
		distanceKm
	}));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Searches for stops matching the given query, optionally filtering by distance.
 * Returns up to 9 results ranked by relevance and/or proximity.
 *
 * @param q - Search query (e.g., "Hauptbahnhof")
 * @param location - Optional geographic point to sort by proximity
 * @returns Array of matching stops, ranked by relevance
 */
export async function searchStops(q: string, location?: GeoPoint): Promise<SearchResult[]> {
	const query = normalizeQuery(q);
	const { stops, fuse } = await getSearchIndex();

	// Early exit: no query and no location
	if (query.length < SEARCH_LIMITS.MIN_QUERY_LENGTH && !location) {
		return [];
	}

	const candidates = getCandidates(query, stops, fuse);
	const rankedResults = rankAndFilterCandidates(candidates, location, query.length);
	return formatResults(rankedResults);
}
