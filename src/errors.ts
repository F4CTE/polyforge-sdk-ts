/**
 * Error thrown by the Polyforge SDK when an API request fails.
 */
export class PolyforgeError extends Error {
  /** HTTP status code returned by the API. */
  public readonly status: number;

  /** Machine-readable error code from the API (e.g. "STRATEGY_NOT_FOUND"). */
  public readonly code: string;

  /** Unique identifier for the failed request, useful for support inquiries. */
  public readonly requestId: string | undefined;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'PolyforgeError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolyforgeError);
    }
  }
}
