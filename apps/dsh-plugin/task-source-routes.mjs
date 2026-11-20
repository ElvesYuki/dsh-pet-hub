import {Readable} from 'node:stream';
import {readNative400ReviewBody} from '../../packages/runtime/native400-review-channel.mjs';

const prefix = '/api/pet-hub-task-source/';

/** Mount within the authenticated Desktop Connection, never a public HTTP listener. */
export function registerTaskSourceRoutes(ctx, owner) {
  const lifetime = new AbortController(), disposers = [];
  const reply = (status, value) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});
  async function dispatch(request, method, path) {
    const url = new URL(request.url), post = method === 'POST';
    if (request.method !== method || url.origin !== 'http://dsh.internal' || url.pathname !== path ||
        url.username || url.password || url.hash || url.search) return reply(404, {error: 'task_source_route'});
    const site = request.headers.get('sec-fetch-site');
    if (request.headers.has('origin') || request.headers.has('x-pet-hub-operator') || (site && site !== 'same-origin') ||
        (post && (!request.body || request.headers.get('content-type') !== 'application/json' || request.headers.get('x-pet-hub') !== '1')))
      return reply(403, {error: 'task_source_rejected'});
    const signal = AbortSignal.any([lifetime.signal, request.signal, AbortSignal.timeout(2500)]);
    try {
      signal.throwIfAborted();
      if (!post) return reply(200, owner.view());
      const stream = Readable.fromWeb(request.body, {signal});
      let input;
      try { input = await readNative400ReviewBody(stream, {signal}); }
      catch { return reply(400, {error: 'task_source_invalid'}); }
      finally { stream.destroy(); }
      signal.throwIfAborted();
      return reply(200, owner.select(input));
    } catch (error) {
      if (error.code === 'task_source_invalid') return reply(400, {error: error.code});
      if (error.code === 'task_source_conflict') return reply(409, {error: error.code});
      return reply(503, {error: 'task_source_unavailable'});
    }
  }

  const close = async () => {
    lifetime.abort();
    try { for (const dispose of disposers.reverse()) dispose(); }
    finally { await owner.close(); }
  };
  try {
    for (const [method, route] of [['GET', 'status'], ['POST', 'select']]) {
      const path = prefix + route;
      disposers.push(ctx.connection.fetch.register({path, methods: [method],
        requestBody: method === 'POST' ? 'streaming' : 'buffered', fetch: request => dispatch(request, method, path)}));
    }
  } catch (error) { void close().catch(() => {}); throw error; }
  return close;
}
