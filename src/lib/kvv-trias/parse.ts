import { XMLParser } from 'fast-xml-parser';
import { KvvTriasError } from './errors';

export function parseTriasXml(xml: string): unknown {
	try {
		const parser = new XMLParser({
			ignoreAttributes: false,
			removeNSPrefix: true,
			isArray: (name) => name === 'StopEventResult'
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

	const results =
		(trias as any)?.ServiceDelivery?.DeliveryPayload?.StopEventResponse?.StopEventResult;

	if (Array.isArray(results)) return results;
	if (results) return [results];
	return [];
}

function asObject(x: unknown): any | null {
	return x && typeof x === 'object' ? (x as any) : null;
}
