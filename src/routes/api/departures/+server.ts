import type { ApiResponse, DateTime, DepartureList, Root } from '@/types/departure';
import type { RequestHandler } from '@sveltejs/kit';
import { DateTime as LuxonDT } from "luxon";

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('stationId') ?? '7001003'; // default station
	const api = `https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=${stationId}&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=100`;

	const departures = await getDepartures(api);

	return new Response(JSON.stringify(departures), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

// const url = 'https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST?outputFormat=JSON&coordOutputFormat=WGS84[dd.ddddd]&depType=stopEvents&locationServerActive=1&mode=direct&name_dm=7001002&type_dm=stop&useOnlyStops=1&useRealtime=1&limit=10';

async function getDepartures(apiUrl: string): Promise<ApiResponse> {
	const response = await fetch(apiUrl);
	const data: Root = await response.json();

	const station = data.dm?.points?.point;

	return {
		stationName: station?.name ?? '',
		cityName: station?.ref.place ?? '',
		departureList: (data.departureList ?? [])
			.map((x: DepartureList) => ({
				lineName: x.servingLine.number,
				direction: x.servingLine.direction,
				platformName: x.platformName,
				plannedTime: toDateCET(x.dateTime),
				type: x.servingLine.name,
				realTime: toDateNullable(x.realDateTime)
			}))
			.sort((a, b) => {
				const at = (a.realTime ?? a.plannedTime)?.getTime() ?? Infinity;
				const bt = (b.realTime ?? b.plannedTime)?.getTime() ?? Infinity;
				return at - bt;
			})
	};
}


function toDateCET(dt: DateTime): Date {
  return LuxonDT.fromObject(
    {
      year: Number(dt.year),
      month: Number(dt.month),
      day: Number(dt.day),
      hour: Number(dt.hour),
      minute: Number(dt.minute)
    },
    { zone: "Europe/Berlin" }
  ).toJSDate();
}

function toDateNullable(dt: DateTime): Date | null {
	if (!dt?.year || !dt?.month || !dt?.day || !dt?.hour || !dt?.minute) {
		return null;
	}
	return toDateCET(dt);
}
