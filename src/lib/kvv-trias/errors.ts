export type KvvTriasErrorCode =
	| 'BAD_PARAMS'
	| 'UPSTREAM_TIMEOUT'
	| 'UPSTREAM_HTTP'
	| 'UPSTREAM_INVALID_XML'
	| 'UPSTREAM_INVALID_SHAPE'
	| 'INTERNAL';

export class KvvTriasError extends Error {
	code: KvvTriasErrorCode;
	status: number;
	details?: unknown;

	constructor(args: { code: KvvTriasErrorCode; message: string; status: number; details?: unknown }) {
		super(args.message);
		this.name = 'KvvTriasError';
		this.code = args.code;
		this.status = args.status;
		this.details = args.details;
	}
}

export function isKvvTriasError(e: unknown): e is KvvTriasError {
	return e instanceof Error && (e as any).name === 'KvvTriasError';
}
