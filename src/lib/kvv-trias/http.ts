import { KvvTriasError } from './errors';

export async function postXml(url: string, xml: string, timeoutMs = 10_000): Promise<string> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/xml; charset=UTF-8',
				Accept: 'application/xml'
			},
			body: xml,
			signal: controller.signal
		});

		if (!res.ok) {
			const body = await safeReadText(res);
			throw new KvvTriasError({
				code: 'UPSTREAM_HTTP',
				status: 503, // upstream not healthy (or use 502 if you prefer)
				message: `KVV TRIAS upstream error: ${res.status} ${res.statusText}`,
				details: { upstreamStatus: res.status, upstreamStatusText: res.statusText, body }
			});
		}

		return await res.text();
	} catch (e: any) {
		// AbortController -> timeout
		if (e?.name === 'AbortError') {
			throw new KvvTriasError({
				code: 'UPSTREAM_TIMEOUT',
				status: 503,
				message: 'KVV TRIAS timed out'
			});
		}
		throw e;
	} finally {
		clearTimeout(timeout);
	}
}

async function safeReadText(res: Response): Promise<string> {
	try {
		return await res.text();
	} catch {
		return '';
	}
}
