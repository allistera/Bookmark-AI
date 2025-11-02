/**
 * Standard API response helpers
 */

import { ApiResponse } from '../types/api';

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  statusCode: number = 500,
  code?: string
): Response {
  const response: ApiResponse = {
    success: false,
    error: message,
  };

  if (code) {
    (response as any).code = code;
  }

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(
  message: string,
  errors: any
): Response {
  const response = {
    success: false,
    error: message,
    errors,
  };

  return new Response(JSON.stringify(response), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a no content response
 */
export function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
  });
}
