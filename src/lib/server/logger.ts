import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { isKvvTriasError } from '@/kvv-trias/errors';

export type LogPaths = {
	logFile: string;
	dumpDir: string;
};

export type LogLimits = {
	maxBytes: number;
	maxFiles: number;
	maxDumps: number;
};

export const DEFAULT_LOG_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_LOG_MAX_FILES = 5;
export const DEFAULT_TRIAS_DUMP_MAX_FILES = 50;

export function getLogPaths(source: Record<string, string | undefined> = env): LogPaths {
	const logFile = source.KVV_LOG_FILE || 'logs/app.log';

	return {
		logFile,
		dumpDir: source.KVV_TRIAS_DUMP_DIR || join(dirname(logFile), 'trias')
	};
}

export function getLogLimits(source: Record<string, string | undefined> = env): LogLimits {
	return {
		maxBytes: parsePositiveInteger(source.KVV_LOG_MAX_BYTES, DEFAULT_LOG_MAX_BYTES),
		maxFiles: parsePositiveInteger(source.KVV_LOG_MAX_FILES, DEFAULT_LOG_MAX_FILES),
		maxDumps: parsePositiveInteger(source.KVV_TRIAS_DUMP_MAX_FILES, DEFAULT_TRIAS_DUMP_MAX_FILES)
	};
}

/** Creates the log file on startup so its location is predictable. */
export async function ensureLogFile(paths: LogPaths = getLogPaths()): Promise<void> {
	try {
		await mkdir(dirname(paths.logFile), { recursive: true });
		await appendFile(paths.logFile, '', { encoding: 'utf8', mode: 0o600 });
		console.info(`[logger] Abnormal events: ${resolve(paths.logFile)}`);
	} catch (e) {
		console.error('[logger] Failed to initialize abnormal log:', e);
	}
}

type AbnormalEvent = {
	level?: 'warn' | 'error';
	event: string;
	message: string;
	context?: Record<string, unknown>;
	error?: unknown;
	includeStack?: boolean;
};

export async function logAbnormal(
	event: AbnormalEvent,
	paths: LogPaths = getLogPaths(),
	limits: LogLimits = getLogLimits()
): Promise<void> {
	await writeEntry(
		paths.logFile,
		{
			...event.context,
			timestamp: new Date().toISOString(),
			level: event.level ?? 'error',
			event: event.event,
			message: event.message,
			...errorFields(event.error, event.includeStack ?? false)
		},
		limits
	);
}

export type TriasFailure = {
	stationId: string;
	eventType: 'dep' | 'arr';
	limit: number;
	category: string;
	durationMs: number;
	error: unknown;
	rawResponse?: string;
};

export async function logTriasFailure(
	failure: TriasFailure,
	paths: LogPaths = getLogPaths(),
	limits: LogLimits = getLogLimits()
): Promise<void> {
	const rawResponse = failure.rawResponse ?? extractResponseBody(failure.error);
	let triasDump: string | undefined;
	let triasDumpError: string | undefined;

	if (rawResponse !== undefined) {
		try {
			triasDump = await writeTriasDump(rawResponse, paths.dumpDir);
		} catch (e) {
			triasDumpError = errorMessage(e);
		}

		if (triasDump) {
			await pruneDumps(paths.dumpDir, limits.maxDumps).catch((e) => {
				console.error('[logger] Failed to prune TRIAS dumps:', e);
			});
		}
	}

	await writeEntry(
		paths.logFile,
		{
			timestamp: new Date().toISOString(),
			level: 'error',
			event: 'trias.failure',
			message: `TRIAS ${failure.category} failure`,
			stationId: failure.stationId,
			eventType: failure.eventType,
			limit: failure.limit,
			category: failure.category,
			durationMs: failure.durationMs,
			...(triasDump ? { triasDump } : {}),
			...(triasDumpError ? { triasDumpError } : {}),
			...errorFields(failure.error, false)
		},
		limits
	);
}

let writeQueue: Promise<void> = Promise.resolve();

async function writeEntry(
	logFile: string,
	entry: Record<string, unknown>,
	limits: LogLimits
): Promise<void> {
	const line = JSON.stringify(entry);

	await enqueue(async () => {
		try {
			await mkdir(dirname(logFile), { recursive: true });
			await rotateLog(logFile, limits);
			await appendFile(logFile, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
		} catch (e) {
			console.error('[logger] Failed to write abnormal log:', e);
		}
	});

	if (entry.level === 'warn') {
		console.warn(line);
	} else {
		console.error(line);
	}
}

function enqueue(task: () => Promise<void>): Promise<void> {
	const next = writeQueue.then(task);
	writeQueue = next.catch(() => {});
	return next;
}

async function rotateLog(logFile: string, limits: LogLimits): Promise<void> {
	try {
		const info = await stat(logFile);
		if (info.size < limits.maxBytes) return;
	} catch {
		return;
	}

	await removeFile(`${logFile}.${limits.maxFiles}`);
	for (let index = limits.maxFiles - 1; index >= 1; index -= 1) {
		await moveFile(`${logFile}.${index}`, `${logFile}.${index + 1}`);
	}
	await moveFile(logFile, `${logFile}.1`);
}

async function moveFile(from: string, to: string): Promise<void> {
	try {
		await rename(from, to);
	} catch (e) {
		if (!isMissingFile(e)) throw e;
	}
}

async function removeFile(file: string): Promise<void> {
	try {
		await unlink(file);
	} catch (e) {
		if (!isMissingFile(e)) throw e;
	}
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function writeTriasDump(rawResponse: string, dumpDir: string): Promise<string> {
	await mkdir(dumpDir, { recursive: true });

	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const file = join(dumpDir, `${stamp}-${randomUUID()}.xml`);
	await writeFile(file, rawResponse, { encoding: 'utf8', mode: 0o600 });

	return file;
}

async function pruneDumps(dumpDir: string, maxDumps: number): Promise<void> {
	const files = (await readdir(dumpDir)).filter((name) => name.endsWith('.xml')).sort();
	const excess = files.length - maxDumps;

	for (let index = 0; index < excess; index += 1) {
		await removeFile(join(dumpDir, files[index]));
	}
}

function extractResponseBody(error: unknown): string | undefined {
	if (!isKvvTriasError(error)) return undefined;

	const details = error.details as { body?: unknown } | undefined;
	return typeof details?.body === 'string' && details.body.length > 0 ? details.body : undefined;
}

function errorFields(error: unknown, includeStack: boolean): Record<string, unknown> {
	if (error === undefined) return {};
	if (!(error instanceof Error)) return { errorMessage: String(error) };

	return {
		errorName: error.name,
		errorMessage: error.message,
		...(error.cause !== undefined ? { errorCause: describeCause(error.cause) } : {}),
		...(isKvvTriasError(error) ? { errorCode: error.code } : {}),
		...(includeStack && error.stack ? { errorStack: error.stack } : {})
	};
}

function describeCause(cause: unknown): string {
	if (!(cause instanceof Error)) return String(cause);

	const code = (cause as NodeJS.ErrnoException).code;
	return code ? `${code}: ${cause.message}` : `${cause.name}: ${cause.message}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
	if (!value) return fallback;

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
