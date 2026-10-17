/* v2.1.8 · 공용 SVG 아이콘 (이모지 대체)
 * 사용: el.append(SumdokuIcon.el('lock')) 또는 SumdokuIcon.svg('lock', 14)
 * 모든 아이콘은 currentColor를 따르므로 글자색·테마와 자연스럽게 어울립니다.
 */
(() => {
  const P = {
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2"/>',
    check: '<path d="M4.5 12.5l4.8 4.8L19.5 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    crown: '<path d="M3 8l4.5 4L12 4.5 16.5 12 21 8l-2 11H5L3 8z"/><rect x="5" y="20" width="14" height="2" rx="1"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.8C22 6 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1.4" fill="#fff"/><circle cx="10" cy="7" r="1.4" fill="#fff"/><circle cx="14.5" cy="7" r="1.4" fill="#fff"/>',
    sparkle: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
    diamond: '<path d="M12 2l9 10-9 10-9-10z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 18 3-18" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>',
    rhombus4: '<path d="M12 1.5l3 3-3 3-3-3zM19.5 9l3 3-3 3-3-3zM12 16.5l3 3-3 3-3-3zM4.5 9l3 3-3 3-3-3z"/>',
    star4: '<path d="M12 3c.6 4.6 3.4 7.4 9 9-5.6 1.6-8.4 4.4-9 9-.6-4.6-3.4-7.4-9-9 5.6-1.6 8.4-4.4 9-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    wrench: '<path d="M21 6.5a5.5 5.5 0 0 1-7.4 5.2L6 19.3a2 2 0 0 1-2.8-2.8l7.6-7.6A5.5 5.5 0 0 1 17.5 3l-3 3 .8 2.7 2.7.8 3-3z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z"/>',
    timer: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4.5l3 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    pawn: '<circle cx="12" cy="6" r="3.2"/><path d="M9 10.5h6l1 6H8z"/><rect x="5.5" y="18" width="13" height="3.5" rx="1.2"/>',
    up: '<path d="M12 4l7 8h-4.5v8h-5v-8H5z"/>'
  };
  const svg = (name, size = 14) => P[name]
    ? `<svg class="sd-ico sd-ico-${name}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false">${P[name]}</svg>`
    : '';
  const el = (name, size) => { const s = document.createElement('span'); s.className = 'sd-ico-wrap'; s.innerHTML = svg(name, size); return s; };
  /** CSS mask-image 용 data URI (가상 요소 장식용) */
  const uri = name => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000">${(P[name] || '').replace(/currentColor/g, '#000').replace(/#fff/g, '#000')}</svg>`)}")`;
  window.SumdokuIcon = { svg, el, uri, names: Object.keys(P) };
})();
