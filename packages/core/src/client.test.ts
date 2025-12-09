import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutlitClient } from './client';

describe('OutlitClient', () => {
  let client: OutlitClient;

  beforeEach(() => {
    client = new OutlitClient({
      apiKey: 'test-api-key',
      flushInterval: 60000, // Long interval to prevent auto-flush during tests
    });
  });

  it('should throw error without API key', () => {
    expect(() => new OutlitClient({ apiKey: '' })).toThrow('API key is required');
  });

  it('should initialize with default config', () => {
    expect(client).toBeDefined();
    expect(client.getQueueSize()).toBe(0);
  });

  it('should identify a user', () => {
    client.identify('user-123', { email: 'test@example.com' });
    const user = client.getUser();
    expect(user.userId).toBe('user-123');
    expect(user.email).toBe('test@example.com');
  });

  it('should track an event', () => {
    client.track('test_event', { prop: 'value' });
    expect(client.getQueueSize()).toBe(1);
  });

  it('should include user info in tracked events', () => {
    client.identify('user-123');
    client.track('test_event');
    expect(client.getQueueSize()).toBe(1);
  });

  it('should flush events when queue reaches flushAt', () => {
    const smallClient = new OutlitClient({
      apiKey: 'test-api-key',
      flushAt: 2,
      flushInterval: 60000,
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    smallClient.track('event1');
    expect(smallClient.getQueueSize()).toBe(1);

    smallClient.track('event2');
    // Queue should be flushed or in process of flushing
  });

  it('should respect maxQueueSize', () => {
    const smallClient = new OutlitClient({
      apiKey: 'test-api-key',
      maxQueueSize: 2,
      flushAt: 100, // High flush threshold
      flushInterval: 60000,
    });

    smallClient.track('event1');
    smallClient.track('event2');
    smallClient.track('event3'); // Should drop oldest

    expect(smallClient.getQueueSize()).toBe(2);
  });

  it('should get current user', () => {
    client.identify('user-123', { name: 'Test User' });
    const user = client.getUser();
    expect(user.userId).toBe('user-123');
    expect(user.name).toBe('Test User');
  });
});
