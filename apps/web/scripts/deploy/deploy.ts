import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { type SiteName, siteNameOf } from '../../app/lib/deploy.ts';
import { TARGET_FILE } from './post-build.ts';

/**
 * 部署：`node scripts/deploy/deploy.ts <production|beta>`（即 `pnpm deploy:production`、`pnpm deploy:beta`）。
 * 先核对 `build/deploy-target.json` 记录的构建目标与要部署的目标一致，不一致或没有记录时报错退出，
 * 不部署；一致再执行对应的 `wrangler deploy`（测试站是 `wrangler.jsonc` 里的 `--env beta`），退出码照传。
 * 目标之后的参数原样交给 wrangler（如 `--dry-run`）。
 */
const WRANGLER_ARGS: Record<SiteName, string[]> = { production: ['deploy'], beta: ['deploy', '--env', 'beta'] };

const root = path.resolve(import.meta.dirname, '..', '..');
const target = siteNameOf(process.argv[2]);
const file = path.join(root, 'build', TARGET_FILE);

let built: unknown;
try {
  built = (JSON.parse(readFileSync(file, 'utf8')) as { site?: unknown }).site;
} catch (err) {
  console.error(`读不到构建目标 ${file}：先运行 pnpm build:${target}`);
  throw err;
}
if (built !== target) {
  console.error(`产物是按 ${JSON.stringify(built)} 构建的，不能部署到 ${target}：先运行 pnpm build:${target}`);
  process.exit(1);
}

const result = spawnSync(path.join(root, 'node_modules', '.bin', 'wrangler'), [...WRANGLER_ARGS[target], ...process.argv.slice(3)], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
