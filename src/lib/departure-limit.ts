/**
 * TRIAS has to be asked for more results than the caller wants because the
 * backend merges cross-feed duplicates and removes duplicate StopEvents after
 * the response arrives. Doubling the requested amount leaves enough unique
 * departures to fill the requested limit in the common case.
 */
export function getUpstreamDepartureResultCount(limit: number): number {
	return limit * 2;
}
