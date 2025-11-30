interface DateTime {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: string;
  minute: string;
}

interface ServingLine {
  number: string;
  name: string;
  direction: string;
  delay?: string;
}

interface Departure {
  stopID: string;
  stopName: string;
  countdown: number;
  dateTime: DateTime;
  realDateTime: DateTime;
  servingLine: ServingLine;
}

interface DepartureMinimal {
  lineName: string,
  direction: string,
  inMinutes: number
}

interface ApiResponse {
  departureList: Departure[];
}
