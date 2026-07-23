// No `success` field — error === null already signals success, and a separate flag would
// be a second source of truth for the same fact. See docs/API_DESIGN.md.
export interface ApiSuccess<T> {
  data: T;
  meta: Record<string, unknown>;
  error: null;
}

export interface ApiError {
  data: null;
  meta: Record<string, unknown> | null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, meta: Record<string, unknown> = {}): ApiSuccess<T> {
  return { data, meta, error: null };
}

export function fail(code: string, message: string): ApiError {
  return { data: null, meta: null, error: { code, message } };
}
