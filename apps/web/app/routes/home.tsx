import { Home } from '../home/home';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import type { Route } from './+types/home';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.brand.name} ${t.brand.sub}`, t.homeNav.blurb);
};

export default function HomeRoute() {
  return <Home />;
}
