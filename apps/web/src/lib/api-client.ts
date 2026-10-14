export const API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Lets the request outlive the page (autosave flush on beforeunload). */
  keepalive?: boolean;
  timeoutMs?: number;
}

/** Encodes one path segment (ids come from URLs and must never alter the path). */
export const seg = (value: string) => encodeURIComponent(value);

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('; ');
    if (body.message) return body.message;
  } catch {
    // not JSON
  }
  return `Request failed (${res.status})`;
}

async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? API_TIMEOUT_MS);
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: opts.keepalive,
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'The server did not respond in time');
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

export const apiGet = <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts);
export const apiPost = <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts);
export const apiPatch = <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PATCH', path, body, opts);
export const apiDelete = <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts);
