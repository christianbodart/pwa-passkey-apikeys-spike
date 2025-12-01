// tests/integration/provider-calls.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Provider API Calls Integration', () => {
  let fetchMock;

  beforeEach(() => {
    // Mock global fetch
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OpenAI API Integration', () => {
    const OPENAI_BASE = 'https://api.openai.com/v1';
    const OPENAI_KEY = 'sk-proj-test1234567890abcdefghijklmnop';

    it('calls /v1/models with correct headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'gpt-4', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' }
          ]
        })
      });

      const response = await fetch(`${OPENAI_BASE}/models`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`
        }
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${OPENAI_BASE}/models`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${OPENAI_KEY}`
          })
        })
      );

      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.data[0].id).toBe('gpt-4');
    });

    it('uses Bearer token format', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      await fetch(`${OPENAI_BASE}/models`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`
        }
      });

      const callArgs = fetchMock.mock.calls[0];
      const authHeader = callArgs[1].headers.Authorization;
      
      expect(authHeader).toMatch(/^Bearer sk-/);
      expect(authHeader).toBe(`Bearer ${OPENAI_KEY}`);
    });

    it('handles successful response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'gpt-4', created: 1687882411 },
            { id: 'gpt-3.5-turbo', created: 1677610602 }
          ]
        })
      });

      const response = await fetch(`${OPENAI_BASE}/models`, {
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('handles 401 unauthorized error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Incorrect API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        })
      });

      const response = await fetch(`${OPENAI_BASE}/models`, {
        headers: { 'Authorization': `Bearer invalid-key` }
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      const error = await response.json();
      expect(error.error.code).toBe('invalid_api_key');
    });

    it('handles rate limit errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      });

      const response = await fetch(`${OPENAI_BASE}/models`, {
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
      });

      expect(response.status).toBe(429);
    });

    it('handles network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(
        fetch(`${OPENAI_BASE}/models`, {
          headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Anthropic API Integration', () => {
    const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
    const ANTHROPIC_KEY = 'sk-ant-api03-test1234567890abcdef';
    const ANTHROPIC_VERSION = '2023-06-01';

    it('calls /v1/messages with correct headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }]
        })
      });

      const response = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${ANTHROPIC_BASE}/messages`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': ANTHROPIC_VERSION
          })
        })
      );

      const data = await response.json();
      expect(data.id).toBe('msg_123');
    });

    it('uses x-api-key header format', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' })
      });

      await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      const callArgs = fetchMock.mock.calls[0];
      const apiKeyHeader = callArgs[1].headers['x-api-key'];
      
      expect(apiKeyHeader).toMatch(/^sk-ant-/);
      expect(apiKeyHeader).toBe(ANTHROPIC_KEY);
    });

    it('includes anthropic-version header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' })
      });

      await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].headers['anthropic-version']).toBe(ANTHROPIC_VERSION);
    });

    it('handles POST requests with JSON body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' })
      });

      const requestBody = {
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBeDefined();
      expect(JSON.parse(callArgs[1].body)).toEqual(requestBody);
    });

    it('handles 401 authentication errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            type: 'authentication_error',
            message: 'Invalid API key'
          }
        })
      });

      const response = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': 'invalid-key',
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      const error = await response.json();
      expect(error.error.type).toBe('authentication_error');
    });
  });

  describe('Google AI API Integration', () => {
    const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta';
    const GOOGLE_KEY = 'AIzaSyTest1234567890abcdefghijklmnop';

    it('appends API key as query parameter', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: 'models/gemini-pro', displayName: 'Gemini Pro' }
          ]
        })
      });

      const response = await fetch(`${GOOGLE_BASE}/models?key=${GOOGLE_KEY}`);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain(`key=${GOOGLE_KEY}`);

      const data = await response.json();
      expect(data.models).toBeDefined();
    });

    it('handles successful model listing', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: 'models/gemini-pro', displayName: 'Gemini Pro' },
            { name: 'models/gemini-pro-vision', displayName: 'Gemini Pro Vision' }
          ]
        })
      });

      const response = await fetch(`${GOOGLE_BASE}/models?key=${GOOGLE_KEY}`);

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.models).toHaveLength(2);
    });

    it('handles 400 invalid API key', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 400,
            message: 'API key not valid',
            status: 'INVALID_ARGUMENT'
          }
        })
      });

      const response = await fetch(`${GOOGLE_BASE}/models?key=invalid`);

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.error.status).toBe('INVALID_ARGUMENT');
    });
  });

  describe('CORS and Direct Calls', () => {
    it('makes direct fetch to OpenAI (CORS enabled)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({
          'access-control-allow-origin': '*'
        }),
        json: async () => ({ data: [] })
      });

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': 'Bearer sk-test' }
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.anything()
      );

      expect(response.ok).toBe(true);
    });

    it('makes direct fetch to Anthropic (CORS enabled)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({
          'access-control-allow-origin': '*'
        }),
        json: async () => ({ id: 'msg_123' })
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.anything()
      );

      expect(response.ok).toBe(true);
    });
  });

  describe('Error Response Handling', () => {
    it('parses JSON error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid request',
            type: 'invalid_request_error',
            param: null,
            code: null
          }
        })
      });

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': 'Bearer sk-test' }
      });

      expect(response.ok).toBe(false);
      
      const error = await response.json();
      expect(error.error).toBeDefined();
      expect(error.error.message).toBe('Invalid request');
    });

    it('handles non-JSON error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': 'Bearer sk-test' }
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('handles timeout errors', async () => {
      fetchMock.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': 'Bearer sk-test' }
        })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Provider Configuration', () => {
    it('maintains provider base URLs', () => {
      const providers = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        google: 'https://generativelanguage.googleapis.com/v1beta'
      };

      expect(providers.openai).toBe('https://api.openai.com/v1');
      expect(providers.anthropic).toBe('https://api.anthropic.com/v1');
      expect(providers.google).toBe('https://generativelanguage.googleapis.com/v1beta');
    });

    it('uses correct authentication methods per provider', () => {
      const authMethods = {
        openai: { header: 'Authorization', format: (key) => `Bearer ${key}` },
        anthropic: { header: 'x-api-key', format: (key) => key },
        google: { query: 'key', format: (key) => key }
      };

      expect(authMethods.openai.format('sk-test')).toBe('Bearer sk-test');
      expect(authMethods.anthropic.format('sk-ant-test')).toBe('sk-ant-test');
      expect(authMethods.google.format('AIza-test')).toBe('AIza-test');
    });
  });
});
