export * from './auth.js';
export * from './share.js';

import type { ErrorCodeValue } from '../constants/error-codes.js';

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: ErrorCodeValue | string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
