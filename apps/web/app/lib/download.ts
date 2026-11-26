/** 在浏览器里下载一份 JSON：缩进两格，末尾换行。 */
export function downloadJson(value: object, file: string): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
