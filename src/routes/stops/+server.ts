import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get("name") ?? "";
	const api = `https://www.kvv.de/tunnelEfaDirect.php?action=XSLT_STOPFINDER_REQUEST&coordOutputFormat=WGS84%5Bdd.ddddd%5D&name_sf=${query}&outputFormat=JSON&type_sf=any&std3_suggestMacro=std3_suggest&std3_pageMacro=dm`;

	const res = await fetch(api);
	const data = await res.json();

	const rawPoints = data.stopFinder?.points;

	// Normalize to array:
	const pointsArray = Array.isArray(rawPoints)
		? rawPoints
		: rawPoints?.point
			? [rawPoints.point]
			: rawPoints
				? [rawPoints]
				: [];

	const stops = pointsArray
		.filter((entry: { anyType: string }) => entry.anyType === "stop")
		.sort((a, b) => Number(b.quality) - Number(a.quality))
		.slice(0, 9)
		.map((p: any) => ({
			value: p.stateless,
			label: p.name
		}));
	console.log(stops);
	return new Response(JSON.stringify(stops), {
		headers: { 'Content-Type': 'application/json' }
	});
};
