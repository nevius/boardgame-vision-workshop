// @ts-check
// The icons of the page: Lucide (https://lucide.dev, ISC licence, lucide-static 0.545.0), copied in as SVG paths,
// so no icon library loads at runtime. Licence: "Permission to use, copy, modify, and/or distribute this software
// for any purpose with or without fee is hereby granted" (ISC, Lucide Contributors; parts from Feather, MIT).
// A new icon: copy the inside of its <svg> from https://cdn.jsdelivr.net/npm/lucide-static@0.545.0/icons/<name>.svg
// and use the name in Icon, the bottom bar or a game's engine.setActions([{ icon: '<name>', … }]).
import { html } from 'htm/preact';

/** The inside of each icon's 24×24 SVG. */
export const ICONS = {
  camera: "<path d='M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z'/><circle cx='12' cy='13' r='3'/>",
  'camera-off': "<path d='M14.564 14.558a3 3 0 1 1-4.122-4.121'/><path d='m2 2 20 20'/><path d='M20 20H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 .819-.175'/><path d='M9.695 4.024A2 2 0 0 1 10.004 4h3.993a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v7.344'/>",
  'image-down': "<path d='M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21'/><path d='m14 19 3 3v-5.5'/><path d='m17 22 3-3'/><circle cx='9' cy='9' r='2'/>",
  'circle-dot': "<circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='1'/>",
  'step-forward': "<path d='M10.029 4.285A2 2 0 0 0 7 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z'/><path d='M3 4v16'/>",
  snowflake: "<path d='m10 20-1.25-2.5L6 18'/><path d='M10 4 8.75 6.5 6 6'/><path d='m14 20 1.25-2.5L18 18'/><path d='m14 4 1.25 2.5L18 6'/><path d='m17 21-3-6h-4'/><path d='m17 3-3 6 1.5 3'/><path d='M2 12h6.5L10 9'/><path d='m20 10-1.5 2 1.5 2'/><path d='M22 12h-6.5L14 15'/><path d='m4 10 1.5 2L4 14'/><path d='m7 21 3-6-1.5-3'/><path d='m7 3 3 6h4'/>",
  lock: "<rect width='18' height='11' x='3' y='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",
  dices: "<rect width='12' height='12' x='2' y='10' rx='2' ry='2'/><path d='m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6'/><path d='M6 18h.01'/><path d='M10 14h.01'/><path d='M15 6h.01'/><path d='M18 9h.01'/>",
  puzzle: "<path d='M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z'/>",
  box: "<path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'/><path d='m3.3 7 8.7 5 8.7-5'/><path d='M12 22V12'/>",
  'list-checks': "<path d='M13 5h8'/><path d='M13 12h8'/><path d='M13 19h8'/><path d='m3 17 2 2 4-4'/><path d='m3 7 2 2 4-4'/>",
  layers: "<path d='M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'/><path d='M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'/><path d='M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'/>",
  lightbulb: "<path d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5'/><path d='M9 18h6'/><path d='M10 22h4'/>",
  ellipsis: "<circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/>",
  images: "<path d='m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16'/><path d='M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2'/><circle cx='13' cy='7' r='1' fill='currentColor'/><rect x='8' y='2' width='14' height='14' rx='2'/>",
  'folder-open': "<path d='m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'/>",
  scan: "<path d='M3 7V5a2 2 0 0 1 2-2h2'/><path d='M17 3h2a2 2 0 0 1 2 2v2'/><path d='M21 17v2a2 2 0 0 1-2 2h-2'/><path d='M7 21H5a2 2 0 0 1-2-2v-2'/>",
  maximize: "<path d='M8 3H5a2 2 0 0 0-2 2v3'/><path d='M21 8V5a2 2 0 0 0-2-2h-3'/><path d='M3 16v3a2 2 0 0 0 2 2h3'/><path d='M16 21h3a2 2 0 0 0 2-2v-3'/>",
  minimize: "<path d='M8 3v3a2 2 0 0 1-2 2H3'/><path d='M21 8h-3a2 2 0 0 1-2-2V3'/><path d='M3 16h3a2 2 0 0 1 2 2v3'/><path d='M16 21v-3a2 2 0 0 1 2-2h3'/>",
  gauge: "<path d='m12 14 4-4'/><path d='M3.34 19a10 10 0 1 1 17.32 0'/>",
  'trash-2': "<path d='M10 11v6'/><path d='M14 11v6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'/><path d='M3 6h18'/><path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>",
  check: "<path d='M20 6 9 17l-5-5'/>",
  wrench: "<path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z'/>",
  'key-round': "<path d='M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z'/><circle cx='16.5' cy='7.5' r='.5' fill='currentColor'/>",
  braces: "<path d='M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1'/><path d='M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1'/>",
  timer: "<line x1='10' x2='14' y1='2' y2='2'/><line x1='12' x2='15' y1='14' y2='11'/><circle cx='12' cy='14' r='8'/>",
  'scroll-text': "<path d='M15 12h-5'/><path d='M15 8h-5'/><path d='M19 17V5a2 2 0 0 0-2-2H4'/><path d='M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3'/>",
  x: "<path d='M18 6 6 18'/><path d='m6 6 12 12'/>",
  expand: "<path d='m15 15 6 6'/><path d='m15 9 6-6'/><path d='M21 16v5h-5'/><path d='M21 8V3h-5'/><path d='M3 16v5h5'/><path d='m3 21 6-6'/><path d='M3 8V3h5'/><path d='M9 9 3 3'/>",
  shrink: "<path d='m15 15 6 6m-6-6v4.8m0-4.8h4.8'/><path d='M9 19.8V15m0 0H4.2M9 15l-6 6'/><path d='M15 4.2V9m0 0h4.8M15 9l6-6'/><path d='M9 4.2V9m0 0H4.2M9 9 3 3'/>",
  'move-diagonal': "<path d='M11 19H5v-6'/><path d='M13 5h6v6'/><path d='M19 5 5 19'/>",
  'list-ordered': "<path d='M11 5h10'/><path d='M11 12h10'/><path d='M11 19h10'/><path d='M4 4h1v5'/><path d='M4 9h2'/><path d='M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02'/>",
  'circle-alert': "<circle cx='12' cy='12' r='10'/><line x1='12' x2='12' y1='8' y2='12'/><line x1='12' x2='12.01' y1='16' y2='16'/>",
  loader: "<path d='M21 12a9 9 0 1 1-6.219-8.56'/>",
  pause: "<rect x='14' y='3' width='5' height='18' rx='1'/><rect x='5' y='3' width='5' height='18' rx='1'/>",
  hand: "<path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/>",
  'scan-search': "<path d='M3 7V5a2 2 0 0 1 2-2h2'/><path d='M17 3h2a2 2 0 0 1 2 2v2'/><path d='M21 17v2a2 2 0 0 1-2 2h-2'/><path d='M7 21H5a2 2 0 0 1-2-2v-2'/><circle cx='12' cy='12' r='3'/><path d='m16 16-1.9-1.9'/>",
  eye: "<path d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'/><circle cx='12' cy='12' r='3'/>",
  image: "<rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/>",
  'refresh-cw': "<path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/><path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/><path d='M8 16H3v5'/>",
  'rotate-ccw': "<path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/><path d='M3 3v5h5'/>",
};

/** @typedef {keyof typeof ICONS} IconName */

/**
 * One icon, in the current text colour. Decoration only: the button around it carries the aria-label.
 * @param {{ name: string, class?: string }} props
 */
export function Icon({ name, class: cls = 'size-6' }) {
  const inner = ICONS[/** @type {IconName} */ (name)] ?? ICONS.box;
  return html`<svg viewBox="0 0 24 24" class=${cls} fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: inner }}></svg>`;
}
