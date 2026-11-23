import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Astrolabe } from 'x-iztro';
import { encodeBirth, type Birth } from '../birth/birth';
import { Board } from '../chart/board';
import { ChartCentre } from '../chart/centre';
import { decadalClockwise, decadalOfAge, huaTexts, nominalAge, palaceViews, surround } from '../chart/model';
import { castChart, todayOf } from '../chart/session';
import * as controls from '../components/controls.css';
import { Glyph } from '../components/icons';
import { ThemeButton } from '../components/theme-button';
import { localePath } from '../i18n/lang';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { createLunarCalendar } from '../kernel/lunar';
import { helpUrl } from '../lib/site';
import * as css from './home.css';

/** 首页的示例盘：公历 2000-8-16 寅时 女（与设计稿同一张）。 */
const SAMPLE: Birth = { cal: 'solar', year: 2000, month: 8, leap: false, day: 16, time: { kind: 'hour', index: 2 }, gender: 'f' };

/** 引线指向命宫里的这颗主星。 */
const LEADER_STAR = 'ziweiMaj';

function SampleBoard({ kernel, chart, rootRef }: { kernel: Kernel; chart: Astrolabe; rootRef: RefObject<HTMLDivElement | null> }) {
  const t = useMessages();
  const hua = useMemo(() => huaTexts(kernel), [kernel]);
  const palaces = useMemo(() => palaceViews(chart, [], hua), [chart, hua]);
  const today = useMemo(() => todayOf(createLunarCalendar(kernel), new Date()), [kernel]);
  const soul = chart.palace('soulPalace');
  if (!soul) throw new Error('示例盘上没有命宫');
  const age = nominalAge(chart, today.year);
  const now = chart.decadalList()[decadalOfAge(chart, age)]?.index ?? null;
  return (
    <Board
      rootRef={rootRef}
      className={css.board}
      palaces={palaces}
      layers={[]}
      surround={surround(chart, soul.index)}
      nowDecadal={now}
      drawKey="home"
      ring={{ kind: 'chart', clockwise: decadalClockwise(palaces), markAge: age, selectedDecadal: null }}
      centre={(density) => <ChartCentre chart={chart} density={density} layer={undefined} layerLabel={null} t={t} />}
    />
  );
}

/**
 * 引线（宽屏）：从拓片上的紫微垣细圈引到示例盘命宫的「紫微」，旁注说明两者同名。
 * 两端位置都要量，盘或窗口尺寸一变就重画。
 */
function Leader({ home, ring, board, label }: { home: RefObject<HTMLElement | null>; ring: RefObject<HTMLElement | null>; board: RefObject<HTMLDivElement | null>; label: string }) {
  const [line, setLine] = useState<{ kx: number; ky: number; tx: number; ty: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const h = home.current;
      const r = ring.current;
      const star = board.current?.querySelector(`[data-star="${LEADER_STAR}"]`);
      if (!h || !r || !star || getComputedStyle(r).display === 'none') {
        setLine(null);
        return;
      }
      const hb = h.getBoundingClientRect();
      const rb = r.getBoundingClientRect();
      const sb = star.getBoundingClientRect();
      const cx = rb.left - hb.left + rb.width / 2;
      const cy = rb.top - hb.top + rb.height / 2;
      const rr = rb.width / 2;
      const tx = sb.left - hb.left + sb.width / 2;
      const ty = sb.top - hb.top - 8;
      const a = Math.atan2(ty - cy, tx - cx);
      setLine({ kx: cx + rr * Math.cos(a), ky: cy + rr * Math.sin(a), tx, ty });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (home.current) ro.observe(home.current);
    if (board.current) ro.observe(board.current);
    return () => ro.disconnect();
  }, [home, ring, board]);
  if (!line) return null;
  return (
    <svg className={css.leader} aria-hidden="true">
      <line className={css.leaderLine} x1={line.kx} y1={line.ky} x2={line.tx} y2={line.ty} />
      <circle className={css.leaderDot} cx={line.tx} cy={line.ty} r={2.5} />
      <text className={css.leaderText} x={Math.min(line.kx, line.tx) - 12} y={line.ky + (line.ty - line.ky) * 0.55} textAnchor="end" dominantBaseline="central">
        {label}
      </text>
    </svg>
  );
}

/** 拓片原图在 Wikimedia Commons 的页面（公有领域）。 */
const RUBBING_SOURCE = 'https://commons.wikimedia.org/wiki/File:Soochow_Planisphere_(Detail_2).jpg';

/**
 * 首页首屏：拓片满版，左下是主张与两个入口，右下是从底边浮出的盘。
 *
 * 拓片图 `public/img/rubbing-*.webp` 由 Commons 原图（缩到 1567px 宽的版本）转灰度，
 * 黑场 38、白场 180、gamma 1.3，得到石白线、纯黑底，再按 1400 与 900 两个宽度存为 WebP（质量 72）。
 * 明暗两套主题里的合成方式由令牌 `rubbing` 决定。
 *
 * 右下的盘是排盘内核算出的示例盘，内核装好之前显示空状态（只有地支与刻度）。
 */
export function Home() {
  const lang = useLang();
  const t = useMessages();
  const chart = localePath(lang, '/chart');
  const kstate = useKernelState();
  const kernel = kstate.status === 'ready' ? kstate.kernel : null;
  const sample = useMemo(() => (kernel ? castChart(kernel, SAMPLE, 2) : null), [kernel]);
  const packVersion = useMemo(() => (kernel ? kernel.KnowledgePack.builtin('zh-CN').version.split('+')[0] : null), [kernel]);
  const homeRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 失败会记进内核状态；首页的盘停在空状态，排盘页里有重试。
    loadKernel().catch(() => undefined);
  }, []);
  return (
    <main ref={homeRef} className={css.home}>
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
        <div ref={ringRef} className={css.ziwei} aria-hidden="true">
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
            <b className={css.factValue}>{packVersion ? `iztro-docs ${packVersion}` : 'iztro-docs'}</b>
          </div>
          <div className={css.fact}>
            <small className={css.factLabel}>{t.home.facts.pasteTo}</small>
            <b className={css.factValue}>{t.home.facts.pasteToValue}</b>
          </div>
        </div>
      </section>

      <Link className={css.boardLink} to={`${chart}#${encodeBirth(SAMPLE)}`} aria-label={t.home.boardLink}>
        {kernel && sample ? (
          <SampleBoard kernel={kernel} chart={sample} rootRef={boardRef} />
        ) : (
          <Board
            rootRef={boardRef}
            className={css.board}
            palaces={null}
            layers={[]}
            surround={null}
            nowDecadal={null}
            drawKey="home"
            ring={{ kind: 'blank' }}
            centre={() => null}
          />
        )}
      </Link>
      {sample && <Leader home={homeRef} ring={ringRef} board={boardRef} label={t.home.leader} />}

      <a className={css.credit} href={RUBBING_SOURCE} target="_blank" rel="noopener">
        {t.home.credit}
      </a>
    </main>
  );
}
