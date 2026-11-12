import { loader } from 'fumadocs-core/source';
import { docs } from '@/.source/server';
import { i18n } from '@/lib/i18n';
import { createElement } from 'react';
import * as icons from 'lucide-react';

/** 内容页的页面树与查询入口，按语言切分。页面直接挂在语言段之下：`/zh/install`。 */
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  i18n,
  /** meta.json 的 `icon` 字段按名字解析为 lucide 图标组件。 */
  icon(icon) {
    if (!icon) return;
    if (icon in icons) {
      return createElement(icons[icon as keyof typeof icons] as React.FC);
    }
  },
});
