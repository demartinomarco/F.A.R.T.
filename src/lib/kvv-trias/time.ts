import { DateTime as LuxonDT } from 'luxon';

const BERLIN_TZ = 'Europe/Berlin';

export function nowBerlinIso(): string {
	return (
		LuxonDT.now()
			.setZone(BERLIN_TZ)
			.toISO({ suppressMilliseconds: true }) ?? ''
	);
}

export function utcIsoToBerlinDate(iso: string | undefined): Date | null {
	if (!iso) return null;
	const dt = LuxonDT.fromISO(iso, { zone: 'utc' }).setZone(BERLIN_TZ);
	return dt.isValid ? dt.toJSDate() : null;
}

export function nowUtcIso(): string {
	return LuxonDT.now().toUTC().toISO({ suppressMilliseconds: true }) ?? '';
}
