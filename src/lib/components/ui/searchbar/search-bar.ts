export async function searchStops(q: string) {
	if (q.length < 2) {
		return [];
	}

	const res = await fetch(`/api/stops?name=${q}`);
	return await res.json();
}