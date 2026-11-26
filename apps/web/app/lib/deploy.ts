/**
 * 部署目标。构建时由环境变量 `XZW_SITE` 选定，决定页面与 sitemap 里绝对地址的域名、是否允许搜索引擎收录
 * （robots.txt 与 X-Robots-Tag）、是否带访问统计。只在构建配置里使用；页面代码经 `app/lib/site.ts` 的 `site()` 读取结果。
 */
export interface Site {
  /** 站点根地址，不带末尾斜杠。 */
  origin: string;
  /** 是否允许收录。测试站为假。 */
  indexable: boolean;
  /** Cloudflare Web Analytics 的站点标识；null 表示这个目标不统计（开发服务器，以及以后的桌面端）。 */
  analytics: string | null;
}

/**
 * 网页的 Cloudflare Web Analytics 站点标识。公开值，会写进每个页面，不是密钥；
 * 测试站与正式站共用一个统计站点，按主机名区分。
 */
const WEB_ANALYTICS_TOKEN = '6d526463cb234d90a459ddaa0419d83d';

export const SITES = {
  production: { origin: 'https://ziwei.x-haose.com', indexable: true, analytics: WEB_ANALYTICS_TOKEN },
  beta: { origin: 'https://ziwei-beta.x-haose.com', indexable: false, analytics: WEB_ANALYTICS_TOKEN },
} as const satisfies Record<string, Site>;

export type SiteName = keyof typeof SITES;

/** 开发服务器：页面里的绝对地址指向本机，不允许收录，不统计。 */
export const DEV_SITE: Site = { origin: 'http://localhost:5173', indexable: false, analytics: null };

/** 核对 `XZW_SITE` 的取值；没设或取值不认识时报错，不猜。 */
export function siteNameOf(name: string | undefined): SiteName {
  if (name !== undefined && Object.hasOwn(SITES, name)) return name as SiteName;
  throw new Error(`构建须设环境变量 XZW_SITE 为 ${Object.keys(SITES).join(' 或 ')}，实际为 ${JSON.stringify(name)}`);
}

/** 按 `XZW_SITE` 的取值找部署目标。 */
export function siteOf(name: string | undefined): Site {
  return SITES[siteNameOf(name)];
}

/** Cloudflare Web Analytics 的统计脚本（手动嵌入方式）与它的来源，供页面与 CSP 共用。上报地址是 https，在 CSP 的 `connect-src` 里。 */
export const WEB_ANALYTICS = {
  script: 'https://static.cloudflareinsights.com/beacon.min.js',
  scriptOrigin: 'https://static.cloudflareinsights.com',
} as const;

/** 统计脚本 `<script>` 的属性；目标不统计时为 null。 */
export function analyticsBeacon(site: Site): { src: string; 'data-cf-beacon': string } | null {
  if (site.analytics === null) return null;
  return { src: WEB_ANALYTICS.script, 'data-cf-beacon': JSON.stringify({ token: site.analytics }) };
}
