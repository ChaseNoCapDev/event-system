// Core interfaces
export interface IEventBus {
  emit(event: BaseEvent): void;
  on(eventType: string, handler: (event: BaseEvent) => void): void;
  off(eventType: string, handler?: (event: BaseEvent) => void): void;
}

export interface BaseEvent {
  type: string;
  timestamp: number;
  payload?: any;
}

// Event bus implementation
export class EventBus implements IEventBus {
  private listeners: Map<string, Array<(event: BaseEvent) => void>> = new Map();

  emit(event: BaseEvent): void {
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });
  }

  on(eventType: string, handler: (event: BaseEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  off(eventType: string, handler?: (event: BaseEvent) => void): void {
    if (!handler) {
      this.listeners.delete(eventType);
      return;
    }
    
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

// Test event bus for testing
export class TestEventBus extends EventBus {
  private emittedEvents: BaseEvent[] = [];

  override emit(event: BaseEvent): void {
    this.emittedEvents.push(event);
    super.emit(event);
  }

  getEmittedEvents(): BaseEvent[] {
    return [...this.emittedEvents];
  }

  clearEvents(): void {
    this.emittedEvents = [];
  }

  expectEvent(type: string): any {
    const api = {
      toHaveBeenEmitted: () => {
        const found = this.emittedEvents.some(e => e.type === type);
        if (!found) {
          throw new Error(`Expected event '${type}' to have been emitted`);
        }
        return api;
      },
      withPayload: (expectedPayload: any) => {
        const event = this.emittedEvents.find(e => e.type === type);
        if (!event) {
          throw new Error(`Event '${type}' was not emitted`);
        }
        if (JSON.stringify(event.payload) !== JSON.stringify(expectedPayload)) {
          throw new Error(`Event '${type}' payload mismatch. Expected: ${JSON.stringify(expectedPayload)}, Got: ${JSON.stringify(event.payload)}`);
        }
        return api;
      }
    };
    return api;
  }
}

// Decorator interfaces
export interface EmitsOptions {
  eventType?: string;
  payloadMapper?: (...args: any[]) => any;
}

export interface TracesOptions {
  threshold?: number;
  includeArgs?: boolean;
  includeResult?: boolean;
}

// Global event bus storage
const eventBusRegistry = new WeakMap<any, IEventBus>();

// Set event bus helper
export function setEventBus(target: any, eventBus: IEventBus): void {
  eventBusRegistry.set(target, eventBus);
}

// Get event bus helper
function getEventBus(target: any): IEventBus | undefined {
  return eventBusRegistry.get(target);
}

// Emits decorator
export function Emits(eventTypeOrOptions?: string | EmitsOptions, options?: EmitsOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const opts = typeof eventTypeOrOptions === 'string' 
      ? { eventType: eventTypeOrOptions, ...options }
      : (eventTypeOrOptions || {});
    
    const eventType = opts.eventType || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = function (...args: any[]) {
      const eventBus = getEventBus(this);
      
      if (eventBus) {
        // Emit start event
        const startPayload = opts.payloadMapper ? opts.payloadMapper(...args) : { args };
        eventBus.emit({
          type: `${eventType}.started`,
          timestamp: Date.now(),
          payload: startPayload
        });
      }
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.then((value) => {
            if (eventBus) {
              eventBus.emit({
                type: `${eventType}.completed`,
                timestamp: Date.now(),
                payload: { result: value }
              });
            }
            return value;
          }).catch((error) => {
            if (eventBus) {
              eventBus.emit({
                type: `${eventType}.failed`,
                timestamp: Date.now(),
                payload: { error: error.message }
              });
            }
            throw error;
          });
        } else {
          if (eventBus) {
            eventBus.emit({
              type: `${eventType}.completed`,
              timestamp: Date.now(),
              payload: { result }
            });
          }
          return result;
        }
      } catch (error) {
        if (eventBus) {
          eventBus.emit({
            type: `${eventType}.failed`,
            timestamp: Date.now(),
            payload: { error: (error as Error).message }
          });
        }
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Traces decorator
export function Traces(options: TracesOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const { threshold = 0, includeArgs = false, includeResult = false } = options;
    
    descriptor.value = function (...args: any[]) {
      const startTime = Date.now();
      const eventBus = getEventBus(this);
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.then((value) => {
            const duration = Date.now() - startTime;
            if (eventBus && duration >= threshold) {
              const payload: any = { duration };
              if (includeArgs) payload.args = args;
              if (includeResult) payload.result = value;
              
              eventBus.emit({
                type: `${target.constructor.name}.${propertyKey}.trace`,
                timestamp: Date.now(),
                payload
              });
            }
            return value;
          });
        } else {
          const duration = Date.now() - startTime;
          if (eventBus && duration >= threshold) {
            const payload: any = { duration };
            if (includeArgs) payload.args = args;
            if (includeResult) payload.result = result;
            
            eventBus.emit({
              type: `${target.constructor.name}.${propertyKey}.trace`,
              timestamp: Date.now(),
              payload
            });
          }
          return result;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        if (eventBus) {
          eventBus.emit({
            type: `${target.constructor.name}.${propertyKey}.trace`,
            timestamp: Date.now(),
            payload: { duration, error: (error as Error).message }
          });
        }
        throw error;
      }
    };
    
    return descriptor;
  };
}