import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;

function parseRevision(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('revision response must be an object');
  }
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'revision' || !SHA.test(payload.revision)) {
    throw new Error('revision response must contain exactly one full lowercase commit SHA');
  }
  return payload.revision;
}

export async function verifyDeployment(
  endpoint,
  expectedRevision,
  {
    attempts = 12,
    delayMs = 5_000,
    timeoutMs = 10_000,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('revision endpoint must be an HTTPS URL without credentials');
  }
  if (!SHA.test(expectedRevision)) throw new Error('expected revision must be a full lowercase commit SHA');
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('attempts must be a positive integer');
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error('delayMs must be a non-negative integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer');

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const requestUrl = new URL(url);
      requestUrl.searchParams.set('revision', expectedRevision);
      requestUrl.searchParams.set('attempt', String(attempt));
      const response = await fetchImpl(requestUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`revision endpoint returned HTTP ${response.status}`);
      if (!/(?:^|,)\s*no-store(?:\s*(?:,|$))/i.test(response.headers.get('cache-control') ?? '')) {
        throw new Error('revision endpoint is cacheable');
      }
      const actual = parseRevision(await response.json());
      if (actual !== expectedRevision) throw new Error(`public revision is ${actual}, expected ${expectedRevision}`);
      return actual;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  throw new Error(`deployment verification failed after ${attempts} attempts`, { cause: lastError });
}

async function main() {
  const [endpoint, expectedRevision] = process.argv.slice(2);
  if (!endpoint || !expectedRevision) {
    throw new Error('usage: node scripts/verify-deployment.mjs <revision-url> <expected-sha>');
  }
  const revision = await verifyDeployment(endpoint, expectedRevision);
  console.log(`deploy: verified public revision ${revision}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`deploy: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
