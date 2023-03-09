interface LoadQueueConfig {
  prioritised?: boolean;
  maxConcurrent?: number;
  throttleTime?: number;
  timeOutTime?: number;
  preloadAhead?: number;
}

interface LoadQueueRequest {
  key: any;
  maxConcurrencyOverride?: number | null;
  priority?: (other: unknown) => number;
  preload?: () => Promise<unknown>;
  work: () => Promise<unknown>;
}

enum LoadQueueStatus {
  Pending,
  Preloading,
  Loading,
  Error,
  TimedOut,
}

export default class LoadQueue {
  private prioritised: boolean;
  private maxConcurrent: number;
  private throttleTime: number;
  private timeOutTime: number;
  private preloadAhead: number;

  private queue: (LoadQueueRequest & { status: LoadQueueStatus })[] = [];
  private doWorkTimeout?: ReturnType<typeof setTimeout>;

  constructor(config?: LoadQueueConfig) {
    this.prioritised = config?.prioritised || false;
    this.maxConcurrent = config?.maxConcurrent || 1;
    this.throttleTime = config?.throttleTime || 100;
    this.timeOutTime = config?.timeOutTime || 2000;
    this.preloadAhead = config?.preloadAhead || 0;
  }

  request(request: LoadQueueRequest) {
    this.queue.push({ ...request, status: LoadQueueStatus.Pending });

    if (this.prioritised) {
      this.queue.sort((a, b) => {
        if (a.priority && b.priority) {
          return a.priority(b.key) - b.priority(a.key);
        }
        return 0;
      });
    }

    this.doWorkThrottled();
  }

  private doWorkThrottled() {
    if (this.doWorkTimeout) {
      clearTimeout(this.doWorkTimeout);
    }

    this.doWorkTimeout = setTimeout(() => this.doWork(), this.throttleTime);
  }

  private doWork() {
    const loading = this.queue.filter(
      (request) => request.status === LoadQueueStatus.Loading
    );

    if (loading.length >= this.maxConcurrent) {
      return;
    }

    const nextPendingIndex = this.queue.findIndex((request) =>
      [LoadQueueStatus.Pending, LoadQueueStatus.Preloading].includes(
        request.status
      )
    );

    if (nextPendingIndex === -1) return;
    const nextPending = this.queue[nextPendingIndex];

    if (
      nextPending.maxConcurrencyOverride &&
      loading.length >= nextPending.maxConcurrencyOverride
    ) {
      return;
    }

    nextPending.status = LoadQueueStatus.Loading;

    nextPending
      .work()
      .then(() => {
        this.queue.splice(this.queue.indexOf(nextPending), 1);
      })
      .catch((err) => {
        nextPending.status = LoadQueueStatus.Error;
        console.error('error loading', err);
      })
      .finally(() => {
        this.doWorkThrottled();
      });

    setTimeout(() => {
      if (nextPending.status === LoadQueueStatus.Loading) {
        nextPending.status = LoadQueueStatus.TimedOut;
        this.doWorkThrottled();
      }
    }, this.timeOutTime);

    const toPreload = this.queue
      .slice(nextPendingIndex + 1, nextPendingIndex + this.preloadAhead + 1)
      .filter((request) => request.status === LoadQueueStatus.Pending);

    for (const request of toPreload) {
      request.status = LoadQueueStatus.Preloading;
      request.preload?.().catch((err) => {
        console.error('error preloading', err);
      });
    }

    // Run multiple times to fill up maxConcurrent
    this.doWork();
  }
}
