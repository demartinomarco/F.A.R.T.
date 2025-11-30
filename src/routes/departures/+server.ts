export async function GET() {
	const departures = await getDepartures();

	return new Response(JSON.stringify(departures), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

const url = 'https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=7001002&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=10';

async function getDepartures(): Promise<DepartureMinimal[]> {
        const response = await fetch(url);
        const data: ApiResponse = await response.json();
        return data.departureList.map(x => ({
            lineName: x.servingLine.number,
            direction: x.servingLine.direction,
            inMinutes: x.countdown
        })).sort((a,b) => a.inMinutes - b.inMinutes)
    }