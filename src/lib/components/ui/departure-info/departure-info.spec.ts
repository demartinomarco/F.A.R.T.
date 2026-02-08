import { describe, it, expect } from 'vitest';
import { delayMinutes, delayLabel } from './departure-info';

describe('delay test', () => {
	it('calculates positive delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:00:00'),
			plannedTime: new Date('2024-06-01T11:58:00')
		};
		
		expect(delayMinutes(departure)).toBe(2);
	});
	
	it('calculates negative delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:00:00'),
			plannedTime: new Date('2024-06-01T12:05:00')
		};
		
		expect(delayMinutes(departure)).toBe(-5);
	});
	
	it('rounds up delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:05:30'),
			plannedTime: new Date('2024-06-01T12:00:00')
		};
		
		expect(delayMinutes(departure)).toBe(6);
	});
	
	it('rounds down delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:05:29'),
			plannedTime: new Date('2024-06-01T12:00:00')
		};
		
		expect(delayMinutes(departure)).toBe(5);
	});
});

describe('label test', () => {
	it('calculates positive delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:00:00'),
			plannedTime: new Date('2024-06-01T11:58:00')
		};
		const now = new Date('2024-06-01T11:59:00');
		
		expect(delayLabel(departure, now)).toBe("(Sofort)");
	});
	
	it('calculates negative delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:00:00'),
			plannedTime: new Date('2024-06-01T12:05:00')
		};
		
		expect(delayMinutes(departure)).toBe(-5);
	});
	
	it('rounds up delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:05:30'),
			plannedTime: new Date('2024-06-01T12:00:00')
		};
		
		expect(delayMinutes(departure)).toBe(6);
	});
	
	it('rounds down delay', () => {
		const departure = {
			realTime: new Date('2024-06-01T12:05:29'),
			plannedTime: new Date('2024-06-01T12:00:00')
		};
		
		expect(delayMinutes(departure)).toBe(5);
	});
});
