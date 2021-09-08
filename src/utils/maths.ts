export function shuffle(array: any[]) {
  let counter = array.length;

  while (counter > 0) {
    const index = Math.floor(Math.random() * counter);
    counter--;

    [array[counter], array[index]] = [array[index], array[counter]];
  }

  return array;
}

export function round(value: number, factor = 0.01) {
  // The division by the inverse is to help cut down on floating point errors
  return Math.round(value / factor) / (1 / factor);
}
