const {chromium} = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
  const page = await browser.newPage();
  await page.route('https://api.github.com/**', r => r.fulfill({json:{tag_name:'v1.0.43'}}));
  await page.goto('file:///' + path.resolve('app/src/main/assets/index.html').replace(/\\/g, '/'));
  await page.waitForFunction(() => window.app && window.I18N);

  const res = await page.evaluate(() => {
    const checks = {};
    // 기본 한국어
    checks.ko_brand = document.querySelector('[data-i18n="brand_tagline"]').textContent;
    checks.ko_gen = I18N.t('gen_title');
    checks.ko_nav_me = document.querySelector('[data-i18n="nav_me"]').textContent;
    checks.ko_setting_sound = document.querySelector('[data-i18n="setting_sound"]').textContent;
    checks.ko_game_diff = document.querySelector('[data-i18n="game_sub_diff"]').textContent;
    
    // 영어로 변경
    I18N.setLanguage('en');
    checks.en_brand = document.querySelector('[data-i18n="brand_tagline"]').textContent;
    checks.en_gen = I18N.t('gen_title');
    checks.en_step1 = document.querySelector('[data-i18n="gen_step_1"]').textContent;
    checks.en_nav_me = document.querySelector('[data-i18n="nav_me"]').textContent;
    checks.en_setting_sound = document.querySelector('[data-i18n="setting_sound"]').textContent;
    checks.en_game_diff = document.querySelector('[data-i18n="game_sub_diff"]').textContent;

    // 일본어로 변경
    I18N.setLanguage('ja');
    checks.ja_brand = document.querySelector('[data-i18n="brand_tagline"]').textContent;
    checks.ja_gen = I18N.t('gen_title');
    checks.ja_nav_me = document.querySelector('[data-i18n="nav_me"]').textContent;
    checks.ja_setting_sound = document.querySelector('[data-i18n="setting_sound"]').textContent;

    // 스페인어로 변경
    I18N.setLanguage('es');
    checks.es_brand = document.querySelector('[data-i18n="brand_tagline"]').textContent;

    // 다시 한국어로 복구
    I18N.setLanguage('ko');
    checks.ko_restore = document.querySelector('[data-i18n="brand_tagline"]').textContent;

    return checks;
  });

  console.log('I18N TEST RESULT:', JSON.stringify(res, null, 2));
  assert.equal(res.ko_brand, '논리로 채우는 81칸, 킬러 스도쿠');
  assert.equal(res.ko_nav_me, '나');
  assert.equal(res.ko_setting_sound, '사운드');
  assert.equal(res.en_brand, '81-Cell Pure Logic Killer Sudoku');
  assert.equal(res.en_step1, 'Solution');
  assert.equal(res.en_nav_me, 'Me');
  assert.equal(res.en_setting_sound, 'Sound');
  assert.equal(res.en_game_diff, 'Difficulty');
  assert.equal(res.ja_brand, '論理で解く81マス、キラー数独');
  assert.equal(res.ja_nav_me, 'マイページ');
  assert.equal(res.ja_setting_sound, 'サウンド');
  assert.equal(res.es_brand, 'Killer Sudoku de 81 casillas de pura lógica');
  assert.equal(res.ko_restore, '논리로 채우는 81칸, 킬러 스도쿠');
  await browser.close();
  console.log('PASS: i18n dynamic switching verified across multiple languages and UI elements');
})();
