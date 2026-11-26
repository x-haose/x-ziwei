import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startFakeVendor } from './fake-vendor.ts';

/**
 * 端到端测试的假厂商进程（Playwright 的 webServer 之一）：
 * - 假厂商说 HTTPS，证书在启动时用 openssl 现生成（自签，含各厂商的主机名），浏览器上下文忽略证书错误；
 * - 一个只做 CONNECT 的代理：浏览器经它访问 `VENDOR_HOSTS` 时接到假厂商，其余主机一律拒绝，测试碰不到真实厂商。
 *   本机的站点（localhost）不走代理。
 */

/** 假厂商顶替的主机：三家厂商与兼容服务测试用的地址。 */
const VENDOR_HOSTS = ['api.deepseek.com', 'api.openai.com', 'api.anthropic.com', 'llm.example.test'];
const PROXY_PORT = 9480;
const VENDOR_PORT = 9443;

const dir = mkdtempSync(path.join(tmpdir(), 'xzw-fake-vendor-'));
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=fake-vendor',
  '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'),
  '-addext', `subjectAltName=${VENDOR_HOSTS.map((h) => `DNS:${h}`).join(',')}`,
], { stdio: 'ignore' });

const vendor = await startFakeVendor({
  port: VENDOR_PORT,
  tls: { key: readFileSync(path.join(dir, 'key.pem'), 'utf8'), cert: readFileSync(path.join(dir, 'cert.pem'), 'utf8') },
});

const proxy = http.createServer((req, res) => {
  // 健康检查与请求记录：Playwright 的 webServer 等它就绪；用例经 `/__requests` 读假厂商收到的请求（各用例按自己的问题筛选）。
  if (req.url === '/__health') {
    res.end('ok');
    return;
  }
  if (req.url === '/__requests') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(vendor.requests));
    return;
  }
  res.writeHead(403);
  res.end('only CONNECT to fake vendor hosts');
});
proxy.on('connect', (req, client, head) => {
  const host = (req.url ?? '').split(':')[0] ?? '';
  if (!VENDOR_HOSTS.includes(host)) {
    client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }
  const upstream = net.connect(VENDOR_PORT, '127.0.0.1', () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  const drop = () => {
    upstream.destroy();
    client.destroy();
  };
  upstream.on('error', drop);
  client.on('error', drop);
});
proxy.listen(PROXY_PORT, '127.0.0.1');
