import http from 'node:http';
import { renderHubPanel, hubViewModel } from '../packages/ui/index.mjs';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function h(tag, props, ...children) {
  const attrs = Object.entries(props ?? {}).map(([key, value]) => {
    if (key === 'style') value = Object.entries(value).map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${v}`).join(';');
    return `${key}="${escape(value)}"`;
  }).join(' ');
  return `<${tag} ${attrs}>${children.filter(v => v !== null).join('')}</${tag}>`;
}
const model = hubViewModel({ source: { mode: 'page', status: 'pending', state: null } });
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pet Hub · 隔离预览</title><body>${renderHubPanel(h, model)}</body></html>`;
const server = http.createServer((req, res) => { if (req.url !== '/') { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
server.listen(0, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
