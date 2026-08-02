const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const chapters = [
  'start',
  'layout',
  'settings',
  'people',
  'schedule',
  'stats',
  'salary',
  'export',
  'reset',
  'faq',
];

(async () => {
  const root = path.resolve(__dirname, '..');
  const outputDir = path.join(root, '001');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  await page.goto(pathToFileURL(path.join(root, 'USER_GUIDE.html')).href, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);

  for (let index = 0; index < chapters.length; index += 1) {
    const number = String(index + 1).padStart(2, '0');
    await page.locator(`#${chapters[index]}`).screenshot({
      path: path.join(outputDir, `${number}.png`),
    });
  }

  await browser.close();
  console.log(`Captured ${chapters.length} chapters in ${outputDir}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
