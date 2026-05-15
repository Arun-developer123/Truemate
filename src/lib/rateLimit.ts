const requests = new Map();

export function rateLimit(ip: string) {

  const now = Date.now();

  const window = 60 * 1000;

  const limit = 20;

  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const timestamps = requests.get(ip).filter((t: number) => now - t < window);

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);

  requests.set(ip, timestamps);

  return true;

}