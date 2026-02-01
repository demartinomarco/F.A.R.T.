import type { ApiResponse, DateTime, DepartureList, Root } from '@/types/departure';
import { DateTime as LuxonDT } from 'luxon';

const DEPARTURES_API_URL = 'https://projekte.kvv-efa.de/sl3-alone/XSLT_DM_REQUEST';

export async function getDeparturesLib(
	stationId: string,
	eventType: 'dep' | 'arr',
	limit: number = 20
): Promise<ApiResponse> {
	const requestUrl = new URL(DEPARTURES_API_URL);

	requestUrl.searchParams.append('outputFormat', 'JSON'); // IMPORTANT:
	requestUrl.searchParams.append('name_dm', stationId); // IMPORTANT:
	requestUrl.searchParams.append('mode', 'direct'); // IMPORTANT: without this, only serving lines are returned, no departures
	requestUrl.searchParams.append('type_dm', 'stop'); // IMPORTANT: can be 'any' or 'stop'. 'any' changes the points.point object a bit. Without this parameter servingLines and departureList are null
	requestUrl.searchParams.append('useRealtime', '1'); // IMPORTANT: without this, realTimeDate is still present, but shows less accurate arrival times
	requestUrl.searchParams.append('itdDateTimeDepArr', eventType); // 'dep' or 'arr', decides whether departures or arrivals are returned
	requestUrl.searchParams.append('limit', String(limit)); // Limits the number of departures shown
	requestUrl.searchParams.append('coordOutputFormat', 'WGS84[dd.ddddd]'); // formats the coordinates of the stop
	requestUrl.searchParams.append('depType', 'stopEvents'); // without this, the destID in servinLine in the departures in departuresList is sometimes -1
	requestUrl.searchParams.append('locationServerActive', '1'); // doesn't seem to make a difference
	requestUrl.searchParams.append('useOnlyStops', '1'); // doesn't seem to make a difference

	const response = await fetch(requestUrl);
	const data: Root = await response.json();

	const station = data.dm?.points?.point;
	const effStationId = station.ref?.id;

	return {
		stationName: station?.name ?? '',
		cityName: station?.ref.place ?? '',
		departureList: (data.departureList ?? data.arrivalList)
			.filter((d: DepartureList) => d.stopID === effStationId)
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
		{ zone: 'Europe/Berlin' }
	).toJSDate();
}

function toDateNullable(dt: DateTime): Date | null {
	if (!dt?.year || !dt?.month || !dt?.day || !dt?.hour || !dt?.minute) {
		return null;
	}
	return toDateCET(dt);
}
