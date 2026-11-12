import { defineI18n } from 'fumadocs-core/i18n';

/**
 * 站点语言配置。
 *
 * 中文为默认语言，其内容文件不带语言后缀（`install.mdx`）；
 * 英文内容以 `.en.mdx` 后缀并存于同一目录。
 * URL 始终携带语言前缀（`/zh/...`、`/en/...`），
 * 使两种语言的链接可以互相分享而不依赖浏览器语言协商。
 */
export const i18n = defineI18n({
  defaultLanguage: 'zh',
  languages: ['zh', 'en'],
});

/** 受支持的语言代码。 */
export type Language = (typeof i18n.languages)[number];

/** 把路由段上的任意字符串收窄为受支持的语言，用于按语言分发的端点。 */
export function isLanguage(value: string): value is Language {
  return (i18n.languages as readonly string[]).includes(value);
}
