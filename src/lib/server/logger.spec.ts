import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KvvTriasError } from '@/kvv-trias/errors';
import {
	ensureLogFile,
	getLogLimits,
	getLogPaths,
	logAbnormal,
	logTriasFailure,
	type LogLimits,
	type LogPaths
} from './logger';

let dir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

function paths(): LogPaths {
	return {
		logFile: join(dir, 'app.log'),
		dumpDir: join(dir, 'trias')
	};
}

async function readEntries(logFile: string): Promise<Record<string, unknown>[]> {
	const content = await readFile(logFile, 'utf8');
	return content
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}

describe('logger', () => {
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'fart-log-'));
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(async () => {
		consoleSpy.mockRestore();
		consoleInfoSpy.mockRestore();
		await rm(dir, { recursive: true, force: true });
	});

	it('writes abnormal events as JSON lines', async () => {
		const logPaths = paths();

		await logAbnormal(
			{
				event: 'departures.unhandled',
				message: 'Unhandled error',
				context: { stationId: 'de:08212:89' },
				error: new Error('boom'),
				includeStack: true
			},
			logPaths
		);

		const [entry] = await readEntries(logPaths.logFile);

		expect(entry).toMatchObject({
			level: 'error',
			event: 'departures.unhandled',
			message: 'Unhandled error',
			stationId: 'de:08212:89',
			errorMessage: 'boom'
		});
		expect(entry.timestamp).toEqual(expect.any(String));
		expect(entry.errorStack).toContain('Error: boom');
	});

	it('stores the TRIAS response in a dump file', async () => {
		const logPaths = paths();
		const rawResponse = '<Trias><broken /></Trias>';

		await logTriasFailure(
			{
				stationId: 'de:08212:89',
				eventType: 'dep',
				limit: 20,
				category: 'invalid_shape',
				durationMs: 123,
				error: new KvvTriasError({
					code: 'UPSTREAM_INVALID_SHAPE',
					status: 503,
					message: 'Unexpected response'
				}),
				rawResponse
			},
			logPaths
		);

		const [entry] = await readEntries(logPaths.logFile);
		const dumps = await readdir(logPaths.dumpDir);

		expect(entry).toMatchObject({
			event: 'trias.failure',
			stationId: 'de:08212:89',
			category: 'invalid_shape',
			errorCode: 'UPSTREAM_INVALID_SHAPE'
		});
		expect(dumps).toHaveLength(1);
		expect(entry.triasDump).toBe(join(logPaths.dumpDir, dumps[0]));
		expect(await readFile(entry.triasDump as string, 'utf8')).toBe(rawResponse);
	});

	it('extracts the response body from an HTTP error for the dump', async () => {
		const logPaths = paths();

		await logTriasFailure(
			{
				stationId: 'de:08212:89',
				eventType: 'dep',
				limit: 20,
				category: 'http',
				durationMs: 50,
				error: new KvvTriasError({
					code: 'UPSTREAM_HTTP',
					status: 503,
					message: 'Upstream error',
					details: { body: '<Trias><error /></Trias>' }
				})
			},
			logPaths
		);

		const [entry] = await readEntries(logPaths.logFile);
		expect(await readFile(entry.triasDump as string, 'utf8')).toBe('<Trias><error /></Trias>');
	});

	it('creates the log file on startup', async () => {
		const logPaths: LogPaths = {
			logFile: join(dir, 'nested', 'app.log'),
			dumpDir: join(dir, 'nested', 'trias')
		};

		await ensureLogFile(logPaths);

		await expect(readFile(logPaths.logFile, 'utf8')).resolves.toBe('');
	});

	it('rotates the log file when it exceeds the size limit', async () => {
		const logPaths = paths();
		const logLimits: LogLimits = { maxBytes: 10, maxFiles: 2, maxDumps: 5 };

		await logAbnormal({ event: 'first', message: 'first entry' }, logPaths, logLimits);
		await logAbnormal({ event: 'second', message: 'second entry' }, logPaths, logLimits);
		await logAbnormal({ event: 'third', message: 'third entry' }, logPaths, logLimits);

		expect(await readFile(logPaths.logFile, 'utf8')).toContain('third entry');
		expect(await readFile(`${logPaths.logFile}.1`, 'utf8')).toContain('second entry');
	});

	it('keeps only the configured number of TRIAS dumps', async () => {
		const logPaths = paths();
		const logLimits: LogLimits = { maxBytes: 1_000_000, maxFiles: 2, maxDumps: 2 };

		for (let index = 0; index < 3; index += 1) {
			await logTriasFailure(
				{
					stationId: 'de:08212:89',
					eventType: 'dep',
					limit: 20,
					category: 'invalid_shape',
					durationMs: 10,
					error: new Error('invalid response'),
					rawResponse: `<Trias>${index}</Trias>`
				},
				logPaths,
				logLimits
			);
		}

		const dumps = (await readdir(logPaths.dumpDir)).filter((name) => name.endsWith('.xml'));
		expect(dumps).toHaveLength(2);
	});

	it('includes the underlying cause of network errors', async () => {
		const logPaths = paths();
		const cause = Object.assign(new Error('getaddrinfo ENOTFOUND trias.example'), {
			code: 'ENOTFOUND'
		});
		const error = new TypeError('fetch failed', { cause });

		await logAbnormal(
			{
				event: 'trias.failure',
				message: 'network failure',
				error
			},
			logPaths
		);

		const [entry] = await readEntries(logPaths.logFile);
		expect(entry.errorCause).toBe('ENOTFOUND: getaddrinfo ENOTFOUND trias.example');
	});

	it('reads log limits from the environment', () => {
		expect(
			getLogLimits({
				KVV_LOG_MAX_BYTES: '1024',
				KVV_LOG_MAX_FILES: '2',
				KVV_TRIAS_DUMP_MAX_FILES: '3'
			})
		).toEqual({ maxBytes: 1024, maxFiles: 2, maxDumps: 3 });
	});

	it('derives default paths from the configured log file', () => {
		expect(getLogPaths({ KVV_LOG_FILE: '/var/log/fart/app.log' })).toEqual({
			logFile: '/var/log/fart/app.log',
			dumpDir: '/var/log/fart/trias'
		});
	});
});
