// Steuerregler (schlichte Fassung): je Stufe ein Satz in Prozent mit − und +, dazu ein Gesicht, das zeigt,
// ob die Bewohner den Satz tragen. Steht im Hausfenster (eigene Stufe) und im Kontor (alle erreichten Stufen).
// Das große Fenster für Steuern und Bilanz (Paket U2) kommt später und kann diese Bausteine weiterverwenden.
import './tax.css';
import { TIERS } from '../data';
import { Building, Game, HUMAN, TAX_MAX } from '../game';
import { sound } from '../audio';

/** Schrittweite der Knöpfe in Prozentpunkten */
const STEP = 2;

/** mittlerer tragbarer Satz der Häuser einer Stufe (insel = -1: alle Inseln); null = keine Häuser */
export function bearableOfTier(g: Game, tier: number, island = -1): number | null {
  let sum = 0, n = 0;
  for (const b of g.buildings) {
    if (b.owner !== HUMAN || b.type !== 'haus' || b.tier !== tier || (island >= 0 && b.island !== island)) continue;
    sum += g.bearableTax(b); n++;
  }
  return n ? sum / n : null;
}

/** Gesicht und kurzer Text: tragen die Bewohner den Satz? */
export function mood(rate: number, bear: number | null): { face: string; text: string } {
  if (bear === null) return { face: '😐', text: 'noch keine Häuser' };
  const b = Math.floor(bear);
  if (rate > bear + 3) return { face: '😠', text: `zu hoch – tragbar etwa ${b} %, Bewohner ziehen aus` };
  if (rate > bear) return { face: '😐', text: `knapp – tragbar etwa ${b} %` };
  return { face: '😊', text: `tragbar bis etwa ${b} %` };
}

/** eine Reglerzeile für eine Stufe; bear = tragbarer Satz (Haus oder Mittel der Stufe) */
export function taxRowHtml(g: Game, tier: number, bear: number | null, label = TIERS[tier].name): string {
  const rate = g.taxRate(tier);
  const m = mood(rate, bear);
  return `<div class="taxrow" data-taxtier="${tier}">
    <span class="taxlbl"><b>${m.face} ${label}</b><small>${m.text}</small></span>
    <button class="btn sq" data-taxdown="${tier}" aria-label="Steuer der ${TIERS[tier].dat} senken" ${rate <= 0 ? 'disabled' : ''}>−</button>
    <b class="taxval">${rate} %</b>
    <button class="btn sq" data-taxup="${tier}" aria-label="Steuer der ${TIERS[tier].dat} erhöhen" ${rate >= TAX_MAX ? 'disabled' : ''}>+</button>
  </div>`;
}

/** Knöpfe der Reglerzeilen in root anschließen; after = danach neu zeichnen */
export function bindTax(root: HTMLElement, g: Game, after: () => void) {
  root.querySelectorAll<HTMLElement>('[data-taxdown],[data-taxup]').forEach((bt) => bt.addEventListener('click', () => {
    const tier = Number(bt.dataset.taxdown ?? bt.dataset.taxup);
    g.setTaxRate(tier, g.taxRate(tier) + (bt.dataset.taxup !== undefined ? STEP : -STEP));
    sound.play('klick');
    after();
  }));
}

/** Abschnitt „Steuern“ im Kontor: nur Stufen, die es schon gibt (Regel 8) */
export function taxSectionHtml(g: Game, island: number): string {
  const reached = TIERS.map((_, t) => g.buildings.some((b) => b.owner === HUMAN && b.type === 'haus' && b.tier === t));
  if (!reached.some(Boolean)) return '';
  let h = `<h4>💰 Steuern</h4><p class="sub">Höhere Steuern bringen mehr Geld, machen aber unzufrieden. Fehlen Waren, tragen die Bewohner weniger.</p>`;
  TIERS.forEach((_, t) => { if (reached[t]) h += taxRowHtml(g, t, bearableOfTier(g, t, island)); });
  return h;
}

/** Steuerzeile für ein einzelnes Haus */
export function houseTaxHtml(g: Game, h: Building): string {
  return taxRowHtml(g, h.tier, g.bearableTax(h), `Steuer der ${TIERS[h.tier].name}`);
}
