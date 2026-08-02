import type { GeoPoint } from './types';

const EARTH_RADIUS_KM = 6371;
const TO_RAD = Math.PI / 180;

/**
 * Calculates the great-circle distance between two points in kilometers.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
	const dLat = (b.lat - a.lat) * TO_RAD;
	const dLon = (b.lon - a.lon) * TO_RAD;
	const lat1 = a.lat * TO_RAD;
	const lat2 = b.lat * TO_RAD;

	const sinLat = Math.sin(dLat / 2);
	const sinLon = Math.sin(dLon / 2);
	const x = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLon ** 2;

	return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
