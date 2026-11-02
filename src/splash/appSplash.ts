import { Capacitor } from '@capacitor/core';

/**
 * Porokh splash overlay (Android app only).
 * Logo sits exactly where the native splash icon is, so the hand-off is seamless.
 * Colours follow the system light/dark setting, same as the native splash.
 */

const TAGLINE = 'নিজেকে পরোখ করো এখনই';
const MIN_VISIBLE_MS = 1700;
const MAX_VISIBLE_MS = 6000;
const FADE_MS = 450;

const P_PATH =
  'M525 374H1048A477.5 477.5 0 0 1 1048 1329H893V1672H748V1184H1048A332.5 332.5 0 0 0 1048 519H669V882A312 312 0 0 0 525 971ZM525 1672V1182A230 230 0 0 1 755 952H1048A101.5 101.5 0 0 0 1048 749H892V872H748V603H1048A248 248 0 0 1 1048 1099H755A85 85 0 0 0 669 1184V1672Z';

const CSS = `
#pk-splash{
  position:fixed;inset:0;z-index:2147483647;
  display:flex;align-items:center;justify-content:center;
  --pk-bg:#FFFFFF;--pk-logo:#006CFD;--pk-tag:#5B6472;
  background:var(--pk-bg);opacity:1;
  transition:opacity ${FADE_MS}ms ease;
}
@media (prefers-color-scheme:dark){
  #pk-splash{--pk-bg:#0A0A0B;--pk-logo:#4D9CFF;--pk-tag:#A3A9B5}
}
#pk-splash.pk-out{opacity:0;pointer-events:none}
#pk-splash .pk-logo{width:74.4px;height:96.9px;display:block;overflow:hidden}
#pk-splash .pk-mark{fill:var(--pk-logo)}
#pk-splash .pk-shine{
  transform-box:fill-box;transform-origin:center;
  transform:translateX(0) skewX(-18deg);
  animation:pk-sweep 1.1s cubic-bezier(.4,0,.2,1) .3s forwards;
}
#pk-splash .pk-tag{
  position:absolute;left:0;right:0;top:calc(50% + 48.5px + 28px);
  margin:0;text-align:center;
  font:500 14px/1.4 'Hind Siliguri','Noto Sans Bengali',system-ui,sans-serif;
  letter-spacing:.2px;color:var(--pk-tag);
  opacity:0;transform:translateY(8px);
  animation:pk-rise .7s cubic-bezier(.22,.8,.3,1) .45s forwards;
}
@keyframes pk-rise{to{opacity:1;transform:none}}
@keyframes pk-sweep{to{transform:translateX(1500px) skewX(-18deg)}}
@media (prefers-reduced-motion:reduce){
  #pk-splash .pk-shine{display:none}
  #pk-splash .pk-tag{animation-duration:.01s;animation-delay:0s}
}
`;

const MARKUP = `
<svg class="pk-logo" viewBox="525 374 998 1299" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="pk-clip"><path d="${P_PATH}"/></clipPath>
    <linearGradient id="pk-g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path class="pk-mark" d="${P_PATH}"/>
  <g clip-path="url(#pk-clip)">
    <rect class="pk-shine" x="225" y="374" width="240" height="1299" fill="url(#pk-g)"/>
  </g>
</svg>
<p class="pk-tag">${TAGLINE}</p>
`;

function mountSplash() {
  if (typeof document === 'undefined') return;
  if (!Capacitor.isNativePlatform()) return; // website visitors never see it
  if (document.getElementById('pk-splash')) return;

  const style = document.createElement('style');
  style.id = 'pk-splash-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'pk-splash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = MARKUP;
  document.body.appendChild(el);

  const startedAt = performance.now();
  const root = document.getElementById('root');
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.add('pk-out');
    window.setTimeout(() => {
      el.remove();
      style.remove();
    }, FADE_MS + 60);
  };

  const check = () => {
    const elapsed = performance.now() - startedAt;
    const appReady = !root || root.childElementCount > 0;
    if (elapsed >= MAX_VISIBLE_MS || (elapsed >= MIN_VISIBLE_MS && appReady)) {
      finish();
      return;
    }
    window.setTimeout(check, 100);
  };
  window.setTimeout(check, MIN_VISIBLE_MS);
}

mountSplash();
