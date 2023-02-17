import { round } from './maths';

type StoreItem = {
  last: number;
  total: number;
  count: number;
};

const store: { [key: string]: StoreItem } = {};

export function start(key: string, force = false) {
  if (!store[key]) {
    store[key] = {
      last: -1,
      total: 0,
      count: 0,
    };
  }

  if (!force && performance.now() < 1e3) {
    console.warn(`Ignoring start() call for "${key}" event, too early`);
    return;
  }

  store[key].last = performance.now();
}

export function end(key: string) {
  const storeItem = store[key];

  if (!storeItem) {
    console.warn('Aborting performance log, start() not called');
    return;
  }

  // Means it was called too early and not forced - warning already printed
  if (storeItem.last === -1) {
    return;
  }

  const elapsed = performance.now() - storeItem.last;

  storeItem.total += elapsed;
  storeItem.count++;

  console.log(
    `%c"${key}" event fired:%c\n  this event: %oms\n  average: %oms over %o events`,
    'font-weight: bold',
    'font-weight: normal',
    round(elapsed),
    round(storeItem.total / storeItem.count),
    storeItem.count
  );
}

// Skypack doesn't like it when there isn't a default export
export default {};
