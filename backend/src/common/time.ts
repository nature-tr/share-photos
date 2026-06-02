export function now(): number {
  return Date.now();
}

export function isExpired(ts: number): boolean {
  return ts <= Date.now();
}
