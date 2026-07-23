export function parseToMilliseconds(seconds: number): number {
  return seconds * 1000;
}

export function randomValue(min: number, max: number): number {
  return Math.floor(Math.random() * max) + min;
}
