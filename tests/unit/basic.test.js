import { describe, it, expect } from 'vitest';

describe('Simple Math Test', () => {
    it('should add numbers correctly', () => {
        expect(1 + 1).toBe(2);
    });
});

describe('Sanitization Logic (Simulated)', () => {
    const sanitize = (str) => str.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "").trim();

    it('should remove script tags', () => {
        const input = '<script>alert("xss")</script>  Hello  ';
        expect(sanitize(input)).toBe('Hello');
    });
});
