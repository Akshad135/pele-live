import { describe, it, expect } from 'vitest';
import { sanitizeColor } from '../src/lib/export';

describe('sanitizeColor', () => {
	it('keeps valid hex and rgb colors', () => {
		expect(sanitizeColor('#161616')).toBe('#161616');
		expect(sanitizeColor('#FFFFFF')).toBe('#ffffff');
		expect(sanitizeColor('rgb(22, 22, 22)')).toBe('rgb(22, 22, 22)');
		expect(sanitizeColor('rgba(22, 22, 22, 0.5)')).toBe('rgba(22, 22, 22, 0.5)');
	});

	it('expands 3-digit hex', () => {
		expect(sanitizeColor('#abc')).toBe('#aabbcc');
	});

	it('falls back on non-plain colors and garbage', () => {
		// var(), color-mix(), empty — things a canvas fillStyle cannot use.
		expect(sanitizeColor('var(--x)')).toBe('#ffffff');
		expect(sanitizeColor('color-mix(in srgb, red, blue)')).toBe('#ffffff');
		expect(sanitizeColor('')).toBe('#ffffff');
		expect(sanitizeColor('not-a-color')).toBe('#ffffff');
		expect(sanitizeColor('var(--x)', '#123456')).toBe('#123456');
	});

	it('rejects out-of-range rgb channels instead of painting black', () => {
		// An invalid fillStyle assignment silently keeps the previous color;
		// anything the canvas would refuse must fall back instead.
		expect(sanitizeColor('rgb(300, 0, 0)')).toBe('#ffffff');
		expect(sanitizeColor('rgb(0, 999, 0)')).toBe('#ffffff');
		expect(sanitizeColor('rgb(1.2.3, 4, 5)')).toBe('#ffffff');
		expect(sanitizeColor('rgb(255, 128, 0)')).toBe('rgb(255, 128, 0)');
	});
});
