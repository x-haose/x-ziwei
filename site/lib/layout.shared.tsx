import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { i18n } from '@/lib/i18n';
import { uiTranslations } from 'fumadocs-ui/i18n';
import { zhCN } from '@fumadocs/language/zh-cn';
import { Logo } from '@/components/logo';
import { Network, Server } from 'lucide-react';

/** 界面文案：中文界面用 fumadocs 官方简体词表，英文取内置默认。 */
export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .preset('zh', zhCN());

/** 本项目仓库：服务源码、插件与本站内容都在这里。 */
export const REPO_URL = 'https://github.com/x-haose/x-ziwei';

/** 本站内容在仓库里的目录，页面上「在 GitHub 上查看」据此拼出源文件地址。 */
export const CONTENT_URL = `${REPO_URL}/blob/main/site/content`;

/** 公开服务的根地址：`/mcp` 是 MCP 端点，`/v1/*` 是 HTTP JSON 接口。 */
export const SERVICE_URL = 'https://ziwei-mcp.x-haose.com';

/**
 * 排盘库 x-iztro 的文档站。
 *
 * 本站讲怎么在 AI 客户端里用；想把排盘嵌进自己程序的读者去那里，
 * 紫微斗数的概念、数据结构与准确性说明也在那边。
 */
export const LIBRARY_DOCS_URL = 'https://x-iztro.x-haose.com';

const nav = {
  zh: {
    install: '安装',
    tools: '工具',
    knowledge: '知识包',
    developers: '开发者',
    api: { text: 'HTTP 接口', desc: '不接 MCP 的程序与低代码平台用' },
    selfHost: { text: '自己部署', desc: '用自己的知识包，或让生辰不出本机' },
    library: '排盘库 x-iztro',
  },
  en: {
    install: 'Install',
    tools: 'Tools',
    knowledge: 'Knowledge pack',
    developers: 'Developers',
    api: { text: 'HTTP API', desc: 'For programs and low-code platforms without MCP' },
    selfHost: { text: 'Self-hosting', desc: 'Use your own knowledge pack, or keep birth data local' },
    library: 'x-iztro library',
  },
} as const;

/** 顶栏上指向排盘库文档站的入口。 */
export function libraryLink(locale: string) {
  const t = nav[locale as keyof typeof nav] ?? nav.en;
  return {
    type: 'main' as const,
    text: t.library,
    url: `${LIBRARY_DOCS_URL}/${locale}`,
    external: true,
  };
}

/**
 * 导航栏的共享配置。
 *
 * 前三项是使用者要看的；「开发者」收成一个下拉，不与它们并列。
 * 最后一项指向排盘库的文档站，两站互为入口。
 */
export function baseOptions(locale: string): BaseLayoutProps {
  const t = nav[locale as keyof typeof nav] ?? nav.en;
  const page = (path: string) => `/${locale}/${path}`;

  return {
    nav: {
      title: <Logo />,
      url: `/${locale}`,
    },
    githubUrl: REPO_URL,
    links: [
      { type: 'main', text: t.install, url: page('install'), active: 'url' },
      { type: 'main', text: t.tools, url: page('tools'), active: 'url' },
      { type: 'main', text: t.knowledge, url: page('knowledge'), active: 'url' },
      {
        type: 'menu',
        text: t.developers,
        items: [
          {
            icon: <Network />,
            text: t.api.text,
            description: t.api.desc,
            url: page('api'),
            active: 'url',
          },
          {
            icon: <Server />,
            text: t.selfHost.text,
            description: t.selfHost.desc,
            url: page('self-host'),
            active: 'url',
          },
        ],
      },
      libraryLink(locale),
    ],
  };
}
