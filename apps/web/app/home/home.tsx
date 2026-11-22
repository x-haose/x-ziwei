import { Link } from 'react-router';
import { EmptyBoard } from '../chart/board';
import * as controls from '../components/controls.css';
import { Glyph } from '../components/icons';
import { ThemeButton } from '../components/theme-button';
import { localePath } from '../i18n/lang';
import { useLang, useMessages } from '../i18n/use-lang';
import { helpUrl } from '../lib/site';
import * as css from './home.css';

/** 拓片原图在 Wikimedia Commons 的页面（公有领域）。 */
const RUBBING_SOURCE = 'https://commons.wikimedia.org/wiki/File:Soochow_Planisphere_(Detail_2).jpg';

/**
 * 首页首屏：拓片满版，左下是主张与两个入口，右下是从底边浮出的盘。
 *
 * 拓片图 `public/img/rubbing-*.webp` 由 Commons 原图（缩到 1567px 宽的版本）转灰度，
 * 黑场 38、白场 180、gamma 1.3，得到石白线、纯黑底，再按 1400 与 900 两个宽度存为 WebP（质量 72）。
 * 明暗两套主题里的合成方式由令牌 `rubbing` 决定。
 *
 * 右下的盘没有盘面数据，显示空状态（只有地支与刻度）。
 */
export function Home() {
  const lang = useLang();
  const t = useMessages();
  const chart = localePath(lang, '/chart');
  return (
    <main className={css.home}>
      <div className={css.sky}>
        <img
          className={css.rubbingImage}
          src="/img/rubbing-1400.webp"
          srcSet="/img/rubbing-900.webp 900w, /img/rubbing-1400.webp 1400w"
          sizes="(min-width: 1280px) 1180px, (min-width: 1024px) 1040px, max(640px, 118vw)"
          width={1400}
          height={1429}
          alt={t.home.rubbingAlt}
          fetchPriority="high"
          decoding="async"
        />
        <div className={css.ziwei} aria-hidden="true">
          <span className={css.ziweiTick} />
          <span className={css.ziweiLabel}>{t.home.ziweiyuan}</span>
          <span className={css.ziweiCaption}>
            {t.home.rubbingCaption.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </div>
      </div>

      <nav className={css.nav} aria-label={t.nav.label}>
        <Link className={css.mark} to={localePath(lang, '')}>
          <Glyph size={26} />
          <b className={css.markName}>
            {t.brand.name}
            <small className={css.markSub}>{t.brand.sub}</small>
          </b>
        </Link>
        <Link className={`${css.item} ${css.itemKeep}`} to={chart}>
          <b className={css.itemTitle}>{t.nav.chart}</b>
          <small className={css.itemNote}>
            {t.homeNav.chart[0]}
            <br />
            {t.homeNav.chart[1]}
          </small>
        </Link>
        <Link className={css.item} to={localePath(lang, '/method')}>
          <b className={css.itemTitle}>{t.nav.method}</b>
          <small className={css.itemNote}>
            {t.homeNav.method[0]}
            <br />
            {t.homeNav.method[1]}
          </small>
        </Link>
        <a className={css.item} href={helpUrl(lang, 'knowledge')}>
          <b className={css.itemTitle}>{t.nav.knowledge}</b>
          <small className={css.itemNote}>
            {t.homeNav.knowledge[0]}
            <br />
            {t.homeNav.knowledge[1]}
          </small>
        </a>
        <a className={css.item} href={helpUrl(lang, 'install')}>
          <b className={css.itemTitle}>{t.nav.install}</b>
          <small className={css.itemNote}>
            {t.homeNav.install[0]}
            <br />
            {t.homeNav.install[1]}
          </small>
        </a>
        <p className={css.blurb}>{t.homeNav.blurb}</p>
        <ThemeButton className={css.theme} />
      </nav>

      <section className={css.hero}>
        <h1 className={css.title}>
          {t.home.title[0]}
          <br />
          {t.home.title[1]}
        </h1>
        <p className={css.lede}>
          {t.home.lede[0]}
          <span className={css.nowrap}>{t.home.lede[1]}</span>
        </p>
        <div className={css.cta}>
          <Link className={`${controls.button} ${css.ctaButton}`} to={chart}>
            {t.home.ctaChart}
          </Link>
          <a className={`${controls.ghost} ${css.ctaButton}`} href={helpUrl(lang, 'install')}>
            {t.home.ctaInstall}
          </a>
        </div>
        <div className={css.facts}>
          <div className={css.fact}>
            <small className={css.factLabel}>{t.home.facts.kernel}</small>
            <b className={css.factValue}>x-iztro</b>
          </div>
          <div className={css.fact}>
            <small className={css.factLabel}>{t.home.facts.pack}</small>
            <b className={css.factValue}>iztro-docs</b>
          </div>
          <div className={css.fact}>
            <small className={css.factLabel}>{t.home.facts.pasteTo}</small>
            <b className={css.factValue}>{t.home.facts.pasteToValue}</b>
          </div>
        </div>
      </section>

      <Link className={css.boardLink} to={chart} aria-label={t.home.boardLink}>
        <EmptyBoard className={css.board} />
      </Link>

      <a className={css.credit} href={RUBBING_SOURCE} target="_blank" rel="noopener">
        {t.home.credit}
      </a>
    </main>
  );
}
