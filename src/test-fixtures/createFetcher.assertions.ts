import { HTTPError } from 'ky';
import { expect } from 'vitest';
import type { SafeResult } from '../openapi/types';

export const expectSafeSuccess = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: true }> => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error('Expected safe success result');
  }

  return result;
};

export const expectSafeFailure = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: false }> => {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('Expected safe failure result');
  }

  return result;
};

export const expectHttpError = (error: unknown): HTTPError => {
  expect(error).toBeInstanceOf(HTTPError);

  if (!(error instanceof HTTPError)) {
    throw new Error('Expected ky HTTPError');
  }

  return error;
};
