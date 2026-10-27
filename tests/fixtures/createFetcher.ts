import type { MergePaths } from '../../src/openapi';

type GeneratedPaths = {
  '/users/{id}': {
    get: {
      parameters: {
        path: {
          id: string;
        };
        query?: {
          include?: 'profile' | 'settings';
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              id: string;
              role: 'admin' | 'member';
            };
          };
        };
      };
    };
  };
  '/search': {
    get: {
      parameters: {
        query?: {
          term?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      responses: {
        200: {
          content: {
            'application/json': {
              results: string[];
            };
          };
        };
      };
    };
  };
  '/posts': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            title: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              id: string;
              title: string;
            };
          };
        };
      };
    };
  };
  '/widgets/{widgetId}': {
    post: {
      parameters: {
        path: {
          widgetId: string;
        };
        query?: {
          draft?: boolean;
        };
        header: {
          'x-trace': string;
        };
        cookie?: {
          session?: string;
        };
      };
      requestBody: {
        content: {
          'application/json': {
            title: string;
            tags?: string[];
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              id: string;
            };
          };
        };
      };
    };
  };
  '/uploads/{uploadId}': {
    post: {
      parameters: {
        path: {
          uploadId: string;
        };
        query?: {
          overwrite?: boolean;
        };
        header: {
          'x-upload-token': string;
        };
        cookie?: {
          session?: string;
        };
      };
      requestBody: {
        content: {
          'multipart/form-data': {
            file: Blob;
            visibility?: 'private' | 'public';
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              id: string;
              status: 'stored';
            };
          };
        };
      };
    };
  };
  '/sessions': {
    post: {
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            username: string;
            password: string;
            scope?: string[];
            empty?: undefined;
            remember?: boolean;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              token: string;
            };
          };
        };
      };
    };
  };
  '/imports': {
    post: {
      requestBody: {
        content: {
          'multipart/form-data': {
            file: Blob;
          };
          'application/x-www-form-urlencoded': {
            sourceUrl: string;
            labels?: string[];
          };
        };
      };
      responses: {
        202: {
          content: {
            'application/json': {
              accepted: true;
            };
          };
        };
      };
    };
  };
};

type ExtraPaths = {
  '/bff/checkout/quote': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            cartId: string;
            couponCode?: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              total: number;
              currency: 'KRW' | 'USD';
              discountApplied: boolean;
            };
          };
        };
      };
    };
  };
};

export type ApiPaths = MergePaths<GeneratedPaths, ExtraPaths>;
export type UntypedShortcutPost = (input: string, request?: unknown) => { json: () => Promise<unknown> };
