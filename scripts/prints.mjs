// Prints dos aparelhos que importam e conferência de "nada rola". Uso: (npx vite --port 5199 rodando) node scripts/prints.mjs <pasta>
// Nunca iPhone SE. iPad 1180×820 e 820×1180; iPhone em pé 440×800, 390×844 e deitado 956×360.
// Sala testada em duas abas do mesmo navegador (?local, só em dev).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const pasta = process.argv[2] ?? 'prints';
const porta = process.env.PORTA ?? '5199';
mkdirSync(pasta, { recursive: true });
const telas = { 'ipad-deitado': [1180, 820], 'ipad-em-pe': [820, 1180], 'iphone-440x800': [440, 800], 'iphone-390x844': [390, 844], 'iphone-deitado': [956, 360] };
const browser = await chromium.launch();
const problemas = [];
const rolagem = async (page, rotulo) => {
  const r = await page.evaluate(() => { const v = document.querySelector('.vista'); return v ? v.scrollHeight - v.clientHeight : 0; });
  if (r > 1) problemas.push(`${rotulo}: rola ${r}px`);
};
const digitar = async (page, txt) => { for (const c of txt) await page.click(`[data-act=tecla][data-k="${c}"]`); };

for (const [nome, [width, height]] of Object.entries(telas)) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${porta}/?local`);
  await page.waitForSelector('[data-act=solo]');
  await rolagem(page, `${nome} início`);
  await page.screenshot({ path: `${pasta}/${nome}-1-inicio.png` });
  await page.fill('#nome', 'Maria Eduarda');
  await page.click('[data-act=solo]');
  await page.waitForSelector('[data-act=tecla]');
  await digitar(page, '1234567');
  await rolagem(page, `${nome} solo pergunta`);
  await page.screenshot({ path: `${pasta}/${nome}-2-solo-pergunta.png` });
  await page.click('[data-act=chutar]');
  await page.waitForSelector('[data-act=proxima]');
  await rolagem(page, `${nome} solo resposta`);
  await page.screenshot({ path: `${pasta}/${nome}-3-solo-resposta.png` });
  for (let i = 0; i < 9; i++) {
    await page.click('[data-act=proxima]'); await page.waitForSelector('[data-act=tecla]');
    await digitar(page, String(100 + i)); await page.click('[data-act=chutar]'); await page.waitForSelector('[data-act=proxima]');
  }
  await page.click('[data-act=proxima]'); await page.waitForSelector('[data-act=de-novo]');
  await rolagem(page, `${nome} solo fim`);
  await page.screenshot({ path: `${pasta}/${nome}-4-solo-fim.png` });

  // sala com 3 pessoas (abas)
  const a = await ctx.newPage();
  await a.goto(`http://localhost:${porta}/?local&as=ana`); await a.waitForSelector('[data-act=criar]');
  await a.fill('#nome', 'Ana'); await a.click('[data-act=criar]'); await a.waitForSelector('[data-act=iniciar]');
  const cod = (await a.textContent('.cod')).trim();
  const outros = [];
  for (const n of ['Léo', 'Maria Eduarda Albuquerque']) {
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${porta}/?local&as=${n.slice(0, 3)}`); await p.waitForSelector('[data-act=entrar]');
    await p.fill('#nome', n); await p.fill('#codigo', cod); await p.click('[data-act=entrar]'); await p.waitForSelector('.cod');
    outros.push(p);
  }
  await rolagem(a, `${nome} sala lobby`);
  await a.screenshot({ path: `${pasta}/${nome}-5-sala-lobby.png` });
  await a.click('[data-act=iniciar]');
  await a.waitForSelector('[data-act=tecla]'); await outros[0].waitForSelector('[data-act=tecla]');
  await digitar(a, '500'); await a.click('[data-act=chutar]');
  await rolagem(a, `${nome} sala espera`);
  await a.screenshot({ path: `${pasta}/${nome}-6-sala-espera.png` });
  await digitar(outros[0], '800'); await outros[0].click('[data-act=chutar]');
  await digitar(outros[1], '5'); await outros[1].click('[data-act=chutar]');
  await a.waitForSelector('[data-act=pular]');
  await rolagem(a, `${nome} sala resultado`);
  await a.screenshot({ path: `${pasta}/${nome}-7-sala-resultado.png` });
  await ctx.close();
}
await browser.close();
console.log(problemas.length ? 'ATENÇÃO:\n' + problemas.join('\n') : 'Nenhuma tela rola.');
