import { describe, it, expect } from 'vitest';
import { PolyforgeClient } from '../client';
import { PolyforgeError } from '../errors';
import { KNOWN_STRATEGY_EVENTS } from '../types';

describe('PolyforgeClient', () => {
  describe('constructor', () => {
    it('should instantiate with valid apiKey', () => {
      const client = new PolyforgeClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use default baseUrl when not provided', () => {
      const client = new PolyforgeClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use custom baseUrl when provided', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com/',
      });
      expect(client).toBeDefined();
    });

    it('should use custom timeout when provided', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        timeout: 30000,
      });
      expect(client).toBeDefined();
    });

    it('should throw error when apiKey is missing', () => {
      expect(() => {
        new PolyforgeClient({ apiKey: '' });
      }).toThrow('apiKey is required');
    });

    it('should throw error when apiKey is not provided', () => {
      expect(() => {
        new PolyforgeClient({ apiKey: undefined as any });
      }).toThrow('apiKey is required');
    });
  });

  describe('URL construction', () => {
    it('should normalize baseUrl by removing trailing slashes', () => {
      const clientWithSlash = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'http://localhost:3002///',
      });
      expect(clientWithSlash).toBeDefined();
    });

    it('should handle URL paths correctly', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com',
      });
      expect(client).toBeDefined();
    });
  });

  describe('HTTPS enforcement', () => {
    it('should reject HTTP for non-local hosts', () => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: 'http://api.example.com' }))
        .toThrow('Non-localhost API URLs must use HTTPS');
    });

    it.each([
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://127.0.0.2:3002',
      'http://0.0.0.0:3002',
      'http://[::1]:3002',
      'http://localhost.localdomain:3002',
    ])('should allow HTTP for local address %s', (url) => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: url })).not.toThrow();
    });

    it('should allow HTTPS for any host', () => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: 'https://api.example.com' }))
        .not.toThrow();
    });
  });
});

describe('PolyforgeError', () => {
  describe('constructor', () => {
    it('should create error with all parameters', () => {
      const error = new PolyforgeError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: 'req-123',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PolyforgeError');
      expect(error.message).toBe('Resource not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.requestId).toBe('req-123');
    });

    it('should create error without requestId', () => {
      const error = new PolyforgeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });

      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.requestId).toBeUndefined();
    });

    it('should have correct error name', () => {
      const error = new PolyforgeError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Bad request',
      });

      expect(error.name).toBe('PolyforgeError');
    });

    it('should have stack trace', () => {
      const error = new PolyforgeError({
        status: 500,
        code: 'ERROR',
        message: 'Test error',
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('PolyforgeError');
    });
  });

  describe('error types', () => {
    it('should handle 401 Unauthorized', () => {
      const error = new PolyforgeError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      });

      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should handle 429 Rate Limit', () => {
      const error = new PolyforgeError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      });

      expect(error.status).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
    });

    it('should handle 503 Service Unavailable', () => {
      const error = new PolyforgeError({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable',
      });

      expect(error.status).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('KNOWN_STRATEGY_EVENTS', () => {
    it('should contain all documented event types', () => {
      const expected = [
        'CONNECTED', 'STRATEGY_STARTED', 'STRATEGY_STOPPED',
        'STRATEGY_PAUSED', 'STRATEGY_RESUMED', 'STRATEGY_ERROR',
        'ORDER_PLACED', 'ORDER_SUBMITTED', 'ORDER_FILLED',
        'ORDER_PARTIAL', 'ORDER_CANCELLED', 'ORDER_FAILED', 'ORDER_ERROR',
        'BACKTEST_PROGRESS', 'BACKTEST_COMPLETED', 'BACKTEST_FAILED',
      ];
      for (const type of expected) {
        expect(KNOWN_STRATEGY_EVENTS.has(type)).toBe(true);
      }
      expect(KNOWN_STRATEGY_EVENTS.size).toBe(expected.length);
    });

    it('should not contain unknown event types', () => {
      expect(KNOWN_STRATEGY_EVENTS.has('UNKNOWN_TYPE')).toBe(false);
      expect(KNOWN_STRATEGY_EVENTS.has('')).toBe(false);
    });
  });
});
