import { describe, it, expect, vi } from 'vitest';
import { EventBus, TestEventBus, BaseEvent } from './index.js';

describe('EventBus', () => {
  it('should emit events to registered listeners', () => {
    const eventBus = new EventBus();
    const mockHandler = vi.fn();
    
    eventBus.on('test.event', mockHandler);
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now(),
      payload: { data: 'test' }
    };
    
    eventBus.emit(event);
    
    expect(mockHandler).toHaveBeenCalledWith(event);
  });

  it('should handle multiple listeners for the same event', () => {
    const eventBus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.on('test.event', handler1);
    eventBus.on('test.event', handler2);
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    eventBus.emit(event);
    
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('should remove specific listener with off()', () => {
    const eventBus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.on('test.event', handler1);
    eventBus.on('test.event', handler2);
    eventBus.off('test.event', handler1);
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    eventBus.emit(event);
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('should remove all listeners with off() when no handler specified', () => {
    const eventBus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.on('test.event', handler1);
    eventBus.on('test.event', handler2);
    eventBus.off('test.event');
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    eventBus.emit(event);
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should handle errors in listeners gracefully', () => {
    const eventBus = new EventBus();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const goodHandler = vi.fn();
    
    eventBus.on('test.event', errorHandler);
    eventBus.on('test.event', goodHandler);
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    eventBus.emit(event);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error in event listener for test.event:',
      expect.any(Error)
    );
    expect(goodHandler).toHaveBeenCalledWith(event);
    
    consoleSpy.mockRestore();
  });

  it('should not emit to non-existent event types', () => {
    const eventBus = new EventBus();
    const handler = vi.fn();
    
    eventBus.on('existing.event', handler);
    
    const event: BaseEvent = {
      type: 'non.existent.event',
      timestamp: Date.now()
    };
    
    eventBus.emit(event);
    
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('TestEventBus', () => {
  it('should track emitted events', () => {
    const testEventBus = new TestEventBus();
    
    const event1: BaseEvent = {
      type: 'test.event1',
      timestamp: Date.now(),
      payload: { data: 'first' }
    };
    
    const event2: BaseEvent = {
      type: 'test.event2',
      timestamp: Date.now(),
      payload: { data: 'second' }
    };
    
    testEventBus.emit(event1);
    testEventBus.emit(event2);
    
    const emittedEvents = testEventBus.getEmittedEvents();
    expect(emittedEvents).toHaveLength(2);
    expect(emittedEvents[0]).toEqual(event1);
    expect(emittedEvents[1]).toEqual(event2);
  });

  it('should clear tracked events', () => {
    const testEventBus = new TestEventBus();
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    testEventBus.emit(event);
    expect(testEventBus.getEmittedEvents()).toHaveLength(1);
    
    testEventBus.clearEvents();
    expect(testEventBus.getEmittedEvents()).toHaveLength(0);
  });

  it('should provide expectEvent assertion helper', () => {
    const testEventBus = new TestEventBus();
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now(),
      payload: { data: 'test' }
    };
    
    testEventBus.emit(event);
    
    // Should not throw
    expect(() => {
      testEventBus.expectEvent('test.event').toHaveBeenEmitted();
    }).not.toThrow();
    
    // Should throw for non-emitted event
    expect(() => {
      testEventBus.expectEvent('non.existent').toHaveBeenEmitted();
    }).toThrow("Expected event 'non.existent' to have been emitted");
  });

  it('should validate event payload with withPayload()', () => {
    const testEventBus = new TestEventBus();
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now(),
      payload: { data: 'test', count: 42 }
    };
    
    testEventBus.emit(event);
    
    // Should not throw for correct payload
    expect(() => {
      testEventBus.expectEvent('test.event')
        .toHaveBeenEmitted()
        .withPayload({ data: 'test', count: 42 });
    }).not.toThrow();
    
    // Should throw for incorrect payload
    expect(() => {
      testEventBus.expectEvent('test.event')
        .toHaveBeenEmitted()
        .withPayload({ data: 'wrong' });
    }).toThrow(/payload mismatch/);
    
    // Should throw for non-emitted event
    expect(() => {
      testEventBus.expectEvent('non.existent')
        .withPayload({ data: 'test' });
    }).toThrow("Event 'non.existent' was not emitted");
  });

  it('should still emit to registered listeners', () => {
    const testEventBus = new TestEventBus();
    const handler = vi.fn();
    
    testEventBus.on('test.event', handler);
    
    const event: BaseEvent = {
      type: 'test.event',
      timestamp: Date.now()
    };
    
    testEventBus.emit(event);
    
    expect(handler).toHaveBeenCalledWith(event);
    expect(testEventBus.getEmittedEvents()).toHaveLength(1);
  });
});