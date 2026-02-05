import { stopsIdNameMap } from '@/server/stops-search.server';
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

	// Non-existing stop
	if (data.dm?.points == null) {
		return {
			stationName: '',
			cityName: '',
			departureList: []
		};
	}

	const effStationId = data.dm?.points?.point.ref?.id;

	const station = stopsIdNameMap.get(stationId ?? '') ?? { place_name: '', stop_name: '' };
	const stationName = station.place_name
		? `${station.stop_name} (${station.place_name})`
		: station.stop_name;

	// Stop exists but has no departures or arrivals
  if (data.departureList == null && data.arrivalList == null) {
    return {
      stationName: stationName,
      cityName: station.place_name,
      departureList: []
    };
  }

	return {
		stationName: stationName,
		cityName: station.place_name,
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
