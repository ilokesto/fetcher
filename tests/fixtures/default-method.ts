export type ReadResult = { kind: 'read' };
export type WriteResult = { kind: 'write'; value: string };

export type DefaultMethodPaths = {
  '/resources': {
    get: { responses: { 200: { content: { 'application/json': ReadResult } } } };
    post: {
      requestBody: { content: { 'application/json': { value: string } } };
      responses: { 200: { content: { 'application/json': WriteResult } } };
    };
  };
  '/other': {
    post: {
      requestBody: { content: { 'application/json': { other: boolean } } };
      responses: { 200: { content: { 'application/json': { other: boolean } } } };
    };
  };
};
