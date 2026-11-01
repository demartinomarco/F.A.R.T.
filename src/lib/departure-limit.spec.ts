import { describe, expect, it } from 'vitest';
import { getUpstreamDepartureResultCount } from './departure-limit';

describe('getUpstreamDepartureResultCount', () => {
	it('asks upstream for twice the requested number of departures', () => {
		expect(getUpstreamDepartureResultCount(3)).toBe(6);
		expect(getUpstreamDepartureResultCount(20)).toBe(40);
	});
});
