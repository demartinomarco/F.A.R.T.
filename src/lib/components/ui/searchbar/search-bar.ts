import { searchStops } from '@/stops-search';
import type { GeoPoint, SearchResult } from '@/stops-search/types';

export function getSelectedStopItem(
	selectedId: string,
	selectedValue: string
): SearchResult | null {
	if (!selectedId) return null;
	return { value: selectedId, label: selectedValue, placeName: '', stopName: '' };
}

export function formatDistance(distanceKm?: number): string {
	if (distanceKm === undefined) return '';
	return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

export async function checkGeolocationPermission(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !('permissions' in navigator)) return false;
	try {
		const permission = await navigator.permissions.query({ name: 'geolocation' });
		return permission.state === 'granted';
	} catch {
		return false;
	}
}

export function getCurrentLocation(cache: boolean = false): Promise<GeoPoint> {
	return new Promise((resolve, reject) => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			reject(new Error('Geolocation unavailable'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
			(err) => reject(err),
			{ maximumAge: cache ? 5 * 60 * 1000 : 0, timeout: 10000 }
		);
	});
}

export async function fetchDefaultStops(
	selectedId: string,
	selectedValue: string,
	clientLocation?: GeoPoint
): Promise<SearchResult[]> {
	const selected = getSelectedStopItem(selectedId, selectedValue);

	if (clientLocation) {
		const nearest = await searchStops('', clientLocation);
		const filteredNearest = nearest.filter((s) => s.value !== selectedId);
		return selected ? [selected, ...filteredNearest] : nearest;
	}

	return selected ? [selected] : [];
}
