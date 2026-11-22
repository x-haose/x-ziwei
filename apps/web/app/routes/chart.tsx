import { ChartPage } from '../chart/chart-page';
import { TopBar } from '../components/top-bar';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import type { Route } from './+types/chart';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.chart.title}：${t.brand.name}`);
};

export default function ChartRoute() {
  return (
    <>
      <TopBar />
      <ChartPage />
    </>
  );
}
