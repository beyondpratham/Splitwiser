// Renders every app icon / splash asset from one SVG design: a coin split cleanly in half.
// Usage: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const GREEN_TOP = '#22D08B';
const GREEN_BOTTOM = '#0B9A64';
const INK = '#0E9F6A'; // the "$" cut-out, sits between the two gradient stops

// The coin: centered at (512,512), radius 290, with a "$" as negative space.
// It is cut along a line tilted ~22° from vertical; the two halves slide apart along that cut's normal.
const R = 290;
const GAP = 24; // how far each half moves away from the cut
const ANGLE = (22 * Math.PI) / 180;
const nx = Math.cos(ANGLE); // normal of the cut line
const ny = Math.sin(ANGLE);

function coin({ fill, ink, cutout = true }) {
  const dollar = `
    <path d="M598 418 C580 386 548 370 512 370 C458 370 422 398 422 440 C422 486 462 500 512 512
             C566 525 604 541 604 586 C604 630 566 656 512 656 C470 656 436 640 416 606"
          fill="none" stroke="${ink}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M512 316 V362 M512 664 V710" stroke="${ink}" stroke-width="54" stroke-linecap="round"/>`;
  return `
    <circle cx="512" cy="512" r="${R}" fill="${fill}"/>
    ${cutout ? dollar : ''}`;
}

// Half-planes on each side of the cut, as big polygons clipped to the canvas.
const far = 2000;
const dx = -ny; // direction along the cut
const dy = nx;
const p = (sx, sy) => `${512 + sx},${512 + sy}`;
const leftHalf = [p(dx * far, dy * far), p(dx * far - nx * far, dy * far - ny * far), p(-dx * far - nx * far, -dy * far - ny * far), p(-dx * far, -dy * far)].join(' ');
const rightHalf = [p(dx * far, dy * far), p(dx * far + nx * far, dy * far + ny * far), p(-dx * far + nx * far, -dy * far + ny * far), p(-dx * far, -dy * far)].join(' ');

function splitCoin(opts) {
  return `
    <defs>
      <clipPath id="L"><polygon points="${leftHalf}"/></clipPath>
      <clipPath id="R"><polygon points="${rightHalf}"/></clipPath>
    </defs>
    <g transform="translate(${-nx * GAP} ${-ny * GAP})" clip-path="url(#L)">${coin(opts)}</g>
    <g transform="translate(${nx * GAP} ${ny * GAP})" clip-path="url(#R)">${coin(opts)}</g>`;
}

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_TOP}"/>
      <stop offset="1" stop-color="${GREEN_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${background}
  ${splitCoin({ fill: '#FFFFFF', ink: INK })}
</svg>`;

// Android adaptive foreground must fit the inner 66% safe zone, on transparency.
const scaled = (inner, s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
     <g transform="translate(512 512) scale(${s}) translate(-512 -512)">${inner}</g>
   </svg>`;

const foreground = scaled(splitCoin({ fill: '#FFFFFF', ink: INK }), 0.72);
const monochrome = scaled(splitCoin({ fill: "#FFFFFF", ink: INK, cutout: false }), 0.72);
const androidBg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${background}</svg>`;
// Splash: the full icon tile with rounded corners, shown on a plain background.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><clipPath id="sq"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
  <g clip-path="url(#sq)">${background}${splitCoin({ fill: '#FFFFFF', ink: INK })}</g>
</svg>`;

function render(svgText, file, size) {
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(file, png);
  console.log(`✓ ${file} (${size}px)`);
}

writeFileSync('assets/icon.svg', icon);
render(icon, 'assets/icon.png', 1024);
render(splash, 'assets/splash-icon.png', 512);
render(foreground, 'assets/android-icon-foreground.png', 1024);
render(androidBg, 'assets/android-icon-background.png', 1024);
render(monochrome, 'assets/android-icon-monochrome.png', 1024);
render(splash, 'assets/favicon.png', 64);
