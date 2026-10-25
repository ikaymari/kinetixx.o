export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json({ error: 'The Kinetix database is not configured.' }, { status: 503 });
  }
  await env.DB.prepare('SELECT 1').first();
  return Response.json({ status: 'ok' });
}
