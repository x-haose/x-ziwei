import type { Site } from './deploy';

/** 本项目的源码仓库（站外链接）。 */
export const GITHUB_URL = 'https://github.com/x-haose/x-ziwei';

/** 本次构建所部署的站点（开发服务器下是本机地址，不允许收录）。构建时没设 `XZW_SITE` 则报错，构建随之失败。 */
export function site(): Site {
  if (!__XZW_SITE__) throw new Error('构建须设环境变量 XZW_SITE（取值见 app/lib/deploy.ts）');
  return __XZW_SITE__;
}
