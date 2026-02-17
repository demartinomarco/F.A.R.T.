import { KVV_TRIAS_API_URL, KVV_TRIAS_REQUESTOR_REF } from '$env/static/private';

export function getKvvTriasConfig() {
	if (!KVV_TRIAS_API_URL) throw new Error('Missing env var: KVV_TRIAS_API_URL');
	if (!KVV_TRIAS_REQUESTOR_REF) throw new Error('Missing env var: KVV_TRIAS_REQUESTOR_REF');

	return {
		apiUrl: KVV_TRIAS_API_URL,
		requestorRef: KVV_TRIAS_REQUESTOR_REF
	};
}
