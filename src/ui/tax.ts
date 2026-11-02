// Steuerregler: je Stufe ein Satz in Prozent mit − und + (Schritt 5 %), dazu ein Gesicht, das zeigt, ob die
// Bewohner den Satz tragen, und darunter die Vorschau „Einnahmen mit 5 % weniger / jetzt / mit 5 % mehr“.
// Steht im Hausfenster (eigene Stufe), im Kontor (Reiter Bilanz) und im Statistik-Fenster (Reiter Steuern).
// Die Zeilen sind Vorlagen für ui/live.ts: Satz, Gesicht und Vorschau werden nur ausgetauscht, nicht neu gebaut.
import './tax.css';
import { TIERS } from '../data';
import { Building, Game, HUMAN, TAX_MAX } from '../game';
import { Live } from './live';
import { fmt } from './util';

/** Schrittweite der Knöpfe in Prozentpunkten */
export const STEP = 5;

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

/** Abzug an Zufriedenheit durch die Steuern – wie im Spiel (Game.tickHouse): über dem tragbaren Satz
 *  3 Punkte je Prozent, ab 5 darüber 6 Punkte; darunter bis zu 10 Punkte Zugewinn */
function penalty(over: number): number {
  return over > 0 ? over * 0.03 + Math.max(0, over - 5) * 0.03 : -Math.min(0.1, -over * 0.01);
}

/**
 * Steuern einer Stufe je Minute (alle Inseln) bei einem anderen Satz – geschätzt: Satz × Zufriedenheit^1,3,
 * die Zufriedenheit ändert sich um den Unterschied im Steuerabzug (wie Game.houseTax und Game.tickHouse rechnen).
 */
export function taxAt(g: Game, tier: number, rate: number): number {
  const t = TIERS[tier], now = g.taxRate(tier);
  let sum = 0;
  for (const h of g.buildings) {
    if (h.owner !== HUMAN || h.type !== 'haus' || h.tier !== tier) continue;
    const bear = g.bearableTax(h);
    // beim heutigen Satz genau die heutige Steuer (wie Game.houseTax)
    const happy = rate === now ? h.happy : Math.max(0, Math.min(1, h.happy - (penalty(rate - bear) - penalty(now - bear))));
    sum += h.residents * t.tax * (rate / t.taxStd) * Math.pow(happy, 1.3);
  }
  return sum;
}

/** Farbe einer Vorschau: rot, wenn die Bewohner den Satz nicht tragen */
const cls = (rate: number, bear: number | null) => (bear !== null && rate > bear + 3 ? 'neg' : bear !== null && rate > bear ? 'warn' : '');

/**
 * Reglerzeile für eine Stufe (Vorlage für ui/live.ts); bear = tragbarer Satz (Haus oder Mittel der Stufe).
 * preview = darunter die Einnahmen der ganzen Stufe bei −5 % / jetzt / +5 %
 */
export function taxRowHtml(L: Live, g: Game, tier: number, bear: number | null, label = TIERS[tier].name, preview = true): string {
  const rate = g.taxRate(tier);
  const m = mood(rate, bear);
  const lo = Math.max(0, rate - STEP), hi = Math.min(TAX_MAX, rate + STEP);
  let h = `<div class="taxrow" data-taxtier="${tier}">
    <span class="taxlbl"><b>${L.v(m.face)} ${label}</b><small>${L.v(m.text)}</small></span>
    <button class="btn sq" data-taxdown="${tier}" aria-label="Steuer der ${TIERS[tier].dat} senken" ${L.dis(rate <= 0)}>−</button>
    <b class="taxval">${L.v(`${rate} %`)}</b>
    <button class="btn sq" data-taxup="${tier}" aria-label="Steuer der ${TIERS[tier].dat} erhöhen" ${L.dis(rate >= TAX_MAX)}>+</button>`;
  if (preview) {
    h += `<small class="taxprev">Taler/Min</small>
      <small ${L.cls(`taxp ${cls(lo, bear)}`)}>${L.v(rate > 0 ? '≈' + fmt(taxAt(g, tier, lo) + 0.5) : '–')}</small>
      <small class="taxp now">${L.v(fmt(taxAt(g, tier, rate) + 0.5))}</small>
      <small ${L.cls(`taxp ${cls(hi, bear)}`)}>${L.v(rate < TAX_MAX ? '≈' + fmt(taxAt(g, tier, hi) + 0.5) : '–')}</small>`;
  }
  return h + '</div>';
}

/** Knöpfe der Reglerzeilen in root anschließen; after = danach Zahlen auffrischen */
export function bindTax(root: HTMLElement, g: Game, after: () => void) {
  root.querySelectorAll<HTMLElement>('[data-taxdown],[data-taxup]').forEach((bt) => bt.addEventListener('click', () => {
    const tier = Number(bt.dataset.taxdown ?? bt.dataset.taxup);
    // auf ein Vielfaches von 5 einrasten (ältere Spielstände haben z. B. 36 %)
    const now = g.taxRate(tier);
    const next = bt.dataset.taxup !== undefined ? Math.floor(now / STEP) * STEP + STEP : Math.ceil(now / STEP) * STEP - STEP;
    g.setTaxRate(tier, next);
    // der Klick-Klang kommt schon vom Knopf selbst (ui.ts: jeder Knopf klickt hörbar)
    after();
  }));
}

/** erreichte Stufen des Spielers (mindestens ein Haus) */
export function reachedTiers(g: Game): boolean[] {
  const r = TIERS.map(() => false);
  for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'haus') r[b.tier] = true;
  return r;
}

/** Hinweis „Kasse leer? Steuern erhöhen“, wenn das Geld schwindet; '' = alles gut */
export function cashHint(g: Game): string {
  const inc = g.incomePerMinute();
  const bal = inc.tax - inc.upkeep;
  if (g.money < 0) return `💸 Kasse im Minus! Steuern erhöhen, Betriebe ohne Arbeit ruhen lassen oder Waren verkaufen. Über 10 000 Taler Schulden für 10 Minuten bedeuten Bankrott.`;
  if (bal < 0) return `💸 Du gibst mehr aus, als du einnimmst (−${fmt(-bal)} je Minute). Kasse leer? Steuern erhöhen – solange die Gesichter lachen, bleiben alle.`;
  return '';
}

/** Abschnitt „Steuern“ (Kontor und Statistik): nur Stufen, die es schon gibt (Regel 8) */
export function taxSectionHtml(L: Live, g: Game, island: number, intro = true): string {
  const reached = reachedTiers(g);
  if (!reached.some(Boolean)) return '';
  let h = intro ? `<p class="sub">Höhere Steuern bringen mehr Geld, machen aber unzufrieden. Fehlen Waren, tragen die Bewohner weniger. Unter dem Satz: Einnahmen der Stufe mit ${STEP} % weniger · jetzt · mit ${STEP} % mehr.</p>` : '';
  TIERS.forEach((_, t) => { if (reached[t]) h += taxRowHtml(L, g, t, bearableOfTier(g, t, island)); });
  return h;
}

/** Steuerzeile für ein einzelnes Haus (Gesicht nach diesem Haus, Vorschau für die ganze Stufe) */
export function houseTaxHtml(L: Live, g: Game, h: Building): string {
  return taxRowHtml(L, g, h.tier, g.bearableTax(h), `Steuer der ${TIERS[h.tier].name}`);
}
