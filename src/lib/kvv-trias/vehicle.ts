// Which vehicle a line actually runs on — shared by the badge colours
// (src/lib/styles/lines.ts), the sidebar sort order and the vehicle icon, so a
// line cannot be a bus in one of them and a train in another.
//
// `vehicleType` carries whatever TRIAS sent: `Mode/PtMode` (`tram`, `rail`,
// `bus`) or, when the mode is missing, the free-text `Mode/Name`, which is full
// of the German spellings (`Stadtbus`, `Regionalbus`).

const BUS_VEHICLE_TYPES = new Set(['bus', 'regionalbus', 'stadtbus']);

// Rail replacement (Schienenersatzverkehr): KVV publishes it as `SEV <line>`
// ("SEV S4", "SEV RB74", "SEV 721"). It runs on rubber tyres, but TRIAS keeps
// the mode of the replaced line and the static dataset follows that feed, so
// the mode says `rail` — the published name is the only thing left that says
// which vehicle actually runs. Matched as a word of its own in either position
// ("S4 SEV"), optionally followed by the replaced line ("SEV721", "SEV-Halt"),
// which keeps `SEVAS`-style names out.
const REPLACEMENT_BUS = /(^|\s)SEV(?=$|[\s/\-0-9])/i;

export function isBusVehicleType(vehicleType: string): boolean {
	return BUS_VEHICLE_TYPES.has(vehicleType.trim().toLowerCase());
}

export function isReplacementBus(lineName: string): boolean {
	return REPLACEMENT_BUS.test(lineName);
}

/** Whether to treat this line as a bus: mode says so, or it is a rail replacement. */
export function isBusLike(lineName: string, vehicleType: string): boolean {
	return isReplacementBus(lineName) || isBusVehicleType(vehicleType);
}
