// Same-origin facade: cookies stay first-party and provider keys stay in the API Worker.
export async function onRequest(context) {
  try {
    if (!context.env.API) throw new Error('Missing API service binding');
    return await context.env.API.fetch(context.request);
  } catch {
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '10', 'X-Content-Type-Options': 'nosniff' },
    });
  }
}
