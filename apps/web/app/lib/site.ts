import type { Lang } from '../i18n/lang';

/**
 * 说明站：安装、工具、知识包、接口、隐私与条款等帮助页所在的站点，产品站里指向它们的链接都是外链。
 */
const HELP_ORIGIN = 'https://ziwei.x-haose.com';

export type HelpPage = 'install' | 'tools' | 'knowledge' | 'api' | 'self-host' | 'privacy' | 'terms' | 'support';

export function helpUrl(lang: Lang, page: HelpPage): string {
  return `${HELP_ORIGIN}/${lang}/${page}`;
}

export const GITHUB_URL = 'https://github.com/x-haose/x-ziwei';
