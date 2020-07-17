type EventCallback = ((...args: any[]) => void) & { once?: boolean };
interface EventStore {
  [event: string]: EventCallback[];
}
type EventName = string & keyof EventStore;

export default class EventEmitter {
  private eventStore: EventStore;

  constructor() {
    this.eventStore = {};
  }

  on(event: EventName, listener: EventCallback) {
    if (!this.eventStore[event]) {
      this.eventStore[event] = [];
    }

    this.eventStore[event].push(listener);
  }

  once(event: EventName, listener: EventCallback) {
    listener.once = true;
    this.on(event, listener);
  }

  emit(event: EventName, ...args: any[]) {
    const store = this.eventStore[event];
    if (!store) {
      return;
    }

    store.forEach((listener, i) => {
      listener(...args);

      if (listener.once) {
        store.splice(i, 1);
      }
    });
  }

  off(event: EventName, listener?: EventCallback) {
    const store = this.eventStore[event];
    if (!store) {
      return;
    }

    if (!listener) {
      store.splice(0, store.length);
      return;
    }

    store.splice(store.indexOf(listener), 1);
  }
}
