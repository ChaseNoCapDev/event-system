import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  Emits, 
  Traces, 
  setEventBus, 
  EventBus, 
  TestEventBus, 
  EmitsOptions, 
  TracesOptions 
} from './index.js';

describe('setEventBus', () => {
  it('should associate event bus with target object', () => {
    const eventBus = new TestEventBus();
    const target = {};
    
    setEventBus(target, eventBus);
    
    // We can't directly test the association, but we can test it through decorators
    expect(() => setEventBus(target, eventBus)).not.toThrow();
  });
});

describe('Emits decorator', () => {
  let testEventBus: TestEventBus;
  let testClass: TestClass;

  class TestClass {
    @Emits('custom.event')
    syncMethod(data: string): string {
      return `processed: ${data}`;
    }

    @Emits('async.event')
    async asyncMethod(data: string): Promise<string> {
      return `async processed: ${data}`;
    }

    @Emits('error.event')
    errorMethod(): never {
      throw new Error('Test error');
    }

    @Emits('async.error.event')
    async asyncErrorMethod(): Promise<never> {
      throw new Error('Async test error');
    }

    @Emits({ eventType: 'mapped.event', payloadMapper: (data: string) => ({ input: data }) })
    methodWithPayloadMapper(data: string): string {
      return `mapped: ${data}`;
    }

    @Emits()
    methodWithDefaultEventType(): string {
      return 'default';
    }
  }

  beforeEach(() => {
    testEventBus = new TestEventBus();
    testClass = new TestClass();
    setEventBus(testClass, testEventBus);
  });

  it('should emit started and completed events for sync methods', () => {
    const result = testClass.syncMethod('test');
    
    expect(result).toBe('processed: test');
    
    testEventBus.expectEvent('custom.event.started').toHaveBeenEmitted();
    testEventBus.expectEvent('custom.event.completed')
      .toHaveBeenEmitted()
      .withPayload({ result: 'processed: test' });
  });

  it('should emit started and completed events for async methods', async () => {
    const result = await testClass.asyncMethod('test');
    
    expect(result).toBe('async processed: test');
    
    testEventBus.expectEvent('async.event.started').toHaveBeenEmitted();
    testEventBus.expectEvent('async.event.completed')
      .toHaveBeenEmitted()
      .withPayload({ result: 'async processed: test' });
  });

  it('should emit started and failed events for sync methods that throw', () => {
    expect(() => testClass.errorMethod()).toThrow('Test error');
    
    testEventBus.expectEvent('error.event.started').toHaveBeenEmitted();
    testEventBus.expectEvent('error.event.failed')
      .toHaveBeenEmitted()
      .withPayload({ error: 'Test error' });
  });

  it('should emit started and failed events for async methods that throw', async () => {
    await expect(testClass.asyncErrorMethod()).rejects.toThrow('Async test error');
    
    testEventBus.expectEvent('async.error.event.started').toHaveBeenEmitted();
    testEventBus.expectEvent('async.error.event.failed')
      .toHaveBeenEmitted()
      .withPayload({ error: 'Async test error' });
  });

  it('should use payloadMapper when provided', () => {
    const result = testClass.methodWithPayloadMapper('test');
    
    expect(result).toBe('mapped: test');
    
    testEventBus.expectEvent('mapped.event.started')
      .toHaveBeenEmitted()
      .withPayload({ input: 'test' });
  });

  it('should use default args payload when no payloadMapper provided', () => {
    testClass.syncMethod('test');
    
    testEventBus.expectEvent('custom.event.started')
      .toHaveBeenEmitted()
      .withPayload({ args: ['test'] });
  });

  it('should generate default event type from class and method name', () => {
    testClass.methodWithDefaultEventType();
    
    testEventBus.expectEvent('TestClass.methodWithDefaultEventType.started').toHaveBeenEmitted();
    testEventBus.expectEvent('TestClass.methodWithDefaultEventType.completed').toHaveBeenEmitted();
  });

  it('should work without event bus (no errors)', () => {
    const isolatedClass = new TestClass();
    // No setEventBus call
    
    expect(() => {
      const result = isolatedClass.syncMethod('test');
      expect(result).toBe('processed: test');
    }).not.toThrow();
  });

  it('should handle options object format', () => {
    class OptionsTestClass {
      @Emits({ eventType: 'options.event' })
      testMethod(): string {
        return 'test';
      }
    }

    const instance = new OptionsTestClass();
    setEventBus(instance, testEventBus);
    
    instance.testMethod();
    
    testEventBus.expectEvent('options.event.started').toHaveBeenEmitted();
    testEventBus.expectEvent('options.event.completed').toHaveBeenEmitted();
  });
});

describe('Traces decorator', () => {
  let testEventBus: TestEventBus;
  let testClass: TestClass;

  class TestClass {
    @Traces()
    syncMethod(duration: number): string {
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < duration) {
        // busy wait
      }
      return 'completed';
    }

    @Traces({ threshold: 50 })
    thresholdMethod(duration: number): string {
      const start = Date.now();
      while (Date.now() - start < duration) {
        // busy wait
      }
      return 'completed';
    }

    @Traces({ includeArgs: true, includeResult: true })
    detailedMethod(input: string): string {
      return `processed: ${input}`;
    }

    @Traces()
    async asyncMethod(duration: number): Promise<string> {
      await new Promise(resolve => setTimeout(resolve, duration));
      return 'async completed';
    }

    @Traces()
    errorMethod(): never {
      throw new Error('Trace error');
    }
  }

  beforeEach(() => {
    testEventBus = new TestEventBus();
    testClass = new TestClass();
    setEventBus(testClass, testEventBus);
  });

  it('should emit trace events for sync methods', () => {
    testClass.syncMethod(1); // Very short duration
    
    const events = testEventBus.getEmittedEvents();
    const traceEvent = events.find(e => e.type === 'TestClass.syncMethod.trace');
    
    expect(traceEvent).toBeDefined();
    expect(traceEvent?.payload).toHaveProperty('duration');
    expect(typeof traceEvent?.payload.duration).toBe('number');
  });

  it('should respect threshold option', () => {
    // Duration below threshold
    testClass.thresholdMethod(10);
    
    let events = testEventBus.getEmittedEvents();
    expect(events.find(e => e.type === 'TestClass.thresholdMethod.trace')).toBeUndefined();
    
    testEventBus.clearEvents();
    
    // Duration above threshold
    testClass.thresholdMethod(60);
    
    events = testEventBus.getEmittedEvents();
    expect(events.find(e => e.type === 'TestClass.thresholdMethod.trace')).toBeDefined();
  });

  it('should include args and result when configured', () => {
    testClass.detailedMethod('test input');
    
    const events = testEventBus.getEmittedEvents();
    const traceEvent = events.find(e => e.type === 'TestClass.detailedMethod.trace');
    
    expect(traceEvent).toBeDefined();
    expect(traceEvent?.payload).toHaveProperty('args', ['test input']);
    expect(traceEvent?.payload).toHaveProperty('result', 'processed: test input');
    expect(traceEvent?.payload).toHaveProperty('duration');
  });

  it('should emit trace events for async methods', async () => {
    await testClass.asyncMethod(10);
    
    const events = testEventBus.getEmittedEvents();
    const traceEvent = events.find(e => e.type === 'TestClass.asyncMethod.trace');
    
    expect(traceEvent).toBeDefined();
    expect(traceEvent?.payload).toHaveProperty('duration');
    expect(traceEvent?.payload.duration).toBeGreaterThanOrEqual(10);
  });

  it('should emit trace events for methods that throw', () => {
    expect(() => testClass.errorMethod()).toThrow('Trace error');
    
    const events = testEventBus.getEmittedEvents();
    const traceEvent = events.find(e => e.type === 'TestClass.errorMethod.trace');
    
    expect(traceEvent).toBeDefined();
    expect(traceEvent?.payload).toHaveProperty('duration');
    expect(traceEvent?.payload).toHaveProperty('error', 'Trace error');
  });

  it('should work without event bus (no errors)', () => {
    const isolatedClass = new TestClass();
    // No setEventBus call
    
    expect(() => {
      const result = isolatedClass.syncMethod(1);
      expect(result).toBe('completed');
    }).not.toThrow();
  });

  it('should handle default options', () => {
    class DefaultOptionsClass {
      @Traces({})
      testMethod(): string {
        return 'test';
      }
    }

    const instance = new DefaultOptionsClass();
    setEventBus(instance, testEventBus);
    
    instance.testMethod();
    
    const events = testEventBus.getEmittedEvents();
    const traceEvent = events.find(e => e.type === 'DefaultOptionsClass.testMethod.trace');
    
    expect(traceEvent).toBeDefined();
    expect(traceEvent?.payload).toHaveProperty('duration');
    expect(traceEvent?.payload).not.toHaveProperty('args');
    expect(traceEvent?.payload).not.toHaveProperty('result');
  });
});