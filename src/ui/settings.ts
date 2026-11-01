// Spielstart, Spielstände und Einstellungen (Paket P1):
//   • „Neues Spiel“: Schwierigkeit, Gegner, Piraten, Ereignisse, (Spielziel, Weltgröße – nur bei Auswahl),
//     Inselwelt-Nummer zum Teilen; vorher die Frage, ob das jetzige Spiel gesichert werden soll.
//   • „Spielstände“: Auto 1/Auto 2 (Selbstsicherung) und drei eigene Plätze; Laden, Sichern, Löschen,
//     Weitergeben als Text oder Datei und Einlesen.
//   • „Einstellungen“: Grafik (Auto/Hoch/Sparsam), Ton, Musik, Hinweis für Vollbild auf dem iPhone.
// Die Speicherarbeit selbst macht src/saves.ts, die Werte der Schwierigkeit stehen in src/schwierigkeit.ts.
import './settings.css';
import { Game, HUMAN, newSeed, type Ereignisse, type GameOptions, type Schwierigkeit } from '../game';
import type { UI } from '../ui';
import { sound } from '../audio';
import type { QualityMode } from '../render/quality';
import { GOALS } from '../score';
import { WORLD_SIZES } from '../world';
import { SCHWIERIGKEIT, STUFEN, stufe } from '../schwierigkeit';
import { OWN_SLOTS, SLOTS, type SaveMeta, type SlotId, datumText, saves, slotName, spielzeitText } from '../saves';
import { $, Part, fmt } from './util';

const GRAFIK_KEY = 'nu-grafik';

/** gespeicherte Wahl der Grafik (auto/hoch/sparsam) oder null */
export function grafikWahl(): string | null {
  try { return localStorage.getItem(GRAFIK_KEY); } catch { return null; }
}

/** Knopfreihe zum Auswählen (eine Wahl ist hervorgehoben) */
function seg(key: string, opts: [string, string][], cur: string): string {
  return `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button class="btn${v === cur ? ' on' : ''}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
}

/** Knopfreihe verbinden: Tipp wählt aus und meldet den Wert */
function bindSeg(box: HTMLElement, key: string, on: (v: string) => void) {
  const row = box.querySelector<HTMLElement>(`.seg[data-k="${key}"]`);
  row?.querySelectorAll<HTMLButtonElement>('button').forEach((bt) => bt.addEventListener('click', () => {
    row.querySelectorAll<HTMLButtonElement>('button').forEach((o) => { o.classList.toggle('on', o === bt); o.setAttribute('aria-pressed', String(o === bt)); });
    on(bt.dataset.v!);
  }));
}

const isStandalone = () => {
  try { return (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches; } catch { return false; }
};

/** Zahl der Computergegner eines Spiels (ohne Piraten, Händler, Ureinwohner) */
const rivals = (g: Game) => g.players.filter((p) => p.ai && !p.pirate && !p.trader && !p.natives).length;

export class SettingsWindow implements Part {
  /** Auswahl im Fenster „Neues Spiel“ (bleibt beim Zurückkehren erhalten) */
  private pick: { schwierigkeit: Schwierigkeit; gegner: number; piraten: boolean; ereignisse: Ereignisse; ziel: string; welt: number; seed: string } | null = null;
  /** gerade beim Laden oder Speichern (doppeltes Tippen verhindern) */
  private busy = false;

  constructor(readonly ui: UI) {}

  get ready(): boolean { return true; }

  // ---------- Neues Spiel ----------

  /** „Neues Spiel“: eine neue Inselwelt; back = was „Abbrechen“ danach öffnet (z. B. das Menü) */
  open(back?: () => void) {
    const ui = this.ui, g = ui.g;
    const p = this.pick ??= {
      schwierigkeit: g.opts.schwierigkeit, gegner: rivals(g), piraten: g.opts.piraten, ereignisse: g.opts.ereignisse,
      ziel: g.opts.ziel, welt: g.opts.weltgroesse, seed: String(newSeed()),
    };
    const desc = (s: Schwierigkeit) => `💰 ${fmt(SCHWIERIGKEIT[s].startgeld)} Taler Startgeld · ${SCHWIERIGKEIT[s].text}`;
    const box = ui.dialog({
      title: '🏝️ Neues Spiel', cls: 'settings newgame',
      body: `<div class="ngrid">
        <div class="ncell full"><span class="nlab">Schwierigkeit</span>
          ${seg('stufe', STUFEN.map((s) => [s, SCHWIERIGKEIT[s].name]), p.schwierigkeit)}
          <small class="ndesc" id="ngDesc">${desc(p.schwierigkeit)}</small></div>
        <div class="ncell"><span class="nlab">Konkurrenten</span>${seg('gegner', [0, 1, 2, 3].map((n) => [String(n), String(n)]), String(p.gegner))}</div>
        <div class="ncell"><span class="nlab">Piraten</span>${seg('piraten', [['an', '🏴‍☠️ Ja'], ['aus', 'Nein']], p.piraten ? 'an' : 'aus')}</div>
        <div class="ncell"><span class="nlab">Feuer, Pest, Dürre</span>${seg('ereignisse', [['aus', 'Aus'], ['mild', 'Mild'], ['normal', 'Normal']], p.ereignisse)}
          <small class="ndesc">Kommen erst später ins Spiel – deine Wahl gilt dann.</small></div>
        <div class="ncell"><span class="nlab">Inselwelt-Nummer</span>
          <div class="seed"><input id="ngSeed" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="9" value="${p.seed}" aria-label="Inselwelt-Nummer"><button class="btn sq" id="ngDice" aria-label="Neue Nummer würfeln">🎲</button></div>
          <small class="ndesc">Gleiche Nummer = gleiche Inseln (zum Teilen).</small></div>
        ${GOALS.length > 1 ? `<div class="ncell"><span class="nlab">Spielziel</span>${seg('ziel', GOALS.map((z) => [z.id, z.name]), p.ziel)}</div>` : ''}
        ${WORLD_SIZES.length > 1 ? `<div class="ncell"><span class="nlab">Weltgröße</span>${seg('welt', WORLD_SIZES.map((n, i) => [String(n), ['Klein', 'Mittel', 'Groß', 'Riesig'][i] ?? String(n)]), String(p.welt))}</div>` : ''}
      </div>`,
      foot: `<div class="row2"><button class="btn" id="newX">Abbrechen</button><button class="btn ok" id="newGo">⛵ Los!</button></div>`,
    });
    bindSeg(box, 'stufe', (v) => { p.schwierigkeit = v as Schwierigkeit; $('#ngDesc').textContent = desc(p.schwierigkeit); });
    bindSeg(box, 'gegner', (v) => { p.gegner = Number(v); });
    bindSeg(box, 'piraten', (v) => { p.piraten = v === 'an'; });
    bindSeg(box, 'ereignisse', (v) => { p.ereignisse = v as Ereignisse; });
    bindSeg(box, 'ziel', (v) => { p.ziel = v; });
    bindSeg(box, 'welt', (v) => { p.welt = Number(v); });
    const seed = $<HTMLInputElement>('#ngSeed');
    seed.addEventListener('input', () => { seed.value = seed.value.replace(/\D/g, '').slice(0, 9); p.seed = seed.value; });
    $('#ngDice').addEventListener('click', () => { p.seed = seed.value = String(newSeed()); });
    $('#newX').addEventListener('click', () => { ui.closeModal(); this.pick = null; back?.(); });
    $('#newGo').addEventListener('click', () => {
      const opts: Partial<GameOptions> = {
        schwierigkeit: p.schwierigkeit, startgeld: stufe(p.schwierigkeit).startgeld, piraten: p.piraten, ereignisse: p.ereignisse,
      };
      if (GOALS.length > 1) opts.ziel = p.ziel;
      if (WORLD_SIZES.length > 1) opts.weltgroesse = p.welt;
      const num = p.seed ? Number(p.seed) : newSeed();
      this.before(() => {
        this.pick = null;
        ui.onNewGame(Game.create(num, p.gegner, opts));
        ui.closeModal();
        ui.toast(`Eine neue Inselwelt wartet auf dich! (${SCHWIERIGKEIT[p.schwierigkeit].name})`, 'good');
      }, () => this.open(back));
    });
  }

  /**
   * Vor einem neuen oder geladenen Spiel: „Aktuelles Spiel sichern?“. Ohne Sichern bleibt es noch eine Weile
   * im anderen Auto-Platz. Bei einem frischen oder verlorenen Spiel wird nicht gefragt.
   */
  private before(next: () => void, back: () => void) {
    const ui = this.ui, g = ui.g;
    if (g.players[HUMAN].defeated || (g.time < 120 && !g.kontor())) { next(); return; }
    ui.dialog({
      title: '💾 Jetziges Spiel sichern?', cls: 'settings ask', dismiss: false,
      body: `<p class="sub">Ohne Sichern liegt dein jetziges Spiel nur noch etwa 5 Minuten in „Auto 1“ bzw. „Auto 2“.</p>`,
      foot: `<button class="btn wide ok" id="bfSave">💾 Auf eigenen Platz sichern</button>
        <div class="row2"><button class="btn" id="bfBack">Abbrechen</button><button class="btn danger" id="bfNo">Nicht sichern</button></div>`,
    });
    $('#bfBack').addEventListener('click', () => { ui.closeModal(); back(); });
    $('#bfNo').addEventListener('click', () => next());
    $('#bfSave').addEventListener('click', () => this.pickSlot(next, () => this.before(next, back)));
  }

  /** eigenen Platz wählen und das jetzige Spiel dort sichern; danach weiter mit next */
  private async pickSlot(next: () => void, back: () => void) {
    const ui = this.ui;
    const metas = await saves.list();
    ui.dialog({
      title: '💾 Wohin sichern?', cls: 'settings saves',
      body: `<div class="slist">${OWN_SLOTS.map((id) => this.row(id, metas.find((m) => m.slot === id), `<button class="btn ok" data-to="${id}">Hierhin</button>`)).join('')}</div>`,
      foot: `<button class="btn wide" id="psBack">Zurück</button>`,
    });
    $('#psBack').addEventListener('click', () => back());
    document.querySelectorAll<HTMLElement>('[data-to]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.to as SlotId;
      const go = async () => { if (await this.saveTo(id)) next(); else back(); };
      if (metas.some((m) => m.slot === id)) ui.ask(`„${slotName(id)}“ überschreiben?`, 'Der Stand, der dort liegt, ist danach weg.', '💾 Überschreiben', () => void go(), () => void this.pickSlot(next, back));
      else void go();
    }));
  }

  /** jetziges Spiel auf einen Platz schreiben (mit Meldung) */
  private async saveTo(id: SlotId): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    const ok = await saves.save(this.ui.g, id);
    this.busy = false;
    this.ui.toast(ok ? `💾 Auf „${slotName(id)}“ gesichert ✔` : '💾 Speichern nicht möglich – der Speicher des Browsers ist voll oder gesperrt.', ok ? 'good' : 'bad');
    return ok;
  }

  // ---------- Spielstände ----------

  /** eine Zeile der Liste: Name, Datum, Spielzeit, Einwohner, Geld, Schwierigkeit – rechts die Knöpfe */
  private row(id: SlotId, m: SaveMeta | undefined, buttons: string): string {
    const auto = SLOTS.find((s) => s.id === id)?.auto;
    const tag = auto && id === saves.cur ? '<small class="tag">läuft</small>' : '';
    const info = m
      ? `<small>${datumText(m.zeit)} · ⏱️ ${spielzeitText(m.spielzeit)} · 👥 ${fmt(m.einwohner)} · 💰 ${fmt(m.geld)} · ${m.stufe}</small>`
      : `<small class="leer">${auto ? 'noch nichts gespeichert' : 'frei'}</small>`;
    return `<div class="srow"><div class="sinfo"><b>${auto ? '🔄' : '📁'} ${slotName(id)}</b>${tag}${info}</div><div class="sbtn">${buttons}</div></div>`;
  }

  /** Liste aller Plätze: Laden, auf eigene Plätze Sichern und Löschen, Weitergeben und Einlesen */
  async openSaves(back?: () => void) {
    const ui = this.ui;
    const metas = await saves.list();
    const again = () => void this.openSaves(back);
    const box = ui.dialog({
      title: '💾 Spielstände', cls: 'settings saves',
      body: `<div class="slist">${SLOTS.map((s) => {
        const m = metas.find((x) => x.slot === s.id);
        const bts = (m ? `<button class="btn" data-load="${s.id}">Laden</button>` : '')
          + (s.auto ? '' : `<button class="btn ok" data-save="${s.id}">Sichern</button>`)
          + (m && !s.auto ? `<button class="btn sq danger" data-del="${s.id}" aria-label="${slotName(s.id)} löschen">🗑️</button>` : '');
        return this.row(s.id, m, bts);
      }).join('')}</div>
      <p class="sub">Das Spiel sichert sich selbst in „Auto 1“ und „Auto 2“ (abwechselnd alle 5 Minuten). Eigene Plätze beschreibst nur du.</p>
      ${saves.backend.art === 'indexeddb' ? '' : '<p class="sub warn">⚠️ Dieser Browser gibt dem Spiel nur wenig Speicher. Wichtige Stände lieber mit „Weitergeben“ aufheben.</p>'}`,
      foot: `<div class="row3"><button class="btn" id="svBack">Zurück</button><button class="btn" id="svOut">📤 Weitergeben</button><button class="btn" id="svIn">📥 Einlesen</button></div>`,
    });
    $('#svBack').addEventListener('click', () => { ui.closeModal(); back?.(); });
    $('#svOut').addEventListener('click', () => void this.openExport(again));
    $('#svIn').addEventListener('click', () => this.openImport(again));
    box.querySelectorAll<HTMLElement>('[data-save]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.save as SlotId;
      const go = async () => { await this.saveTo(id); again(); };
      if (metas.some((m) => m.slot === id)) ui.ask(`„${slotName(id)}“ überschreiben?`, 'Der Stand, der dort liegt, wird durch dein jetziges Spiel ersetzt.', '💾 Überschreiben', () => void go(), again);
      else void go();
    }));
    box.querySelectorAll<HTMLElement>('[data-del]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.del as SlotId;
      ui.ask(`„${slotName(id)}“ löschen?`, 'Der Spielstand auf diesem Platz ist danach weg.', '🗑️ Löschen', async () => {
        const ok = await saves.remove(id);
        ui.toast(ok ? `„${slotName(id)}“ gelöscht` : 'Löschen nicht möglich', ok ? 'info' : 'bad');
        again();
      }, again);
    }));
    box.querySelectorAll<HTMLElement>('[data-load]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.load as SlotId;
      this.before(() => void this.loadFrom(id, again), again);
    }));
  }

  /** Stand laden und das Spiel damit ersetzen */
  private async loadFrom(id: SlotId, back: () => void) {
    if (this.busy) return;
    this.busy = true;
    const ui = this.ui;
    try {
      const g = await saves.load(id);
      ui.onNewGame(g);
      ui.closeModal();
      ui.toast(`„${slotName(id)}“ geladen ✔`, 'good');
    } catch (e) {
      ui.toast(`„${slotName(id)}“ ließ sich nicht laden: ${(e as Error).message}`, 'bad');
      back();
    } finally { this.busy = false; }
  }

  /** jetziges Spiel als Text (zum Kopieren) oder als Datei weitergeben */
  private async openExport(back: () => void) {
    const ui = this.ui;
    let text = '';
    try { text = await saves.exportText(ui.g); } catch { ui.toast('Weitergeben nicht möglich', 'bad'); return; }
    ui.dialog({
      title: '📤 Spiel weitergeben', cls: 'settings io',
      body: `<p class="sub">Dein jetziges Spiel als Text. Kopiere ihn (z. B. in die Notizen) oder sichere ihn als Datei. Mit „Einlesen“ wird daraus wieder dein Spiel – auch auf einem anderen Gerät.</p>
        <textarea id="ioText" readonly rows="3" aria-label="Spielstand als Text"></textarea>`,
      foot: `<div class="row3"><button class="btn" id="ioBack">Zurück</button><button class="btn ok" id="ioCopy">📋 Kopieren</button><button class="btn" id="ioFile">📄 Als Datei</button></div>`,
    });
    const ta = $<HTMLTextAreaElement>('#ioText');
    ta.value = text;
    $('#ioBack').addEventListener('click', () => back());
    $('#ioCopy').addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {
        try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch { ok = false; }
      }
      ui.toast(ok ? '📋 Kopiert ✔' : 'Kopieren nicht möglich – bitte den Text lange antippen und kopieren.', ok ? 'good' : 'bad');
    });
    $('#ioFile').addEventListener('click', () => {
      const d = new Date();
      const name = `neue-ufer-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.txt`;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }

  /** weitergegebenen Stand einlesen (Text einfügen oder Datei wählen) */
  private openImport(back: () => void) {
    const ui = this.ui;
    ui.dialog({
      title: '📥 Spiel einlesen', cls: 'settings io',
      body: `<p class="sub">Füge den Text eines weitergegebenen Spiels ein oder wähle die Datei.</p>
        <textarea id="ioText" rows="3" placeholder="NEUE-UFER-1:…" aria-label="Spielstand als Text"></textarea>
        <input type="file" id="ioPick" accept=".txt,text/plain" class="hidden">`,
      foot: `<div class="row3"><button class="btn" id="ioBack">Zurück</button><button class="btn" id="ioFile">📄 Datei wählen</button><button class="btn ok" id="ioGo">📥 Einlesen</button></div>`,
    });
    const ta = $<HTMLTextAreaElement>('#ioText'), pick = $<HTMLInputElement>('#ioPick');
    $('#ioBack').addEventListener('click', () => back());
    $('#ioFile').addEventListener('click', () => pick.click());
    pick.addEventListener('change', async () => { const f = pick.files?.[0]; if (f) ta.value = await f.text(); });
    $('#ioGo').addEventListener('click', async () => {
      if (!ta.value.trim()) { ui.toast('Bitte zuerst den Text einfügen', 'bad'); return; }
      let g: Game;
      try { g = await saves.importText(ta.value); } catch (e) { ui.toast(`Einlesen nicht möglich: ${(e as Error).message}`, 'bad'); return; }
      this.before(() => { ui.onNewGame(g); ui.closeModal(); ui.toast('📥 Spiel eingelesen ✔', 'good'); }, () => this.openImport(back));
    });
  }

  // ---------- Einstellungen ----------

  /** Grafik, Ton, Musik und ein paar Angaben zum laufenden Spiel */
  openOptions(back?: () => void) {
    const ui = this.ui, g = ui.g;
    const q = ui.view.quality.mode;
    const qText: Record<QualityMode, string> = {
      auto: 'Passt sich deinem Gerät an: schön, solange es flüssig läuft.',
      hoch: 'Immer die schönste Grafik (braucht mehr Akku).',
      sparsam: 'Schont den Akku: weniger Bilder je Sekunde und schlichtere Pflanzen.',
    };
    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const box = ui.dialog({
      title: '⚙️ Einstellungen', cls: 'settings opts',
      body: `<div class="ngrid">
        <div class="ncell full"><span class="nlab">Grafik</span>${seg('grafik', [['auto', 'Auto'], ['hoch', 'Hoch'], ['sparsam', 'Sparsam']], q)}<small class="ndesc" id="opQ">${qText[q]}</small></div>
        <div class="ncell"><span class="nlab">Ton</span>${seg('ton', [['an', '🔊 An'], ['aus', '🔇 Aus']], sound.soundOn ? 'an' : 'aus')}</div>
        <div class="ncell"><span class="nlab">Musik</span>${seg('musik', [['an', '🎵 An'], ['aus', '🔕 Aus']], sound.musicOn ? 'an' : 'aus')}</div>
      </div>
      <p class="sub">Dieses Spiel: ${stufe(g.opts.schwierigkeit).name} · ${rivals(g)} Konkurrenten · Inselwelt-Nummer ${g.seed}</p>
      ${touch && !isStandalone() ? '<p class="sub hint">📱 Für Vollbild: in Safari auf „Teilen“ ⬆️ tippen, dann „Zum Home-Bildschirm“.</p>' : ''}`,
      foot: `<button class="btn wide" id="opBack">Zurück</button>`,
    });
    bindSeg(box, 'grafik', (v) => {
      const m = v as QualityMode;
      ui.view.setQuality(m);
      try { localStorage.setItem(GRAFIK_KEY, m); } catch { /* egal */ }
      $('#opQ').textContent = qText[m];
    });
    bindSeg(box, 'ton', (v) => sound.setSound(v === 'an'));
    bindSeg(box, 'musik', (v) => sound.setMusic(v === 'an'));
    $('#opBack').addEventListener('click', () => { ui.closeModal(); back?.(); });
  }
}
