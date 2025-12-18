import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get("stationId") ?? "7001003"; // default station
	const api =
		`https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=${stationId}&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=10`;

	const departures = await getDepartures(api);

	return new Response(JSON.stringify(departures), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

// const url = 'https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=7001002&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=10';

async function getDepartures(url: string): Promise<DepartureMinimal[]> {
        const response = await fetch(url);
        const data: ApiResponse = await response.json();
        return data.departureList.map(x => ({
            lineName: x.servingLine.number,
            direction: x.servingLine.direction,
            inMinutes: x.countdown
        })).sort((a,b) => a.inMinutes - b.inMinutes)
    }