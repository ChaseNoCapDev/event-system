# @chasenocap/event-system - CLAUDE.md

## Package Overview

Event-driven debugging and testing system that provides transparent event emission and testing capabilities for services in the H1B monorepo.

## Core Purpose

Enables services to emit events for debugging and testing without coupling to specific event implementations. Services use decorators to automatically emit lifecycle events.

## Key Components

### Event Bus (`EventBus`)
- Central event management with subscribe/unsubscribe
- Memory-efficient with automatic cleanup
- Type-safe event handling

### Service Decorators
- `@Emits(eventName, options)` - Auto-emit events on method calls
- `@Traces(options)` - Performance monitoring with thresholds
- `setEventBus(target, eventBus)` - Associate event bus with service

### Testing Support (`TestEventBus`)
- Event bus implementation for testing
- Assertion helpers for verifying events
- Payload and timing validation

## Usage Patterns

### Service Integration
```typescript
@injectable()
export class MyService {
  constructor(@inject(TYPES.IEventBus) eventBus: IEventBus) {
    setEventBus(this, eventBus);
  }
  
  @Emits('service.operation', {
    payloadMapper: (input: string) => ({ input })
  })
  @Traces({ threshold: 500 })
  async doWork(input: string): Promise<Result> {
    // Events auto-emitted for .started, .completed, .failed
  }
}
```

### Testing Pattern
```typescript
const testEventBus = new TestEventBus();
const service = new MyService(testEventBus);

await service.doWork('test');

testEventBus.expectEvent('service.operation.started').toHaveBeenEmitted();
testEventBus.expectEvent('service.operation.completed')
  .withPayload({ result: 'success' });
```

## Package Standards

- **Size**: 779 lines (well under 1000 target)
- **Dependencies**: 3 (meets target)
- **Coverage**: 100% (exceeds 90% target)
- **Architecture**: Pure TypeScript with decorator support

## Integration Notes

- Used by all H1B analysis services for debugging
- Test infrastructure depends on this for event assertions
- Event bus injected via DI framework
- No external runtime dependencies beyond DI

## Development Context

This package emerged from the need to debug complex service interactions in the H1B analysis pipeline. The decorator approach allows transparent event emission without cluttering service logic.