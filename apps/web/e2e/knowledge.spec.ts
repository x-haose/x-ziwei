import { readFileSync } from 'node:fs';
import { type Page, expect, test } from './test';

/** 知识包页：导入、组合、导出、删除与各种不可用的状态，以及排盘页的释义随组合变化。 */

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

const overlay = (id: string, name: string, intro: string) => ({
  schema: 1,
  id,
  version: '2026-11-20',
  language: 'zh-CN',
  extends: 'iztro-docs',
  source: { name },
  stars: { ziweiMaj: { intro } },
});

/** 打开知识包页，等内核与本机包库就绪（「选择文件」可用）。 */
async function openPage(page: Page) {
  await page.goto('/zh/knowledge');
  await expect(page.getByRole('button', { name: '选择文件' })).toBeEnabled({ timeout: 20000 });
}

async function paste(page: Page, json: unknown) {
  await page.getByRole('tab', { name: '粘贴 JSON' }).click();
  await page.getByRole('textbox', { name: '粘贴知识包 JSON' }).fill(typeof json === 'string' ? json : JSON.stringify(json, null, 2));
  await page.getByRole('button', { name: '校验并导入' }).click();
}

const row = (page: Page, id: string) => page.getByRole('listitem').filter({ has: page.getByText(id, { exact: true }) });

test('粘贴导入覆盖包，叠加到当前生效；本机的包与生效卡片随之更新', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '已导入' });
  await expect(result).toContainText('已导入「我的笔记」');
  await expect(result).toContainText('iztro-docs，改 1 条星曜');
  await expect(row(page, 'my-notes')).toContainText('改 1 条星曜，其余条目沿用 iztro-docs。');
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  await expect(result).toContainText('已在生效');
  const use = page.getByRole('region', { name: '当前生效' });
  await expect(use).toContainText('覆盖 1');
  await expect(use).toContainText('iztro-docs + 我的笔记');
  await page.reload();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 我的笔记');
});

test('导入失败逐条列出位置与改法：JSON 语法、内核拒绝、本机包库的规则', async ({ page }) => {
  await openPage(page);
  await paste(page, '{\n  "schema": 1,\n  "id": \n}');
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '没能导入' });
  await expect(result).toContainText('1 处要改');
  await expect(result).toContainText('JSON 第 4 行第 1 列');
  await page.getByRole('button', { name: '重新选择' }).click();

  await paste(page, { ...overlay('iztro-docs', '同名', 'x'), extends: 'nowhere' });
  await expect(result).toContainText('2 处要改');
  await expect(result).toContainText('id 不能是 iztro-docs');
  await expect(result).toContainText('指向的包 nowhere 不在本机');
  await page.getByRole('button', { name: '重新选择' }).click();

  // 包格式的问题由内核的 check 逐条给出：字段路径、原因与最接近的写法；提醒另列一组。
  await paste(page, { schema: 1, id: 'bad', language: 'zh-CN', extends: 'iztro-docs', stars: { ziweiMjj: { intro: 'x' }, tianjiMaj: { intor: 'y' } } });
  await expect(result).toContainText('2 处要改');
  await expect(result).toContainText('version');
  await expect(result).toContainText('stars.ziweiMjj');
  await expect(result).toContainText('「ziweiMjj」不是内核认识的标识，这一条不会生效。最接近的写法是「ziweiMaj」。');
  await expect(result).toContainText('另有 1 条提醒，不影响导入');
  await expect(result).toContainText('stars.tianjiMaj.intor');

  await page.getByRole('tab', { name: '选文件' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'pack.txt', mimeType: 'text/plain', buffer: Buffer.from('{}') });
  await expect(result).toContainText('不是 .json 文件');
  await expect(row(page, 'bad')).toHaveCount(0);
});

test('叠加顺序决定排盘页的释义与提示词出处；排盘页的「更换」立即改组合', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('a', '甲', '甲说紫微。'));
  await expect(page.getByText('已导入「甲」')).toBeVisible();
  await paste(page, overlay('b', '乙', '乙说紫微。'));
  await expect(page.getByText('已导入「乙」')).toBeVisible();
  await page.getByRole('button', { name: '把 甲 叠加到最后' }).click();
  await page.getByRole('button', { name: '把 乙 叠加到最后' }).click();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 甲 + 乙');

  const preview = page.getByRole('region', { name: '提示词预览' });
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(preview).toContainText('乙说紫微。');
  await expect(preview).not.toContainText('甲说紫微。');
  await expect(preview).toContainText('释义摘自知识包 iztro-docs 2026-08-19 + a 2026-11-20 + b 2026-11-20');

  await page.goto('/zh/knowledge');
  await page.getByRole('button', { name: '乙 前移' }).click();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 乙 + 甲');
  await page.goto(SAMPLE);
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(preview).toContainText('甲说紫微。');

  await page.getByRole('button', { name: /^释义：iztro-docs \+ 乙 \+ 甲/ }).click();
  await page.getByRole('dialog', { name: '释义用哪套知识包' }).getByRole('option', { name: 'iztro-docs，默认包' }).click();
  await expect(preview).not.toContainText('甲说紫微。');
  await expect(preview).toContainText('释义摘自知识包 iztro-docs 2026-08-19（');
});

test('导出的内容与导入的一致；默认包导出内核内置的全文', async ({ page }) => {
  await openPage(page);
  const pack = overlay('my-notes', '我的笔记', '笔记：紫微看格局。');
  await paste(page, pack);
  await expect(page.getByText('已导入「我的笔记」')).toBeVisible();
  const [mine] = await Promise.all([page.waitForEvent('download'), row(page, 'my-notes').getByRole('button', { name: '导出' }).click()]);
  expect(mine.suggestedFilename()).toBe('my-notes-2026-11-20.json');
  expect(JSON.parse(readFileSync((await mine.path())!, 'utf8'))).toEqual(pack);
  const [builtin] = await Promise.all([page.waitForEvent('download'), row(page, 'iztro-docs').getByRole('button', { name: '导出' }).click()]);
  const full = JSON.parse(readFileSync((await builtin.path())!, 'utf8')) as Record<string, Record<string, unknown>>;
  expect(full.id).toBe('iztro-docs');
  expect(Object.keys(full.stars!)).toHaveLength(162);
});

test('查看抽屉：按段浏览、搜索，覆盖包的条目标「覆盖」；Esc 关闭后焦点回到「查看」', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  await expect(page.getByText('已导入「我的笔记」')).toBeVisible();
  const view = row(page, 'my-notes').getByRole('button', { name: '查看' });
  await view.click();
  const drawer = page.getByRole('dialog', { name: '我的笔记' });
  await expect(drawer.getByRole('button', { name: '关闭' })).toBeFocused();
  await expect(drawer.getByRole('tab', { name: /格局/ })).toBeDisabled();
  await expect(drawer).toContainText('覆盖');
  await drawer.getByRole('button', { name: /紫微|ziweiMaj/ }).click();
  await expect(drawer).toContainText('笔记：紫微看格局。');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(view).toBeFocused();

  await row(page, 'iztro-docs').getByRole('button', { name: '查看' }).click();
  const builtin = page.getByRole('dialog', { name: 'iztro-docs' });
  await builtin.getByRole('searchbox').fill('ziweiMaj');
  await expect(builtin).toContainText('找到 1 条');
});

test('删除正在生效的包：确认框写明删后的组合，删后生效组合随之改变', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  await row(page, 'my-notes').getByRole('button', { name: '删除' }).click();
  const dialog = page.getByRole('alertdialog', { name: '删除「我的笔记」？' });
  await expect(dialog).toContainText('它正在生效，删除后从叠加里移除，剩下 iztro-docs。');
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused();
  await dialog.getByRole('button', { name: '删除' }).click();
  await expect(row(page, 'my-notes')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前生效' })).not.toContainText('我的笔记');
  await page.reload();
  await expect(page.getByText('还没有导入的包。')).toBeVisible();
});

test('存储不可用：页头提示，导入关闭，只列默认包', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto('/zh/knowledge');
  await expect(page.getByText('这个浏览器不让本页存数据')).toBeVisible();
  await expect(page.getByText('存储不可用，这里只列默认包。')).toBeVisible();
  await expect(page.getByRole('button', { name: '选择文件' })).toBeDisabled();
  await expect(page.getByText('存储不可用，导入已关闭')).toBeVisible();
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^释义：iztro-docs/ })).toBeVisible();
});

test('存满了：浏览器拒绝写入时写明原因，库不变', async ({ page }) => {
  await openPage(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: new URL(page.url()).origin, quotaSize: 1 });
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'.repeat(20)));
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '没能导入' });
  await expect(result).toContainText('存储空间满了');
  await expect(row(page, 'my-notes')).toHaveCount(0);
});

test('内核未装好：放置区与粘贴按钮写明在加载，默认包照常显示', async ({ page }) => {
  await page.route('**/*.wasm', () => undefined);
  await page.goto('/zh/knowledge');
  await expect(page.getByText('排盘内核加载中，加载完才能校验')).toBeVisible();
  await expect(row(page, 'iztro-docs')).toContainText('162');
  await page.getByRole('tab', { name: '粘贴 JSON' }).click();
  await expect(page.getByRole('button', { name: /^内核加载中 \d+%$/ })).toBeDisabled();
});

test('整包加它的覆盖包：以所选整包为底叠加，排盘页的释义与「更换」选项随之', async ({ page }) => {
  await openPage(page);
  await paste(page, { schema: 1, id: 'school', version: '2025-03-01', language: 'zh-CN', source: { name: '某门派' }, stars: { ziweiMaj: { intro: '本门说紫微。' } } });
  await page.getByRole('button', { name: '改用这个包' }).click();
  await paste(page, { ...overlay('school-notes', '门内笔记', '门内又说紫微。'), extends: 'school' });
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  const use = page.getByRole('region', { name: '当前生效' });
  await expect(use.getByRole('radio', { name: /某门派/ })).toBeChecked();
  await expect(use).toContainText('某门派 + 门内笔记');

  const preview = page.getByRole('region', { name: '提示词预览' });
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(preview).toContainText('门内又说紫微。');
  await expect(preview).toContainText('释义摘自知识包 school 2025-03-01 + school-notes 2026-11-20');
  await page.getByRole('button', { name: /^释义：某门派 \+ 门内笔记/ }).click();
  const options = page.getByRole('dialog', { name: '释义用哪套知识包' }).getByRole('option');
  await expect(options).toHaveText([/^iztro-docs默认包$/, /^某门派整包$/, /^某门派 \+ 门内笔记叠加$/]);
  await options.filter({ hasText: /^某门派整包$/ }).click();
  await expect(preview).toContainText('本门说紫微。');
});

test('两个标签页同时操作：改动按库里此刻的数据校验，另一页随之更新，库不会写坏', async ({ context, page }) => {
  await openPage(page);
  await paste(page, overlay('p1', '甲', '甲说紫微。'));
  await expect(page.getByText('已导入「甲」')).toBeVisible();
  await paste(page, overlay('p2', '乙', '乙说紫微。'));
  await expect(page.getByText('已导入「乙」')).toBeVisible();
  await page.getByRole('button', { name: '把 甲 叠加到最后' }).click();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 甲');

  const other = await context.newPage();
  await openPage(other);
  await expect(other.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 甲');
  await row(page, 'p1').getByRole('button', { name: '删除' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click();
  await expect(row(other, 'p1')).toHaveCount(0);
  await other.getByRole('button', { name: '把 乙 叠加到最后' }).click();
  for (const p of [page, other]) await expect(p.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 乙');
  await page.reload();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 乙');
  await expect(page.getByText('读不出本机的知识包')).toHaveCount(0);
});

test('库里的组合引用了不在本机的包：读库时移出并提示，页面照常可用', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('p2', '乙', '乙说紫微。'));
  await expect(page.getByText('已导入「乙」')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge');
        req.onsuccess = () => {
          const tx = req.result.transaction('state', 'readwrite');
          tx.objectStore('state').put({ mode: 'stack', stack: ['gone', 'p2'], whole: 'iztro-docs', wholeStack: [] }, 'use');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '生效组合里的 gone 已不在本机' })).toBeVisible();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 乙');
});

test('整包加覆盖包：换底包时原来的叠加移出并提示；删除整包时确认框写明覆盖包留在本机', async ({ page }) => {
  await openPage(page);
  const school = (id: string, name: string) => ({ schema: 1, id, version: '1', language: 'zh-CN', source: { name }, stars: { ziweiMaj: { intro: `${name}说。` } } });
  await paste(page, school('school', '某门派'));
  await page.getByRole('button', { name: '改用这个包' }).click();
  await paste(page, { ...overlay('school-notes', '门内笔记', '门内又说。'), extends: 'school' });
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  await paste(page, school('other', '别派'));
  await expect(page.getByText('已导入「别派」')).toBeVisible();
  const use = page.getByRole('region', { name: '当前生效' });
  await use.locator('label').filter({ hasText: '别派' }).click();
  await expect(page.getByRole('status').filter({ hasText: '换了底包，原来叠加在 某门派 上的 门内笔记 已移出叠加。' })).toBeVisible();
  await expect(use).toContainText('别派');
  await use.locator('label').filter({ hasText: '某门派' }).click();
  await page.getByRole('button', { name: '把 门内笔记 叠加到最后' }).click();
  await expect(use).toContainText('某门派 + 门内笔记');

  await row(page, 'school').getByRole('button', { name: '删除' }).click();
  const dialog = page.getByRole('alertdialog', { name: '删除「某门派」？' });
  await expect(dialog).toContainText('它正在生效，删除后改用默认包 iztro-docs。');
  await expect(dialog).toContainText('基于它的覆盖包 门内笔记 会留在本机，重新导入它之后才能再叠加。');
  await dialog.getByRole('button', { name: '删除' }).click();
  await expect(use.getByRole('radio', { name: /iztro-docs/ })).toBeChecked();
  await expect(row(page, 'school-notes')).toHaveCount(1);
  await page.getByRole('radio', { name: '在默认包上叠加' }).click();
  await expect(page.getByText('门内笔记 所基于的包不在本机')).toBeVisible();
});

test('id 里带逗号的包也能在排盘页「更换」里选用', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('a,b', '逗号', '逗号说紫微。'));
  await expect(page.getByText('已导入「逗号」')).toBeVisible();
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await page.getByRole('button', { name: /^释义：iztro-docs/ }).click();
  await page.getByRole('dialog', { name: '释义用哪套知识包' }).getByRole('option', { name: 'iztro-docs + 逗号，叠加' }).click();
  await expect(page.getByRole('region', { name: '提示词预览' })).toContainText('逗号说紫微。');
});

test('导入成功时提醒可以展开查看', async ({ page }) => {
  await openPage(page);
  await paste(page, { ...overlay('my-notes', '我的笔记', '笔记。'), stars: { ziweiMaj: { intro: '笔记。', intor: 'x' } } });
  const toggle = page.getByRole('button', { name: '1 条提醒' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: '已导入' })).toContainText('stars.ziweiMaj.intor');
});

test('旧版本导入、现在需要改的包：标为需要改并列出问题，移出生效组合，排盘照常', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('good', '好包', '好包说紫微。'));
  await expect(page.getByText('已导入「好包」')).toBeVisible();
  // 绕过导入直接写库，模拟 0.8 时导入、0.9 不再接受的包，并让生效组合引用它。
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge');
        req.onsuccess = () => {
          const tx = req.result.transaction(['packs', 'state'], 'readwrite');
          const raw = { schema: 1, id: 'old', version: '1', language: 'zh-CN', extends: 'iztro-docs', source: { name: '旧包' }, stars: { ziweiMjj: { intro: '旧。' } } };
          tx.objectStore('packs').put({ id: 'old', raw, importedAt: 1 });
          tx.objectStore('state').put({ mode: 'stack', stack: ['old', 'good'], whole: 'iztro-docs', wholeStack: [] }, 'use');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '旧包 按现在的格式规则需要改' })).toBeVisible();
  const old = row(page, 'old');
  await expect(old).toContainText('需要改');
  await expect(old).toContainText('stars.ziweiMjj');
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 好包');
  await expect(page.getByRole('button', { name: '把 旧包 叠加到最后' })).toHaveCount(0);
  const [file] = await Promise.all([page.waitForEvent('download'), old.getByRole('button', { name: '导出' }).click()]);
  expect(JSON.parse(readFileSync((await file.path())!, 'utf8')).stars).toEqual({ ziweiMjj: { intro: '旧。' } });

  await page.goto(SAMPLE);
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(page.getByRole('region', { name: '提示词预览' })).toContainText('好包说紫微。');
  await page.getByRole('button', { name: /^释义：iztro-docs \+ 好包/ }).click();
  await expect(page.getByRole('dialog', { name: '释义用哪套知识包' }).getByRole('option', { name: /旧包/ })).toHaveCount(0);
});

test('别的标签页开着旧版本的库：提示关掉它们，排盘页提示词先用默认包并写明原因；关掉后自动继续', async ({ context, page }) => {
  // 旧版本页面持有版本 1 的连接，且不处理升级请求。
  const old = await context.newPage();
  await old.goto('/zh/install');
  await old.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('packs', { keyPath: 'id' });
          req.result.createObjectStore('state');
        };
        req.onsuccess = () => {
          (window as unknown as { oldDb: IDBDatabase }).oldDb = req.result;
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );

  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await expect(page.getByText('本机知识包还没打开，释义暂用默认包')).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  const preview = page.getByRole('region', { name: '提示词预览' });
  await expect(preview).toContainText('释义摘自知识包 iztro-docs 2026-08-19');
  await expect(page.getByRole('button', { name: '复制提示词' })).toBeEnabled();

  const other = await context.newPage();
  await other.goto('/zh/knowledge');
  await expect(other.getByText('本机知识包还没打开')).toBeVisible();

  await old.evaluate(() => (window as unknown as { oldDb: IDBDatabase }).oldDb.close());
  await expect(page.getByText('本机知识包还没打开，释义暂用默认包')).toHaveCount(0);
  await expect(other.getByRole('button', { name: '选择文件' })).toBeEnabled({ timeout: 20000 });
});

test('别的标签页把库升到更新的版本：本页让出连接并提示刷新，对方的升级得以完成', async ({ context, page }) => {
  await openPage(page);
  const newer = await context.newPage();
  await newer.goto('/zh/install');
  const upgraded = await newer.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge', 99);
        req.onsuccess = () => {
          resolve(req.result.version);
          req.result.close();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(upgraded).toBe(99);
  await expect(page.getByText('请刷新这一页')).toBeVisible();
  await expect(page.getByRole('button', { name: '选择文件' })).toBeDisabled();
});

test('本机的库比这一页新（本站回退过版本）：提示刷新，不说成存储不可用', async ({ page }) => {
  await page.goto('/zh/install');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge', 50);
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.goto('/zh/knowledge');
  await expect(page.getByText('请刷新这一页')).toBeVisible();
  await expect(page.getByText('这个浏览器不让本页存数据')).toHaveCount(0);
});

test('需要改的包移出组合时写回失败：只试一次并写明原因，不反复重试', async ({ page }) => {
  await openPage(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge');
        req.onsuccess = () => {
          const tx = req.result.transaction(['packs', 'state'], 'readwrite');
          const raw = { schema: 1, id: 'old', version: '1', language: 'zh-CN', extends: 'iztro-docs', source: { name: '旧包' }, stars: { ziweiMjj: { intro: '旧。' } } };
          tx.objectStore('packs').put({ id: 'old', raw, importedAt: 1 });
          tx.objectStore('state').put({ mode: 'stack', stack: ['old'], whole: 'iztro-docs', wholeStack: [] }, 'use');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  // 让本页往生效组合的每次写入都以「存满了」失败，并数一数试了几次。
  await page.addInitScript(() => {
    const w = window as unknown as { statePuts: number };
    w.statePuts = 0;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (this.name !== 'state') return put.apply(this, args);
      w.statePuts++;
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '没能保存：这台设备给本站的存储空间满了' })).toBeVisible();
  await expect(row(page, 'old')).toContainText('需要改');
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => (window as unknown as { statePuts: number }).statePuts)).toBe(1);
});

test('底包需要改的整包上不能导入覆盖包', async ({ page }) => {
  await openPage(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-knowledge');
        req.onsuccess = () => {
          const tx = req.result.transaction('packs', 'readwrite');
          const raw = { schema: 1, id: 'school', version: '1', language: 'zh-CN', source: { name: '某门派' }, stars: { ziweiMjj: { intro: '旧。' } } };
          tx.objectStore('packs').put({ id: 'school', raw, importedAt: 1 });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(row(page, 'school')).toContainText('需要改');
  await paste(page, { ...overlay('on-school', '门内笔记', '门内又说。'), extends: 'school' });
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: '没能导入' })).toContainText('底包 school 需要先改好');
});
