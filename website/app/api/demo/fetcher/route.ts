const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export function GET(request: Request) {
  const outcome = new URL(request.url).searchParams.get('outcome');

  if (outcome === 'error') {
    return Response.json(
      {
        error: {
          code: 'DEMO_UNAVAILABLE',
          message: 'The fictional demo service is unavailable.',
        },
      },
      { status: 503, headers },
    );
  }

  return Response.json(
    {
      kind: 'demo-profile',
      profile: {
        id: 'demo-user-42',
        name: 'Mina Park',
        role: 'Documentation tester',
      },
      source: 'fictional-demo',
    },
    { status: 200, headers },
  );
}
