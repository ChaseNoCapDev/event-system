# @chasenocap/event-system

Event-driven debugging and testing system for H1B monorepo. Provides decorators and event bus for transparent debugging and testing of service operations.

## Features

- Event bus implementation with subscription management
- `@Emits` decorator for automatic event emission
- `@Traces` decorator for performance monitoring  
- Event-aware testing utilities
- TypeScript decorators with full type safety

## Installation

```bash
npm install @chasenocap/event-system
```

## Usage

### Basic Event Bus

```typescript
import { EventBus, IEventBus } from '@chasenocap/event-system';

const eventBus: IEventBus = new EventBus();

// Subscribe to events
eventBus.subscribe('user.created', (payload) => {
  console.log('User created:', payload);
});

// Emit events
eventBus.emit('user.created', { id: 1, name: 'John' });
```

### Service Decorators

```typescript
import { Emits, Traces, setEventBus } from '@chasenocap/event-system';

class UserService {
  constructor(eventBus: IEventBus) {
    setEventBus(this, eventBus);
  }

  @Emits('user.operation', {
    payloadMapper: (id: string) => ({ userId: id })
  })
  @Traces({ threshold: 500 })
  async processUser(id: string): Promise<void> {
    // Implementation - events auto-emitted
  }
}
```

### Testing with Events

```typescript
import { TestEventBus } from '@chasenocap/event-system';

const testEventBus = new TestEventBus();
const service = new UserService(testEventBus);

await service.processUser('123');

// Assert events
testEventBus.expectEvent('user.operation.started').toHaveBeenEmitted();
testEventBus.expectEvent('user.operation.completed')
  .toHaveBeenEmitted()
  .withPayload({ result: 'success' });
```

## API Reference

### IEventBus Interface

```typescript
interface IEventBus {
  emit(event: string, payload?: any): void;
  subscribe(event: string, handler: EventHandler): () => void;
  unsubscribe(event: string, handler: EventHandler): void;
  clear(): void;
}
```

### Decorators

- `@Emits(eventName, options?)` - Automatically emit events for method calls
- `@Traces(options?)` - Monitor method performance with configurable thresholds

### Testing Utilities

- `TestEventBus` - Event bus implementation for testing with assertion helpers
- `setEventBus(target, eventBus)` - Associate event bus with service instance

## License

MIT