export type Accepted = { state: 'accepted'; jobId: string };
export type Ready = { state: 'ready'; id: string };
export type ResponseError = { message: string };
export type JsonResponse<Value> = { content: { 'application/json': Value } };

export type SuccessResponsePaths = {
  '/jobs': {
    post: {
      responses: {
        202: JsonResponse<Accepted>;
        default: JsonResponse<ResponseError>;
      };
    };
  };
  '/items': {
    get: {
      responses: {
        200: JsonResponse<Ready>;
        '206': JsonResponse<Accepted>;
        404: JsonResponse<ResponseError>;
        default: JsonResponse<ResponseError>;
      };
    };
  };
};
