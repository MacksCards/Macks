// Infofenster für Gebäude (Betrieb, Haus, Werft, Burg), das Kontor (Lager & Bilanz) und Inseln.
// Der Rahmen des Fensters (▾ einklappen, ✕ schließen) gehört zum Kern in ui.ts.
import './info.css';
import { BUILDINGS, GOOD, GOODS, GoodId, KONTOR_LEVELS, PRICES, SHIPS, ShipType, TIERS, UNITS, UnitType } from '../data';
import { atWar, canTrain, train } from '../combat';
import { Building, HUMAN } from '../game';
import { PFLANZEN, Pflanze, depositText } from '../world';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, costText, fmt, hpHtml, soft } from './util';

/** Reiter im Kontor: Lager (immer) und Handel (sobald ui/trade.ts Inhalt hat) */
type KontorTab = 'lager' | 'handel';

export class InfoPanel {
  private tab: KontorTab = 'lager';
  /** Kontor, für das der Reiter gewählt wurde (anderes Kontor = wieder Lager) */
  private tabFor = -1;

  constructor(private ui: UI) {}

  /** Inhalt für ein Gebäude oder für Lager & Bilanz (storage) zeigen */
  render(b: Building | null, storage: boolean) {
    if (b && b.owner !== HUMAN) { this.foreign(b); return; }
    if (storage || (b && b.type === 'kontor')) { this.kontor(b); return; }
    if (b) this.building(b);
  }

  renderIsland(id: number) {
    this.ui.setInfo(this.islandHtml(id));
  }

  /** Gebäude eines anderen Spielers */
  private foreign(b: Building) {
    const g = this.ui.g, pl = g.players[b.owner];
    let h = `<h3>${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name}</h3><p class="sub">Gehört ${pl?.name ?? 'jemand anderem'}.</p>`;
    if (b.type === 'haus') h += `<div class="row"><span>Bewohner</span><b>${b.residents}</b></div>`;
    h += hpHtml(b.hp ?? g.maxHp(b), g.maxHp(b));
    h += `<p class="sub">${atWar(g, HUMAN, b.owner) ? '⚔️ Ihr seid im Krieg.' : '🕊️ Ihr habt Frieden.'} Wähle Soldaten oder ein Schiff mit Kanonen und tippe hierher, um anzugreifen.${b.type === 'kontor' || b.type === 'markt' ? ' Fällt es, während deine Soldaten daneben stehen, gehört es dir – mit dem Land ringsum.' : ''}</p>`;
    this.ui.setInfo(h);
  }

  /** Kontor bzw. Lager & Bilanz der Insel im Blick */
  private kontor(b: Building | null) {
    const ui = this.ui, g = ui.g;
    const own = !!b && b.owner === HUMAN;
    const tabs: [KontorTab, string][] = [['lager', '📦 Lager']];
    if (own && ui.trade.ready) tabs.push(['handel', '⚖️ Handel']);
    if ((b?.id ?? -1) !== this.tabFor) { this.tab = 'lager'; this.tabFor = b?.id ?? -1; }
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'lager';
    let h = `<h3>${b ? '⚓ Kontor' : '📦 Lager & Bilanz'}</h3>`;
    // Reiter nur, wenn es mehr als einen gibt
    if (tabs.length > 1) h += `<div class="tabs" role="tablist">${tabs.map(([id, name]) => `<button class="btn tab${id === this.tab ? ' active' : ''}" role="tab" aria-selected="${id === this.tab}" data-tab="${id}">${name}</button>`).join('')}</div>`;
    if (this.tab === 'handel' && b) {
      h += ui.trade.kontorHtml(b);
      if (ui.setInfo(h)) { this.bindTabs(); ui.trade.bindKontor($('#infoBody'), b); }
      return;
    }
    const inc = g.incomePerMinute();
    const pt = g.popByTier();
    h += `<p class="sub">Lagerplatz: ${g.capacity} je Ware</p>`;
    let foot = '';
    if (b && own) {
      const nl = KONTOR_LEVELS[(b.level ?? 0) + 1];
      h += `<p class="sub">Kontor ${['I', 'II', 'III', 'IV'][b.level ?? 0]}</p>`;
      if (nl) {
        const locked = nl.unlock && !g.reached(nl.unlock);
        if (locked) h += `<p class="sub">🔒 Ausbau ab ${nl.unlock!.n} ${TIERS[nl.unlock!.tier].dat}</p>`;
        else foot = `<button class="btn ok" id="kUp">⬆️ Ausbauen: Lager ${nl.storage} t<small>${costText(nl.cost)}</small></button>`;
      }
      h += `<h4>Freier Händler</h4><p class="sub">Kaufen/verkaufen je 5 t (Preis je Tonne).</p>`;
      for (const gd of GOODS) {
        const pr = PRICES[gd.id];
        if (!pr || (!ui.relevant.has(gd.id) && g.goods[gd.id] < 1)) continue;
        h += `<div class="trade"><span>${gd.icon} ${gd.name}</span><button class="btn" data-buy="${gd.id}">+5 · ${pr.kaufen}</button><button class="btn" data-sell="${gd.id}">−5 · ${pr.verkaufen}</button></div>`;
      }
    }
    h += `<h4>Lager</h4><div class="grid">`;
    for (const gd of GOODS) {
      const v = g.goods[gd.id];
      if (!ui.relevant.has(gd.id) && v < 1) continue;
      h += `<div class="row ${v >= g.capacity ? 'warn' : ''}"><span>${gd.icon} ${gd.name}</span><b>${fmt(v)}</b></div>`;
    }
    h += `</div><h4>Bilanz pro Minute</h4>
      <div class="row"><span>Steuern</span><b class="pos">+${fmt(inc.tax)}</b></div>
      <div class="row"><span>Unterhalt</span><b class="neg">−${fmt(inc.upkeep)}</b></div>
      <h4>Einwohner</h4>`;
    TIERS.forEach((t, i) => { h += `<div class="row"><span>${t.name}</span><b>${pt[i]}</b></div>`; });
    if (!ui.setInfo(h, foot)) return;
    this.bindTabs();
    document.getElementById('kUp')?.addEventListener('click', () => {
      const res = g.kontorUpgrade(b!);
      ui.toast(res.ok ? 'Kontor ausgebaut – mehr Lagerplatz!' : res.reason ?? '', res.ok ? 'good' : 'bad');
      ui.renderInfo();
    });
    $('#infoBody').querySelectorAll<HTMLElement>('[data-buy],[data-sell]').forEach((bt) => bt.addEventListener('click', () => {
      const gid = (bt.dataset.buy ?? bt.dataset.sell) as GoodId;
      const n = g.trade(HUMAN, b!.island, gid, bt.dataset.buy ? 5 : -5);
      if (n) sound.play('muenzen');
      if (!n) ui.toast(bt.dataset.buy ? 'Nicht genug Taler oder Lager voll' : 'Nichts zum Verkaufen da', 'bad');
      ui.renderInfo();
    }));
  }

  private bindTabs() {
    $('#infoBody').querySelectorAll<HTMLElement>('[data-tab]').forEach((bt) => bt.addEventListener('click', () => {
      this.tab = bt.dataset.tab as KontorTab;
      this.ui.renderInfo();
    }));
  }

  /** eigenes Gebäude: Haus, Betrieb, Werft, Burg … */
  private building(b: Building) {
    const ui = this.ui, g = ui.g;
    const d = BUILDINGS[b.type];
    let h = '';
    /** Knöpfe der festen Fußleiste */
    let foot = '';
    if (b.type === 'haus') {
      const tier = TIERS[b.tier];
      const cov = g.coverage.get(b.id) ?? new Set();
      h += `<h3>🏠 Haus der ${tier.name}</h3>
        <div class="row"><span>Bewohner <b>${b.residents} / ${tier.maxResidents}</b></span><span>Zufrieden <b>${Math.round(b.happy * 100)} %</b></span></div>
        <div class="bar"><i style="width:${Math.round(b.happy * 100)}%;background:${b.happy > 0.85 ? '#6c3' : b.happy > 0.45 ? '#eb3' : '#d43'}"></i></div>
        <h4>Bedürfnisse</h4><div class="chips">`;
      // kompakt in zwei Spalten (Waren aus dem Lager, Gebäude in der Nähe)
      for (const gId of Object.keys(tier.consumes) as GoodId[]) {
        const ok = (b.need[gId] ?? 1) > 0.6 && !b.short[gId];
        h += `<span title="${GOOD[gId].name}"><i>${GOOD[gId].icon} ${GOOD[gId].name}</i><b>${ok ? '✅' : '❌'}</b></span>`;
      }
      for (const s of tier.services) {
        h += `<span title="${BUILDINGS[s].name} in der Nähe"><i>${BUILDINGS[s].icon} ${BUILDINGS[s].name}</i><b>${cov.has(s) ? '✅' : '❌'}</b></span>`;
      }
      h += '</div>';
      const block = g.upgradeBlocker(b);
      if (b.tier < TIERS.length - 1) {
        const next = TIERS[b.tier + 1];
        h += `<h4>⬆️ Aufstieg zu ${next.name}</h4><p class="sub">${block ? '⏳ ' + block : '⬆️ Steigt gerade auf …'}</p>`;
        const l = g.goods;
        for (const grp of tier.next?.goods ?? []) {
          const ok = grp.some((x) => l[x] >= 1);
          h += `<div class="row"><span>${grp.map((x) => `${GOOD[x].icon} ${GOOD[x].name}`).join(' oder ')} im Lager</span><b>${ok ? '✅' : '❌'}</b></div>`;
        }
        for (const sv of tier.next?.services ?? []) {
          const unl = g.isUnlocked(sv);
          h += `<div class="row"><span>${BUILDINGS[sv].icon} ${BUILDINGS[sv].name} in der Nähe${unl ? '' : ` <small>(ab ${BUILDINGS[sv].unlock!.n} ${TIERS[BUILDINGS[sv].unlock!.tier].dat})</small>`}</span><b>${cov.has(sv) ? '✅' : '❌'}</b></div>`;
        }
        h += `<p class="sub">Baumaterial: ${costText(next.upgradeCost)}</p>`;
      } else h += `<p class="sub">🏆 Höchste Stufe erreicht</p>`;
      h += `<p class="sub">Steuern: ${(b.residents * tier.tax * (0.4 + 0.6 * b.happy)).toFixed(1)} Taler/Min</p>`;
    } else {
      h += `<h3>${d.icon} ${d.name}</h3><p class="sub">${d.desc}</p>`;
      if (d.prod) {
        const st: Record<string, string> = {
          ok: '✅ Arbeitet', keinWeg: '🚧 Kein Weg zum Kontor oder Marktplatz', lagerVoll: '📦 Voll – wartet auf den Marktkarren (Weg + Reichweite von Kontor/Marktplatz?)',
          keinWald: '🌲 Kein Wald in der Nähe', keinWasser: '🌊 Kein Wasser in der Nähe',
          erschoepft: d.deposit ? '⛏️ Das Vorkommen ist erschöpft' : ({ baum: '🌲 Keine erntereifen Bäume – Setzlinge wachsen nach', fisch: '🐟 Fischgründe leergefischt – erholen sich', wild: '🦌 Kein Wild mehr – kommt langsam zurück', weide: '🌿 Weide abgegrast – wächst nach', feld: '🌾 Felder erschöpft – wachsen nach' } as Record<string, string>)[d.harvest?.res ?? 'baum'],
          rohstoff: `⚠️ Es fehlt: ${b.missing.map((m) => GOOD[m].name).join(', ')}`,
        };
        const inp = Object.entries(d.prod.input ?? {}).map(([k, n]) => `${n} ${GOOD[k as GoodId].icon}`).join(' + ');
        h += `<div class="row"><span>Status</span><b>${st[b.status] ?? ''}</b></div>
          <div class="row"><span>Produziert</span><b>${inp ? inp + ' → ' : ''}${d.prod.amount ?? 1} ${GOOD[d.prod.output].icon} ${GOOD[d.prod.output].name} / ${Math.round(d.prod.time / Math.max(0.05, b.eff))} s</b></div>
          <div class="row"><span>${d.harvest ? 'Ergiebigkeit' : 'Standort'}</span><b>${Math.round(b.eff * 100)} %</b></div>
          ${d.harvest ? `<div class="bar"><i style="width:${Math.round(b.eff * 100)}%;background:${b.eff < 0.4 ? '#e2553f' : b.eff < 0.75 ? '#e8b93a' : '#7cc95a'}"></i></div>` : ''}
          <div class="row"><span>Im Betrieb gelagert</span><b>${Math.floor(b.stock)} / ${d.stock ?? 4} t</b></div>
          <div class="row"><span>Auslastung</span><b>${Math.round(b.active * 100)} %</b></div>
          <div class="bar"><i style="width:${Math.round((b.progress / d.prod.time) * 100)}%"></i></div>`;
      }
      if (d.work && d.prod) h += `<div class="row"><span>Arbeitsradius</span><b>${d.work} Felder</b></div>`;
      else if (d.radius) h += `<div class="row"><span>Reichweite</span><b>${d.radius} Felder</b></div>`;
      if (d.storage) h += `<div class="row"><span>Lager</span><b>+${d.storage} je Ware</b></div>`;
      if (d.tower) h += `<div class="row"><span>🎯 Schießt auf Feinde</span><b>${d.tower.range} Felder</b></div>`;
      if (d.trains) { const t = this.trainHtml(b); h += t.body; foot += t.foot; }
      if (b.type === 'werft' || b.type === 'grosswerft') {
        if (b.job) {
          const sd = SHIPS[b.job.ship];
          h += `<h4>Im Bau: ${sd.name}</h4><div class="bar"><i style="width:${Math.round((b.job.t / sd.time) * 100)}%"></i></div>`;
        } else {
          // Bestellknöpfe unten in der Fußleiste, Einzelheiten der Schiffe hier im Inhalt
          h += `<h4>Schiff bauen</h4>`;
          let locked: typeof SHIPS[ShipType] | null = null;
          for (const [id, sd] of Object.entries(SHIPS) as [ShipType, typeof SHIPS[ShipType]][]) {
            if (sd.build === false) continue;
            if (sd.werft === 'grosswerft' && b.type !== 'grosswerft') continue;
            if (!g.reached(sd.unlock)) { locked ??= sd; continue; }
            const chk = g.canOrderShip(b, id);
            h += `<div class="row"><span>⛵ ${sd.name}</span></div><p class="sub">${sd.slots} Laderäume · Tempo ${Math.round(sd.speed * 100)} % · bis ${sd.kanonen} Kanonen${chk.ok ? '' : ` · <span class="neg">${chk.reason}</span>`}</p>`;
            foot += `<button class="btn ${chk.ok ? 'ok' : ''}" data-ship="${id}" aria-label="${sd.name} bestellen">⛵ ${soft(sd.name)}<small>💰${sd.cost.taler} 🪵${sd.cost.holz} 🧵${sd.cost.stoff}</small></button>`;
          }
          if (locked) h += `<p class="sub">🔒 ${locked.name} ab ${locked.unlock.n} ${TIERS[locked.unlock.tier].dat}</p>`;
          if (foot) h += `<p class="sub">Tippe unten auf ein Schiff, um es zu bestellen.</p>`;
        }
      }
    }
    if (b.hp !== undefined) h += hpHtml(b.hp, g.maxHp(b));
    h += `<div class="row"><span>Unterhalt</span><b>${d.upkeep} Taler/Min</b></div>`;
    if (b.type !== 'kontor') foot += `<button class="btn danger" id="infoDel">💥 Abreißen</button>`;
    if (!ui.setInfo(h, foot)) return;
    // Knöpfe stehen im Inhalt oder in der Fußleiste: im ganzen Fenster suchen
    const box = $('#info');
    box.querySelectorAll<HTMLElement>('[data-train]').forEach((bt) => bt.addEventListener('click', () => {
      const res = train(g, b, bt.dataset.train as UnitType);
      if (res.ok) sound.play('marsch'); else ui.toast(res.reason ?? '', 'bad');
      ui.renderInfo();
    }));
    box.querySelectorAll<HTMLElement>('[data-ship]').forEach((bt) => bt.addEventListener('click', () => {
      const res = g.orderShip(b, bt.dataset.ship as ShipType);
      ui.toast(res.ok ? 'Die Werft beginnt mit dem Bau.' : res.reason ?? '', res.ok ? 'good' : 'bad');
      ui.renderInfo();
    }));
    document.getElementById('infoDel')?.addEventListener('click', () => {
      ui.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        ui.select(null);
      });
    });
  }

  /** Burg: Ausbildung (nur freigeschaltete Soldaten, dazu ein Hinweis auf den nächsten) */
  private trainHtml(b: Building): { body: string; foot: string } {
    const g = this.ui.g, d = BUILDINGS[b.type].trains!;
    const l = g.lagerOf(HUMAN, b.island);
    let h = `<h4>Ausbildung (${b.train?.length ?? 0} von ${d.slots})</h4>`, foot = '';
    for (const j of b.train ?? []) h += `<div class="row"><span>${UNITS[j.type].icon} ${UNITS[j.type].name}</span><b>${Math.ceil(j.t)} s</b></div><div class="bar"><i style="width:${Math.round((1 - j.t / d.time) * 10) * 10}%"></i></div>`;
    const locked = (Object.values(UNITS)).filter((ud) => !g.reached(ud.unlock)).sort((a, c) => a.unlock.tier - c.unlock.tier || a.unlock.n - c.unlock.n)[0];
    for (const [id, ud] of Object.entries(UNITS) as [UnitType, typeof UNITS[UnitType]][]) {
      if (!g.reached(ud.unlock)) continue;
      const chk = canTrain(g, b, id);
      const cost = Object.entries(ud.cost).map(([k, n]) => `${GOOD[k as GoodId].icon}${n} (da: ${Math.floor(l?.[k as GoodId] ?? 0)})`).join(' ');
      // Knopf unten in der Fußleiste, Einzelheiten hier im Inhalt
      h += `<div class="row"><span>${ud.icon} ${ud.name}</span><b>${cost}</b></div><p class="sub">❤️${ud.hp} · ${ud.range > 2 ? `Reichweite ${ud.range}` : 'Nahkampf'} · ${ud.upkeep} Taler/Min${chk.ok ? '' : ` · <span class="neg">${chk.reason}</span>`}</p>`;
      foot += `<button class="btn ${chk.ok ? 'ok' : ''}" data-train="${id}" aria-label="${ud.name} ausbilden">${ud.icon} ${soft(ud.name)}<small>ausbilden ${Object.entries(ud.cost).map(([k, n]) => `${GOOD[k as GoodId].icon}${n}`).join(' ')}</small></button>`;
    }
    if (locked) h += `<p class="sub">🔒 ${locked.icon} ${locked.plural} ab ${locked.unlock.n} ${TIERS[locked.unlock.tier].dat}</p>`;
    if (foot) h += `<p class="sub">Tippe unten auf eine Truppe, um sie auszubilden.</p>`;
    const mine = g.units.filter((u) => u.owner === HUMAN).length;
    if (mine) h += `<p class="sub">Du hast ${mine === 1 ? 'einen Soldaten' : `${mine} Soldaten`}. Tippe einen an, um ihn zu führen.</p>`;
    return { body: h, foot };
  }

  /** Inselinfo: Größe, Klima, Besitzer, Fruchtbarkeit, Vorkommen im Berg */
  islandHtml(id: number): string {
    const g = this.ui.g, isl = g.islands[id];
    const fr = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => isl.frucht[p]).map((p) =>
      `<div class="row"><span>${PFLANZEN[p].icon} ${PFLANZEN[p].name}</span><b>${isl.frucht[p]} %</b></div>`).join('');
    const owner = g.kontor(HUMAN, id) ? 'Deine Insel' : g.buildings.some((b) => b.island === id && b.type === 'kontor') ? 'Besetzt' : 'Unbesiedelt';
    const gr = { klein: 'klein', mittel: 'mittelgroß', gross: 'groß' }[isl.groesse];
    return `<h3>🏝️ ${isl.name}</h3><p class="sub">${gr} · ${isl.klima === 'nord' ? 'Nördliches' : 'Südliches'} Klima · ${owner}</p>
      <h4>Fruchtbarkeit</h4>${fr || '<p class="sub">Keine Plantagenpflanzen</p>'}
      <p class="sub">Holz, Getreide, Schafe und Schweine gehen überall.</p>
      <h4>Im Berg</h4><div class="row"><span>⛰️ Vorkommen</span><b>${depositText(isl)}</b></div>`;
  }
}
