export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}
