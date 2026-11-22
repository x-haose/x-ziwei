/**
 * 字体来源。原始字体不进仓库：构建时按固定提交的地址下载，校验 SHA-256 后才使用。
 *
 * 四款都是 SIL OFL 1.1，取自 google/fonts 仓库提交 06bfe0d（2026-11-20），都是可变字体（wght 轴），
 * 一套切片覆盖全部字重。各款许可证全文在 `fonts/licenses/`，随切片一起发布。
 *
 * 保留字体名（RFN）：思源黑的许可证写明保留「Source」，修改版（切片即修改）必须改名，
 * 这里把它对外的名字改成 XZW Sans SC；思源宋与 Geist、Geist Mono 的许可证没有保留字体名，保持原名。
 */

const GOOGLE_FONTS = 'https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057';

export interface FontSource {
  /** 输出文件名前缀。 */
  id: string;
  /** CSS 里的 font-family，与切片内部的族名一致。 */
  family: string;
  url: string;
  sha256: string;
  /** 可变字体 wght 轴的范围，写进 @font-face 的 font-weight。 */
  weight: readonly [number, number];
  /**
   * `cjk`：按中文切片方案切成多片；`whole`：西文字体，整套字形转成一个 WOFF2。
   */
  slicing: 'cjk' | 'whole';
  /** 首屏预载：cjk 字体预载关键子集那一片，whole 字体预载整个文件。 */
  preload: boolean;
  /** 带 RFN 的字体：对外名字的子串替换，以及替换后不许再出现的子串。 */
  rename?: {
    replacements: ReadonlyArray<readonly [string, string]>;
    forbidden: readonly string[];
  };
  /** `fonts/licenses/` 下的许可证文件名。 */
  license: string;
}

export const FONT_SOURCES: readonly FontSource[] = [
  {
    id: 'serif',
    family: 'Noto Serif SC',
    url: `${GOOGLE_FONTS}/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf`,
    sha256: '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9',
    weight: [200, 900],
    slicing: 'cjk',
    preload: true,
    license: 'NotoSerifSC-OFL.txt',
  },
  {
    id: 'sans',
    family: 'XZW Sans SC',
    url: `${GOOGLE_FONTS}/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf`,
    sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
    weight: [100, 900],
    slicing: 'cjk',
    preload: true,
    rename: {
      replacements: [
        ['Noto Sans SC', 'XZW Sans SC'],
        ['NotoSansSC', 'XZWSansSC'],
      ],
      forbidden: ['Source', 'Noto Sans', 'NotoSans'],
    },
    license: 'NotoSansSC-OFL.txt',
  },
  {
    id: 'geist',
    family: 'Geist',
    url: `${GOOGLE_FONTS}/ofl/geist/Geist%5Bwght%5D.ttf`,
    sha256: '73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659',
    weight: [100, 900],
    slicing: 'whole',
    preload: true,
    license: 'Geist-OFL.txt',
  },
  {
    id: 'mono',
    family: 'Geist Mono',
    url: `${GOOGLE_FONTS}/ofl/geistmono/GeistMono%5Bwght%5D.ttf`,
    sha256: 'd00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196',
    weight: [100, 900],
    slicing: 'whole',
    preload: false,
    license: 'GeistMono-OFL.txt',
  },
];

/** Google Fonts 的简体中文切片策略（Apache-2.0），googlefonts/nam-files 提交 533d558（2026-11-11）。 */
export const SC_SLICING = {
  url: 'https://raw.githubusercontent.com/googlefonts/nam-files/533d55837754572ad40588fc1821c21adbf65b3e/slices/simplified-chinese_default.txt',
  sha256: 'cd022036048744a478b2d261131a90400bacbb9098b83efd0360f1e44122c2c1',
};

/** 策略之外的余字每片的码位数。这些字极少出现，片大一些、请求少一些。 */
export const REST_CHUNK = 1000;
