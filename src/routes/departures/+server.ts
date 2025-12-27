import type { ApiResponse, Root } from '@/types/departure';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('stationId') ?? '7001003'; // default station
	const api = `https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=${stationId}&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=20`;

	const departures = await getDepartures(api, stationId);

	return new Response(JSON.stringify(departures), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

// const url = 'https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=7001002&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=10';

async function getDepartures(apiUrl: string, stationId: string): Promise<ApiResponse> {
	const response = await fetch(apiUrl);
	const data: Root = await response.json();

	const stations = data.dm?.itdOdvAssignedStops ?? [];
	const station = stations.find((s: any) => s.stopID === stationId);

	const apiResponse: ApiResponse = {
		stationName: station?.name ?? 'Unknown station',
		cityName: station?.place ?? 'Unknown city',
		departureList: data.departureList
			.filter((d: any) => d.stopID === stationId)
			.map((x: any) => ({
				lineName: x.servingLine.number,
				direction: x.servingLine.direction,
				platformName: x.platformName,
				plannedTime: toDate(x.dateTime),
				type: x.servingLine.name,
				realTime: toDate(x.realDateTime)
			}))
			.sort((a, b) => {
				const at = (a.realTime ?? a.plannedTime)?.getTime() ?? Infinity;
				const bt = (b.realTime ?? b.plannedTime)?.getTime() ?? Infinity;
				return at - bt;
			})
	};

	return apiResponse;
}

function toDate(dt: any): Date | null {
	if (!dt?.year || !dt?.month || !dt?.day || !dt?.hour || !dt?.minute) {
		return null;
	}
	return new Date(
		Number(dt.year),
		Number(dt.month) - 1,
		Number(dt.day),
		Number(dt.hour),
		Number(dt.minute)
	);
}
