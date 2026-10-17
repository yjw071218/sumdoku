// v2.1.5 · 정적 번역 감사: 소스의 한글 문자열 리터럴 중 번역표(UI_TRANSLATIONS)에 없는 것을 찾습니다.
// 사용: node tests/i18n-static-audit.cjs [lang]
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.resolve(__dirname, '../app/src/main/assets');
const ctx = { window: {}, document: { addEventListener() {}, querySelectorAll: () => [], documentElement: {} }, localStorage: { getItem() {}, setItem() {} }, navigator: { language: 'ko' } };
ctx.window.window = ctx.window; vm.createContext(ctx);
for (const f of fs.readdirSync(dir).filter(f => /^translations.*\.js$/.test(f))) {
  try { vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx); } catch (e) {}
}
const lang = process.argv[2] || 'en';
let D = (ctx.window.UI_TRANSLATIONS || {})[lang] || {};
// 앱 실행 후 덤프한 최종 번역표(build/ui-dict.json)가 있으면 함께 사용합니다(모듈이 실행 중 추가하는 번역 포함).
try { const dump = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../build/ui-dict.json'), 'utf8')); D = { ...D, ...(dump[lang] || {}) }; } catch (_) {}
const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, ch => '\\' + ch);
const toRx = k => new RegExp('^' + esc(k).replace(/\\?\{\d+\\?\}/g, '(.+?)') + '$');
const pats = Object.keys(D).filter(k => /\{\d+\}/.test(k)).map(toRx);
const miss = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && !/^translations|^i18n|hint-i18n|diff-names|^generator|puzzle-worker/.test(f))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  src.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const rx = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    let m;
    while ((m = rx.exec(line))) {
      let s = m[1] ?? m[2] ?? m[3];
      if (!/[가-힣]/.test(s)) continue;
      const after = line.slice(m.index + m[0].length);
      // 다국어 배열의 ko 항목(바로 뒤에 다른 언어 문자열이 오는 경우)은 건너뜁니다.
      if (/^\s*,\s*['"`][^가-힣'"`]*[A-Za-z]/.test(after)) continue;
      if (/^\s*:/.test(after)) continue; // 객체 키
      if (/^\s*\)/.test(after) && /(test|match|replace|includes|indexOf)\($/.test(line.slice(0, m.index).replace(/\s+$/, ''))) continue;
      let n = 0;
      s = s.replace(/\$\{[^}]*\}/g, () => '{' + (n++) + '}').trim();
      if (D[s]) continue;
      const probe = s.replace(/\{\d+\}/g, 'X');
      if (pats.some(p => p.test(probe))) continue;
      if (!miss.has(s)) miss.set(s, f + ':' + (i + 1));
    }
  });
}
for (const [s, w] of miss) console.log(w + '\t' + s);
console.error('missing', miss.size);
