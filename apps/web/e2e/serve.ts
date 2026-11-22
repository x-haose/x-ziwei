import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

/**
 * 端到端测试用的静态服务器，按产物的部署方式提供 `build/client`：
 * 文件原样返回；`/zh/chart` 这类路径找 `zh/chart/index.html`；都没有就返回 SPA 回退页并给 404。
 */
const root = path.resolve(import.meta.dirname, '..', 'build', 'client');
const port = Number(process.env.PORT ?? 4173);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function file(p: string): string | null {
  try {
    return statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const target = path.join(root, decodeURIComponent(url.pathname));
  if (!target.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  const found = file(target) ?? file(path.join(target, 'index.html'));
  const served = found ?? path.join(root, '__spa-fallback.html');
  res.writeHead(found ? 200 : 404, { 'content-type': TYPES[path.extname(served)] ?? 'application/octet-stream' });
  createReadStream(served).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
