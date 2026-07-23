import { getDeviceId } from '../lib/deviceId';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

if (!BASE_URL) {
  console.warn('EXPO_PUBLIC_API_BASE_URL is not set — API calls will fail.');
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface ApiSuccessResult<T> {
  data: T;
  meta: Record<string, unknown>;
}

// Deliberately not using the global URL/URLSearchParams APIs — historically inconsistent
// support across Hermes versions, and manual query-string building has zero dependency risk.
function buildUrl(path: string, query?: RequestOptions['query']): string {
  const parts: string[] = [];
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
  }
  const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
  return `${BASE_URL}${path}${qs}`;
}

const REQUEST_TIMEOUT_MS = 10000;

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiSuccessResult<T>> {
  const deviceId = await getDeviceId();

  // fetch() has no default timeout on React Native — an unreachable host (wrong LAN IP,
  // different subnet, VPN) would otherwise hang indefinitely instead of failing visibly,
  // which looks identical to "the app is broken" from the user's side.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        'x-device-id': deviceId,
        'Content-Type': 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError('REQUEST_TIMEOUT', `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await response.json();

  if (json.error) {
    throw new ApiError(json.error.code, json.error.message);
  }

  return { data: json.data as T, meta: json.meta ?? {} };
}
