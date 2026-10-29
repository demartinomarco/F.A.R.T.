import { XMLParser } from 'fast-xml-parser';
import { KvvTriasError } from './errors';

export function parseTriasXml(xml: string): unknown {
	try {
		const parser = new XMLParser({
			ignoreAttributes: false,
			removeNSPrefix: true,
			isArray: (name) => ARRAYS.has(name)
		});

		return parser.parse(xml);
	} catch (e) {
		throw new KvvTriasError({
			code: 'UPSTREAM_INVALID_XML',
			status: 503,
			message: 'KVV TRIAS returned invalid XML',
			details: { cause: e instanceof Error ? e.message : String(e) }
		});
	}
}

// Elements that may appear zero, one, or many times on the same level.
// Listing them here makes fast-xml-parser always produce arrays for them.
// Singleton/optional wrappers are handled with collectNodes() at map time.
const ARRAYS = new Set([
	'StopEventResult',
	'PtSituation',
	'SituationFullRef',
	'ErrorMessage',
	'Attribute',
	'AffectedStopPoint',
	'AffectedVehicleJourney'
]);

export function extractStopEventResults(doc: unknown): any[] {
	const root = asObject(doc);
	const trias = root?.Trias;

	// If the upstream shape changes, fail “softly” but explicitly
	if (!trias || typeof trias !== 'object') {
		throw new KvvTriasError({
			code: 'UPSTREAM_INVALID_SHAPE',
			status: 503,
			message: 'KVV TRIAS response shape unexpected'
		});
	}

	const results = (trias as any)?.ServiceDelivery?.DeliveryPayload?.StopEventResponse
		?.StopEventResult;

	if (Array.isArray(results)) return results;
	if (results) return [results];
	return [];
}

function asObject(x: unknown): any | null {
	return x && typeof x === 'object' ? (x as any) : null;
}

/** All PtSituation nodes of a StopEventResponse, in delivered order. */
export function extractSituationNodes(doc: unknown): unknown[] {
	const node = asObject(doc)?.Trias?.ServiceDelivery?.DeliveryPayload?.StopEventResponse
		?.StopEventResponseContext?.Situations?.PtSituation;

	return collectNodes(node);
}

/** All ErrorMessage nodes. Present e.g. when a stop is not served (-4030). */
export function extractErrorMessages(doc: unknown): unknown[] {
	const payload = asObject(doc)?.Trias?.ServiceDelivery?.DeliveryPayload;

	const fromStopEventResponse = payload?.StopEventResponse?.ErrorMessage;
	const fromServiceDelivery = payload?.ServiceDelivery?.ErrorMessage;

	return [...collectNodes(fromStopEventResponse), ...collectNodes(fromServiceDelivery)];
}

/**
 * Turns a potentially-missing/singleton/array node into a flat array.
 * fast-xml-parser returns objects for single elements, arrays for repeated ones.
 */
export function collectNodes(node: unknown): unknown[] {
	if (node == null) return [];
	return Array.isArray(node) ? node : [node];
}
