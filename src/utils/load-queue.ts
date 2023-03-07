interface LoadQueueConfig {
  prioritised?: boolean;
  maxConcurrent?: number;
  throttleTime?: number;
  timeOutTime?: number;
}

interface LoadQueueRequest {
  key: any;
  priority?: (other: unknown) => number;
  work: () => Promise<unknown>;
}

enum LoadQueueStatus {
  Pending,
  Loading,
  Loaded,
  Error,
  TimedOut,
}

export default class LoadQueue {
  private prioritised: boolean;
  private maxConcurrent: number;
  private throttleTime: number;
  private timeOutTime: number;

  private queue: (LoadQueueRequest | { status: LoadQueueStatus })[] = [];
  private doWorkTimeout?: ReturnType<typeof setTimeout>;

  constructor(config?: LoadQueueConfig) {
    this.prioritised = config?.prioritised || false;
    this.maxConcurrent = config?.maxConcurrent || 1;
    this.throttleTime = config?.throttleRate || 100;
    this.timeOutTime = config?.timeOutTime || 2000;
  }

  // TODO: Speed things up by preloading loaded assets? (probably not until
  // it's a few away in the queue though)
  request(request: LoadQueueRequest) {
    // return;
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

    const nextPending = this.queue.find(
      (request) => request.status === LoadQueueStatus.Pending
    );

    if (!nextPending) {
      return;
    }

    nextPending.status = LoadQueueStatus.Loading;
    console.time(nextPending.key.name);

    nextPending
      .work()
      .then(() => {
        nextPending.status = LoadQueueStatus.Loaded;
      })
      .catch((err) => {
        nextPending.status = LoadQueueStatus.Error;
        console.error(err);
      })
      .finally(() => {
        console.timeEnd(nextPending.key.name);
        this.doWorkThrottled();
      });

    setTimeout(() => {
      if (nextPending.status === LoadQueueStatus.Loading) {
        nextPending.status = LoadQueueStatus.TimedOut;
        console.log('timed out', nextPending.key.name);
        console.timeEnd(nextPending.key.name);
        this.doWorkThrottled();
      }
    }, this.timeOutTime);

    // Run multiple times to fill up maxConcurrent
    this.doWork();
  }
}
