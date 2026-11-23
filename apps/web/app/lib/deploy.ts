/**
 * 部署目标。构建时由环境变量 `XZW_SITE` 选定，决定页面与 sitemap 里绝对地址的域名、是否允许搜索引擎收录
 * （robots.txt 与 X-Robots-Tag）。只在构建配置里使用；页面代码经 `app/lib/site.ts` 的 `SITE` 读取结果。
 */
export interface Site {
  /** 站点根地址，不带末尾斜杠。 */
  origin: string;
  /** 是否允许收录。测试站为假。 */
  indexable: boolean;
}

export const SITES = {
  production: { origin: 'https://ziwei.x-haose.com', indexable: true },
  beta: { origin: 'https://ziwei-beta.x-haose.com', indexable: false },
} as const satisfies Record<string, Site>;

export type SiteName = keyof typeof SITES;

/** 核对 `XZW_SITE` 的取值；没设或取值不认识时报错，不猜。 */
export function siteNameOf(name: string | undefined): SiteName {
  if (name !== undefined && Object.hasOwn(SITES, name)) return name as SiteName;
  throw new Error(`构建须设环境变量 XZW_SITE 为 ${Object.keys(SITES).join(' 或 ')}，实际为 ${JSON.stringify(name)}`);
}

/** 按 `XZW_SITE` 的取值找部署目标。 */
export function siteOf(name: string | undefined): Site {
  return SITES[siteNameOf(name)];
}
