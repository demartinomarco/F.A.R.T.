import { getSearchIndex } from './indexer';
import { haversineKm } from './geo';
import type { GeoPoint, SearchResult, ScoredCandidate } from './types';

const CONFIG = {
	FUZZY_LIMIT: 50,
	FINAL_LIMIT: 9,
	DIST_WEIGHT: 0.5,
	KARLSRUHE_BONUS: 0.08,
	NORM_DIST_KM: 25
};

export function normalizeQuery(q: string): string {
	return q.trim().replace(/\s+/g, ' ');
}

function scoreCandidate(candidate: ScoredCandidate, location?: GeoPoint, hasQuery = true) {
	const { item, textScore } = candidate;
	const distanceKm = location ? haversineKm(location, item) : undefined;
	const distScore = distanceKm ? Math.min(distanceKm / CONFIG.NORM_DIST_KM, 1) : 0;

	if (!hasQuery) {
		return { item, distanceKm, combinedScore: distScore };
	}

	const isKarlsruhe = item.place_name?.toLowerCase() === 'karlsruhe';
	const bonus = isKarlsruhe ? CONFIG.KARLSRUHE_BONUS : 0;
	const combinedScore = textScore + distScore * CONFIG.DIST_WEIGHT - bonus;

	return { item, distanceKm, combinedScore };
}

export async function searchStops(q: string, location?: GeoPoint): Promise<SearchResult[]> {
	const query = normalizeQuery(q);
	const { stops, haystack, uf } = await getSearchIndex();

	if (!query && !location) return [];

	let candidates: ScoredCandidate[] = [];

	if (query) {
		const [idxs, , order] = uf.search(haystack, query);
		if (idxs && idxs.length > 0) {
			const limit = Math.min(order ? order.length : idxs.length, CONFIG.FUZZY_LIMIT);
			for (let i = 0; i < limit; i++) {
				const idx = order ? idxs[order[i]] : idxs[i];
				candidates.push({
					item: stops[idx],
					textScore: 0.05 + (i / limit) * 0.35
				});
			}
		}
	} else {
		candidates = stops.map((item) => ({ item, textScore: 0.5 }));
	}

	return candidates
		.map((c) => scoreCandidate(c, location, Boolean(query)))
		.sort((a, b) => a.combinedScore - b.combinedScore)
		.slice(0, CONFIG.FINAL_LIMIT)
		.map(({ item, distanceKm }) => ({
			value: item.gid,
			label: item.place_name ? `${item.stop_name} (${item.place_name})` : item.stop_name,
			placeName: item.place_name,
			stopName: item.stop_name,
			distanceKm
		}));
}
