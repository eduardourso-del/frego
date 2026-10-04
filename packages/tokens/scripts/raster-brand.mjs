import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const kit = '/Users/eduardourso/Downloads/guia-aplicacao-digital/assets';
const out = new URL('../assets/', import.meta.url);

function render(svg, width, dest, background) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background,
  });
  writeFileSync(dest, resvg.render().asPng());
}

function file(path) {
  return readFileSync(path, 'utf8');
}

mkdirSync(new URL('./png/', out), { recursive: true });
mkdirSync(new URL('./splash/', out), { recursive: true });

const lojista = file(`${kit}/icones/frego-icone-lojista.svg`);
const fregues = file(`${kit}/icones/frego-icone-fregues.svg`);
const logoYellow = file(`${kit}/svg/frego-logo-yellow.svg`);
const logoBlack = file(`${kit}/svg/frego-logo-black.svg`);
const symbolYellow = file(`${kit}/svg/frego-symbol-yellow.svg`);
const symbolBlack = file(`${kit}/svg/frego-symbol-black.svg`);

render(lojista, 1024, new URL('./png/frego-icone-1024.png', out));
render(lojista, 512, new URL('./png/frego-icone-512.png', out));
render(lojista, 192, new URL('./png/frego-icone-192.png', out));
render(lojista, 180, new URL('./png/frego-icone-180.png', out));
render(lojista, 400, new URL('./png/frego-avatar-400.png', out));
render(lojista, 32, new URL('./png/frego-favicon-32.png', out));
render(lojista, 16, new URL('./png/frego-favicon-16.png', out));
render(fregues, 1024, new URL('./png/frego-icone-fregues-1024.png', out));

render(logoBlack, 1200, new URL('./png/frego-assinatura-escura-1200.png', out));
render(logoBlack, 600, new URL('./png/frego-assinatura-escura-600.png', out));
render(logoBlack, 300, new URL('./png/frego-assinatura-escura-300.png', out));
render(logoYellow, 1200, new URL('./png/frego-assinatura-clara-1200.png', out));
render(logoYellow, 600, new URL('./png/frego-assinatura-clara-600.png', out));
render(logoYellow, 300, new URL('./png/frego-assinatura-clara-300.png', out));

render(logoYellow, 880, new URL('./splash/wordmark-mostarda.png', out));
render(logoBlack, 880, new URL('./splash/wordmark-grafite.png', out));
render(symbolYellow, 432, new URL('./splash/symbol-mostarda.png', out));
render(symbolBlack, 432, new URL('./splash/symbol-grafite.png', out));

const logoInner = logoYellow
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');
const og = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#070707"/>
  <svg x="210" y="215" width="780" height="200" viewBox="0 0 3009 1000">${logoInner}</svg>
</svg>`;
render(og, 1200, new URL('./png/frego-compartilhamento-1200x630.png', out));

console.log('rasterized brand pngs');
