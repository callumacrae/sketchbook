export function shuffle(array: any[]) {
  let counter = array.length;

  while (counter > 0) {
    const index = Math.floor(Math.random() * counter);
    counter--;

    [array[counter], array[index]] = [array[index], array[counter]]
  }

  return array;
}
