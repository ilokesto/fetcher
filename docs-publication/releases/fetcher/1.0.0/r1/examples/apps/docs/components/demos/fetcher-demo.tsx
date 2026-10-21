'use client';

import { createFetcher } from '@ilokesto/fetcher';
import { fetcherCopy, fetcherSnippets } from './fetcher-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DemoFrame,
  type DemoProps,
  demoButtonClass,
  demoSecondaryButtonClass,
} from './demo-frame';

type Outcome = 'success' | 'error';

type DemoSuccess = {
  readonly kind: 'demo-profile';
  readonly profile: {
    readonly id: 'demo-user-42';
    readonly name: 'Mina Park';
    readonly role: 'Documentation tester';
  };
  readonly source: 'fictional-demo';
};

type DemoFailure = {
  readonly error: {
    readonly code: 'DEMO_UNAVAILABLE';
    readonly message: 'The fictional demo service is unavailable.';
  };
};

type DemoPaths = {
  '/api/demo/fetcher': {
    get: {
      parameters: { query: { outcome: Outcome } };
      responses: {
        200: { content: { 'application/json': DemoSuccess } };
        503: { content: { 'application/json': DemoFailure } };
      };
    };
  };
};

type ViewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly data: DemoSuccess; readonly status: number }
  | {
      readonly kind: 'error';
      readonly code: string;
      readonly message: string;
      readonly status: number | null;
    };

const api = createFetcher<DemoPaths>();

async function readFailure(response: Response | null, fallback: unknown) {
  if (response?.status === 503) {
    const body: DemoFailure = await response.clone().json();
    return body.error;
  }

  return {
    code: fallback instanceof Error ? fallback.name : 'REQUEST_FAILED',
    message:
      fallback instanceof Error
        ? fallback.message
        : response?.statusText || 'The request failed before a response was received.',
  };
}

export function FetcherDemo({ lang }: DemoProps) {
  const text = fetcherCopy[lang];
  const [state, setState] = useState<ViewState>({ kind: 'idle' });
  const activeController = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const reset = useCallback(() => {
    requestVersion.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    setState({ kind: 'idle' });
  }, []);

  const request = useCallback(async (outcome: Outcome) => {
    activeController.current?.abort();
    const controller = new AbortController();
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    activeController.current = controller;
    setState({ kind: 'loading' });

    const result = await api.safe.get(
      '/api/demo/fetcher',
      { params: { query: { outcome } } },
      { signal: controller.signal, retry: 0 },
    );

    if (controller.signal.aborted || requestVersion.current !== version) return;

    if (result.ok) {
      setState({ kind: 'success', data: result.data, status: result.response.status });
    } else {
      const detail = await readFailure(result.response, result.error);
      if (controller.signal.aborted || requestVersion.current !== version) return;
      setState({
        kind: 'error',
        code: detail.code,
        message: detail.message,
        status: result.response?.status ?? null,
      });
    }

    if (activeController.current === controller) activeController.current = null;
  }, []);

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
      activeController.current?.abort();
      activeController.current = null;
    };
  }, []);

  const loading = state.kind === 'loading';

  return (
    <DemoFrame lang={lang} name="fetcher" title={text.title} description={text.description} code={fetcherSnippets[lang]}>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className={demoButtonClass}
          data-action="fetch-success"
          disabled={loading}
          onClick={() => void request('success')}
        >
          {text.successAction}
        </button>
        <button
          type="button"
          className={demoSecondaryButtonClass}
          data-action="fetch-error"
          disabled={loading}
          onClick={() => void request('error')}
        >
          {text.errorAction}
        </button>
        <button
          type="button"
          className={demoSecondaryButtonClass}
          data-action="reset"
          disabled={state.kind === 'idle'}
          onClick={reset}
        >
          {text.reset}
        </button>
      </div>

          <div
        className="min-h-20 py-1 text-sm text-fd-foreground"
        data-result="fetcher-output"
        data-state={state.kind}
        aria-live="polite"
        aria-busy={loading}
      >
        {state.kind === 'idle' && <p className="text-fd-muted-foreground">{text.idle}</p>}
        {state.kind === 'loading' && <p className="text-fd-muted-foreground">{text.loading}</p>}
        {state.kind === 'success' && (
          <div className="space-y-3">
            <p className="font-medium">{text.demoLabel} · {text.success}</p>
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
              <dt className="text-fd-muted-foreground">{text.status}</dt>
              <dd className="font-mono tabular-nums">{state.status}</dd>
              <dt className="text-fd-muted-foreground">{text.id}</dt>
              <dd className="min-w-0 break-words font-mono">{state.data.profile.id}</dd>
              <dt className="text-fd-muted-foreground">{text.name}</dt>
              <dd>{state.data.profile.name}</dd>
              <dt className="text-fd-muted-foreground">{text.role}</dt>
              <dd>{state.data.profile.role}</dd>
            </dl>
          </div>
        )}
        {state.kind === 'error' && (
          <div className="space-y-3">
            <p className="font-medium">{text.demoLabel} · {text.error}</p>
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
              <dt className="text-fd-muted-foreground">{text.status}</dt>
              <dd className="font-mono tabular-nums">{state.status ?? text.noResponse}</dd>
              <dt className="text-fd-muted-foreground">{text.code}</dt>
              <dd className="min-w-0 break-words font-mono">{state.code}</dd>
              <dt className="text-fd-muted-foreground">{text.message}</dt>
              <dd className="min-w-0 break-words">{state.message}</dd>
            </dl>
          </div>
        )}
          </div>
        </div>
    </DemoFrame>
  );
}
