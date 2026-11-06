# KI2b – Diagnose und Umbauplan (Computergegner: Krieg, Wachstum, Werft, Kontor verloren)

Stand: Commit c8f1ed8 (Spiellogik von ai.ts/game.ts/trade.ts gleich wie a0b359e; combat.ts nur Meldungstext anders).
Im Projekt wurde nichts geändert. Alle Messungen in Kopien unter
`/tmp/claude-0/-home-user-Macks/ea64aae4-b1e0-5446-8929-cd495394d32c/scratchpad/ki2b-diag/`:

| Datei | Inhalt |
|---|---|
| `tree/` + `diag.ts` | Kopie mit Messhaken (`globalThis.__D`): Ausgaben nach Zweck, Bauten, Auf-/Abstiege mit Grund, jede Bau-Entscheidung (gebaut ja/nein, Material-Sperre, Sparen, Rüsten, „arm“) |
| `frieden.log` | 8 Welten (Seeds 1,2,3,42,99,123,777,2024) × 3 Gegner, 120 min, normal, alle 10 min |
| `krieg.log` | 6 Welten, Spieler erklärt in Minute 60 allen den Krieg |
| `lock.log` | 3 Welten, 90 min: Grund der Material-Sperre |
| `tree2/` → `simA.log` | Probe A: Freischaltungen der KI dauerhaft (2 Welten) |
| `tree3/` → `simB.log`, `treeBd/` → `diagB-w1.log` | Probe B: A + Stoffe/Alkohol „nötig“ + KI-Steuern + keine Doppel-Werkstätten + Schmiede früh (5 Welten) |
| `tree4/` → `simW.log`, `treeWd/` → `diagW-w1.log` | Probe W: B + Alkohol-Sperre weg + Händler-Überbrückung + Söldner + Werft nötig + Wellen/Seeangriff + ki-sim mit Spieler-Kontor und Wellenzähler (6 Welten, `--krieg`) |
| `tree5/` → `sim5.log` | Probe 5: W + Eisen sofort + Werkzeug-Vorrat beim Händler + Kolonie ab 2 000 + Dienste sparsamer (4 Welten, Frieden) |
| `agg.py`, `cmp.py` | Auswertung |

Rechenzeit: Die Maschine war die ganze Zeit stark ausgelastet (Last 22–25 auf 4 Kernen, Browser-Tests anderer Arbeiten).
Zeiten aus diesen Läufen taugen nicht zur Abnahme – nach dem Umbau auf ruhiger Maschine mit `ki-sim --wdh 3` messen.

---

## 1. Befund in Zahlen (frieden.log, 8 Welten × 3 Gegner, heutiger Code)

* **Die KI tut fast nichts:** ab Minute 30 enden 92–100 % der Bau-Entscheidungen ohne Bau.
* **Baumaterial am Kontor gesperrt** (`matLock`) in 74–96 % der Entscheidungen ab Minute 30 → kein Haus steigt auf.
* **Sparen** für die nächste Insel in Minute 20–30: 48–80 % der Entscheidungen; **„arm“** (Kasse < halbe Reserve + 300): 62–82 %.
* **Geld geht in Werkzeug:** Netto-Einnahmen (Steuern − Unterhalt) aller 24 Gegner in 120 min ≈ 855 000 Taler. Davon
  317 000 Sofort-Käufe Werkzeug am Kontor (140 %) + 138 000 Werkzeug beim Händler = **53 %**. Sofort-Käufe Nahrung 160 000
  (19 %). Alle Bauten zusammen ≈ 250 000.
* **Abstiege:** 474 von 481 (98,5 %) sind Siedler → Pioniere wegen „Stoffe fehlt“.
* **Siedler-Zufriedenheit 0,83**, sobald Alkohol fehlt – Nachzug und Aufstieg brauchen > 0,85. Alkohol leer (< 5 t) bei
  20/24 Gegnern in Minute 30, 10/24 in Minute 60.
* **Weberei** höchstens 2 je Gegner; **Erzmine 0 von 24**; Schmiede steht fast immer „ohne Rohstoff“; Werften 2 von 24.
* **Siedler-Höchststände:** 9 von 18 Gegnern (6 Welten) erreichen irgendwann 200 Siedler; viele fallen danach wieder
  darunter (280→217, 203→119, 126→39, 112→35), andere bleiben knapp darunter (196, 198, 196, 181, 176).

## 2. Ursachen im Code

### Problem 2 (Wachstum) – zuerst, weil Problem 1 und 3 daraus folgen

**U1 Freischaltungen der Gegner sind nicht dauerhaft (Kern der Abwärtsspirale).**
* `src/game.ts:813` `reached()`: Spieler = Bestwert (`this.best`), KI nur `maxPop(tier, owner)` = heutige Einwohner.
* `src/game.ts:1425` `canPlace()` KI-Zweig: `this.maxPop(d.unlock.tier, owner) < d.unlock.n`.
* `src/ai.ts:1129` `allowed()`, `:502` `sollTruppen()`, `:1599` `shipyard()`, `:1617` `mustArm()`, `:1631` `military()`,
  `:1479` `assess()`: alle `g.maxPop(…)` (heute).
* Folge: Fallen Siedler unter 75/120/200, sind Getreide/Mühle/Bäckerei (S75), Werft/Erz (S120), Burg/Soldaten (S200)
  wieder gesperrt. Beleg Eroberin Seed 1: Siedler 112 → 35, Brot-Kette verboten, Nahrung nur aus erschöpften Gründen,
  64 Häuser bleiben Pioniere, Kasse wächst auf 11 332 Taler (nichts mehr erlaubt). Krieg: Eroberin Seed 3 hat Burg und Werft,
  aber 98 Siedler → `orderShip` scheitert 94-mal in 10 min an „ab 120 Siedlern“ (`game.ts:1682`), Soll-Truppen 0.
  In 11 von 36 Kriegs-Messpunkten steht eine Burg, aber die Soll-Truppen sind 0. Der Spieler behält Freischaltungen
  (`checkUnlocks`, `game.ts:816–818`) – die KI ist schlechter gestellt.

**U2 Alkohol-Sperre ohne Alkohol-Kette.** `src/ai.ts:1477–1480`: ab 75 Siedlern zählt Alkohol zum „Grundbedarf nach dem
nächsten Aufstieg“; ohne Erzeugung `have = 0 < soon` → `short` → `g.setMatLock(c.kontor, true)` (`:1505`). lock.log (3 Welten,
90 min): Auslöser „next-alkohol“ 3 484, „next-nahrung“ 2 116, „next-stoff“ 1 391, „core-stoff“ 921 Entscheidungen; ab
Minute 30 sperrt Alkohol allein 85–90 % der Entscheidungen eines Gegners. Im Vorbild brauchen Pioniere für den Aufstieg nur
Stoffe, Kapelle, Marktplatz.

**U3 Stoffe und Alkohol (Grundbedarf der Siedler) gelten als Luxus, und die Weide wird doppelt verplant.**
* `src/ai.ts:1030–1031`: als „nötig“ genau 1 Schaffarm und 1 Weberei. Alles Weitere über `planNeeds()` (`:1082`) im Modus
  „wachsen“, der praktisch nie erreicht wird: `ready()` `:1120` (Bilanz > 0 und Kasse − Preis ≥ halbe Reserve 1 250/900),
  `shopping()` `:1147` (Kasse ≥ volle Reserve 2 500/1 800 beim Materialkauf), vorher Ausstiege `:1054` (Sparen) und `:1075` (Rüsten).
* Händler-Aufträge für Mangelware (`:1682`) nur bei Kasse > Reserve + 2 000 – nie erreicht.
* Weberei braucht 24 Wolle/min, eine Schaffarm liefert höchstens 12 und erschöpft die Weide (Nachwuchs `REGEN.weide` 1/90 s).
  `placeFood()` (`:1091–1102`) setzt Schweinezuchten (bis 2 + Häuser/30) auf dieselbe Weide (`siteEfficiency` teilt den
  Rohstoff – die Schaffarm verliert). Beleg diagW-w1.log Eroberin: Minute 20 Betriebe 7 ok / 1 erschöpft, Minute 30 nach
  2 Schweinezuchten 9 erschöpft, Stoffe 49 t → 0 t, danach 60 min Stillstand (Zufriedenheit 0,64, Bau-Entscheidungen 100 % ohne Bau).
  frieden.log: 68 Schweinezuchten, 98 Schaffarmen.
* Kein Weideplatz mehr → `growChain('stoff')` scheitert still (`:1415` `continue`). diagB-w1.log Baumeister: 41 Siedlerhäuser,
  Stoffe 0 t, 36 Häuser nicht voll, 18 Auszüge/10 min, gleichzeitig „sparen“ 100 % bei 1 600–2 750 Talern (Ziel 3 000).
* Der Planer rechnet mit der Nenn-Leistung (`output()` `:840–860`, erschöpft nur ×0,35, sobald der Status schon „erschöpft“ ist):
  er lässt mehr Häuser aufsteigen, als die Weide auf Dauer trägt.

**U4 Steuern der KI fest.** `src/game.ts:1976` `taxRate()` ignoriert `p.tax` bei der KI (Siedler immer 34 %). Ohne Alkohol:
Versorgung 0,8 → tragbar 45 × (0,25 + 0,75 × 0,64) = 32,9 % < 34 % → Zufriedenheit ≈ 0,56 + 0,30 − 0,03 = 0,83
(`game.ts:2313–2318`) < 0,85. Ein Spieler würde hier die Steuer senken. Steuer je Haus ∝ Zufriedenheit^1,3 – unzufriedene
Häuser zahlen auch weniger.

**U5 Werkzeug zum Höchstpreis.**
* Der Händler verkauft kein Eisen: `src/trade.ts:91` `ALWAYS = ['werkzeug','erz','holz','nahrung']`, Eisen nur, wenn es schon
  jemand verkauft hat (`sells()` `:243`). Der Auftrag `src/ai.ts:1692` `want('eisen', 16)` läuft ins Leere.
* Schmiede/Erzkette nur im Modus „wachsen“ (`ai.ts:1061–1065`); Erzmine 1 000 Taler → nie gebaut.
* Verbrauch: jeder Bau 2–10 t, jeder Aufstieg 1–3 t. `restock()` `:896–907` und `shopping()` kaufen fehlendes Werkzeug sofort
  (126 Taler/t); der Händler-Auftrag `:1690` nur, solange `out.werkzeug < 0,5`.

**U6 Doppelte Werkstätten, zu viele Dienste.**
* `ai.ts:1414–1415` `growChain()`: fehlt das Vorprodukt, aber liegen ≥ 10 t im Lager, baut die KI die Werkstatt trotzdem –
  auch wenn eine gleiche schon „ohne Rohstoff“ steht. Beleg: Baumeister Seed 1 baut 9 Bäckereien in 10 min.
* `services()` `:1550–1555`: Dienste des nächsten Aufstiegs ab 4 unversorgten Häusern, auch wenn diese gar nicht aufsteigen
  können. Beleg: Eroberin Seed 2 mit 7 Schulen (490 Taler, 30 Unterhalt/min) für 18 Siedlerhäuser; 8–10 Kapellen; Schulen
  insgesamt 32 000 Taler.

**U7 Nahrung:** Fisch, Wild, Weide erschöpfen; die Brot-Kette fällt mit U1 weg (Sofort-Käufe Nahrung 160 000 Taler).

**U8 Messfehler „Ware liegt im Lager, Häusern fehlt sie“.** `game.ts:2301–2305` setzt `h.short[g]` nur für Waren der
aktuellen Stufe; nach einem Abstieg (`:2340`) bleibt `short.stoff = true` bei Pionieren stehen. „11 Häusern fehlen Stoffe bei
90 t“ (r4, Eroberin W0) sind solche alten Flaggen. frieden.log (zählt `need < 0,6` nur der aktuellen Stufe): kein Fall „Lager
fast voll und Häusern fehlt genau das“. Echte Fälle sind Stoffe/Alkohol = 0 t.

**U9 kleine Inseln:** `hausGrenze` 40 (`ai.ts:489–493`) → 200 Siedler = 29 von 40 Häusern als Siedler.

### Problem 1 (Krieg)

**K1 Keine Soldaten ohne heutige 200 Siedler – auch im Krieg:** `sollTruppen()` `ai.ts:502` → 0; `recruit()` `combat.ts:1270`
bricht ab; `military()`/`mustArm()` `ai.ts:1617/1631` ebenso. Keine Ausnahme für die Eroberin. Mit U1–U3 haben die meisten
Gegner 200 Siedler nie oder nur kurz.

**K2 Rüsten bremst die Versorgung → Hunger/Abstieg.** `ai.ts:1075` `if (ruesten && p.money < reserve(p) * 0.5 + 1000) return false;`
beendet die Entscheidung vor `planNeeds()` (Stoffe, Alkohol, Dienste) und vor der Werft. krieg.log Eroberin Seed 2 Minute 80:
„muss rüsten“ 100 %, Sofort-Kauf Schwerter 2 565 Taler, Stoffe 0 t → 14 Häusern fehlen Stoffe → Siedler 283 → 126 →
Soll-Truppen 0 → Rüsten bricht wieder ab.

**K3 Kriegsschiffe** brauchen eine Werft (siehe Problem 3) und `reached(S120)` beim Bestellen (`game.ts:1682`).
`warships()` `combat.ts:1311/1315` will im Krieg 3, Eroberin im Frieden 1 – scheitert an Werft/Freischaltung.

**K4 Angriffswellen kommen nicht zustande.**
* `raid()` `combat.ts:1350`: erst ab `max(4, soll × 0,5)` freien Soldaten (Eroberin im Krieg Soll ≈ 21 → 11) und dann nur
  15 % je 5 s.
* `combat.ts:1354`: Transport nur ein Schiff ohne Handelsroute; das einzige Schiff fährt meist die Kolonie-Route.
* Ohne Truppen kein Angriff: Kriegsschiffe jagen nur Schiffe im Umkreis 40 der eigenen Insel (`combat.ts:1255–1260`).
* **ki-sim kann Wellen nicht messen:** Der Spieler hat dort kein Kontor, `raid()` braucht ein Ziel (`combat.ts:1357–1359`).

**K5 Türme kaufen Kanonen sofort** (476 Taler/Stück): 29 500 Taler Kanonen-Sofortkäufe in frieden.log.

### Problem 3 (zweites Schiff)

`shipyard()` `ai.ts:1598–1612`: (a) `maxPop(1) ≥ 120` heute (U1); (b) Werft nur mit Kasse > 2 000 (Eroberin 1 600) und über
`place()` im Modus „wachsen“ → praktisch ≥ 2 350, mit Materialkauf ≥ 2 500 + Material; (c) erst nach den Ausstiegen `:1054`
(Sparen) und `:1075` (Rüsten). Folge: Schiffe Ø 1,0–1,1, Werften 2 von 24.

### Problem 4 (letztes Kontor weg, Marktplatz steht)

`thinkAI` `ai.ts:344` → `lostKontor()` `:414–441`: kein anderes Kontor, kein Schiff mit Kontor-Material → `lostAll()` `:443–447`
kehrt sofort zurück, weil ein Marktplatz steht – in jedem Denkschritt, ohne Ausweg. `tickAIMilitary` `combat.ts:1205–1206`
überspringt den Gegner (keine Verteidigung). Das Insellager lebt am Marktplatz weiter (`game.ts:1521`, LAGER = Kontor + Marktplatz).

---

## 3. Was die Proben zeigen (wichtig für die Reihenfolge)

| Lauf | Einw. 60/90/120 | Siedlerhäuser 120 | Bürger 90/120 | Soldaten 90 | Kriegsschiffe 120 | 2. Insel 120 | Schiffe 120 |
|---|---|---|---|---|---|---|---|
| heute, Frieden (r4, 36 Gegner) | 284/294/322 | 25,7 | 8/36, 17/36 | 9/36 | 0 | 36/36 | 1,1 |
| heute, Krieg (r4, 18 Gegner) | 294/291/294 | 25,4 | 4/18, 4/18 | 5/18 | 2 (0,3/Welt) | 18/18 | 1,2 |
| A (2 Welten, Frieden) | 292/291/312 | 20,8 | 1/6, 2/6 | 2/6 | 0 | – | – |
| B (5 Welten, Frieden) | 287/279/272 | 26,9 | 2/15, 2/15 | 5/15 | 6 | – | – |
| W (6 Welten, Krieg) | 284/285/268 | 26,1 | 0/18, 0/18 | **17/18** | **26 (4,3/Welt)** | **8/18** | **2,7** |
| heute, Frieden, nur Welten 0–3 (12 Gegner) | 302/296/306 | 21,4 | 3/12, 4/12 | 3/12 | 0 | – | – |
| 5 (4 Welten, Frieden, 12 Gegner) | 310/302/299 | 26,0 | 0/12, 1/12 | 9/12 | 6 | 10/12 | 1,7 |

Lehren:
1. **Militär-Maßnahmen wirken** (W): Soldaten nach 30 min Krieg 17/18 (Ziel ≥ 2/3), Kriegsschiffe 4,3 je Welt (Ziel ≥ 1),
   Schiffe Ø 2,7 (Ziel ≥ 1,8), Hunger ≤ 2 %. Wellen: In ki-sim gelang das Spieler-Kontor nur in 2/6 Welten (das Setzen scheitert
   an „Noch unentdeckt“ – erst `g.reveal`/`seen` der Heimatinsel setzen); in beiden Welten mit Ziel gab es eine Welle.
2. **Aber Militär und Werft vor der Kolonie kosten das Wachstum:** zweite Insel nur noch 8/18 statt 18/18, Bürger 0/18.
   Reihenfolge muss sein: Versorgung → Kolonie → Werft/Söldner im Frieden; im Krieg gilt Rüsten vor Kolonie.
3. **Sperren lösen allein hilft nicht** (B, 5): mehr Siedlerhäuser (26–30 statt 21–25), aber gleich viele Einwohner und
   weniger Bürger – die Häuser bleiben halb leer, weil Stoffe/Alkohol fehlen (U3: Weide, keine Kolonie, kein Geld für
   den Händler). Der Engpass ist die **dauerhafte Stoff- und Alkohol-Versorgung** und das Geld dafür.
4. Wo die Kolonie früh klappt, wächst es: Baumeister Seed 1 in Probe 5 mit 3 Kontoren: 503 Einwohner, 65 Siedlerhäuser.

## 4. Umbauplan (nach Priorität)

Nur `src/ai.ts`, `src/combat.ts`, KI-Zweige in `src/game.ts`, `scripts/ki-sim.ts`, `scripts/ki-test.ts`. Neue Felder nur
optional in `Brain`/`Player` (fehlt → Standardwert), `SAVE_VERSION` bleibt 6.

### P1 – Abwärtsspirale stoppen (zuerst, Grundlage für alles)

**P1.1 Freischaltungen der KI dauerhaft (fair, wie beim Spieler).**
* `game.ts` Player: `best?: number[]`. `checkUnlocks()` (`:816`): für jeden Gegner (`p.ai && !p.pirate && !p.trader && !p.natives
  && !p.defeated` – nicht an `p.brain` koppeln, ki-sim nimmt `brain` während `g.tick` weg) `p.best[t] = max(p.best[t], maxPop(t, p.id))`.
* `reached()` (`:813`) KI-Zweig: `Math.max(p.best?.[tier] ?? 0, maxPop(tier, owner)) >= n`; `canPlace()` (`:1425`) KI-Zweig:
  `!this.reached(d.unlock, owner)`.
* `ai.ts:502, :1129, :1479, :1599, :1617, :1631`: `g.maxPop(…) < X` → `!g.reached({ tier, n: X }, p.id)`.
* Wirkung: Burg/Werft/Brot-Kette bleiben nach einem Einbruch nutzbar; die 11/36 Kriegs-Messpunkte „Burg ohne Soll“ rekrutieren.

**P1.2 Alkohol-Sperre streichen.** Die Zeile `ai.ts:1479` (`if (t === 0 && g.maxPop(1, p.id) >= 75) next.set('alkohol', …)`)
entfernen. Pioniere → Siedler sperren nur Nahrung und Stoffe (wie im Vorbild). Probe B („nur sperren, wenn eine Alkohol-Kette
läuft“) hielt die Sperre bei schwacher Brauerei weiter dauerhaft (diagB-w1.log Händler: 95–100 % ab Minute 50).

**P1.3 Steuern wie ein Spieler.** `game.ts:1976`: `const v = p ? p.tax?.[tier] : undefined;`. In `ai.ts build()` alle 30 s
(`b.wait.steuer`): je Stufe Median `g.supplyShare(h)` → `tax[t] = clamp(floor(maxTax × (0,25 + 0,75 s²)) − 3, 15, taxStd)`.
Voll versorgt = Standardsatz; Siedler ohne Alkohol 29 % → Zufriedenheit ≈ 0,89 (Häuser füllen sich, steigen auf).

**P1.4 Stoff-Versorgung zuerst sichern (der eigentliche Engpass).**
* In `decide()` direkt nach den Holzfällern (`ai.ts:1033`), Modus „nötig“:
  ```ts
  const mg = (p.brain as Brain).mangel ?? {};
  if (c.top >= 1) for (const gd of ['stoff', 'alkohol'] as GoodId[])
    if ((mg[gd] ?? 0) > 0.3 && canMake(g, p, gd, c.island, true)) {
      if (growChain(g, p, c, gd)) return true;
      (b.platz ??= {})[gd] = g.time;          // kein Platz → Kolonie-Wunsch (P2.3)
    }
  ```
  und `:1030` statt „keine Schaffarm“: „Wolle-Leistung < 2 Schaffarmen je Weberei“.
* Weide schützen: `placeFood()` (`:1094–1097`) keine Schweinezucht, deren Weide-Umkreis eine eigene Schaffarm berührt, solange
  `mangel.stoff > 0` oder Stoffe unter 20 t; dann zuerst Fischer/Jagd/Brot.
* Mit **nachhaltiger** Leistung planen: in `survey()` je Betrieb die tatsächlich in den letzten ~5 min gelieferte Menge
  (gleitender Mittelwert, z. B. aus `b.stock`-Zuwachs, oder `eff × fertility` statt Nennwert) für Rohstoffe der Weide/Felder;
  `assess()` sperrt Aufstiege, wenn Stoffe dauerhaft < Verbrauch × 1,2 (heute: Nennleistung, Sperre kommt zu spät – Häuser
  sind schon aufgestiegen, dann bricht die Weide ein).

**P1.5 Rüsten blockiert die Versorgung nicht.** `ai.ts:1075` nur noch, solange **keine Burg** steht (Sparen auf 600 Taler),
und erst nach P1.4/P2.1 (die stehen davor im nötigen Teil).

### P2 – Geld und Versorgung

**P2.1 Werkzeug billiger** (heute 53 % des Netto).
* Schmiede als „nötig“, sobald erlaubt (S100 je erreicht), `out.werkzeug < 1`, Lager < 20.
* Eisen per Sofort-Kauf am Kontor (wie der Spieler; der Händler führt Eisen nicht): `restock()` alle 30 s, wenn Schmiede steht,
  `out.eisen < 1`, `lager.eisen < 4`, Kasse > 600 → `sofort(eisen, ≤ 8)`. 1 Eisen (123 Taler) → 2 Werkzeug = 62 Taler/t statt 126.
* Erz-Inseln: ab S120 (je erreicht) und Kasse ≥ 1 600 Erzmine + Erzschmelze über `growChain('eisen')` im Modus „nötig“
  (Werkzeug dann ≈ 17 Taler/t inkl. Unterhalt).
* Händler-Auftrag Werkzeug (`ai.ts:1690`) immer, Ziel 25 t + Häuser/4, Budget `spareBau`.
* Nutzer-Entscheidung (nicht zwingend): `'eisen'` in `trade.ts:91 ALWAYS` – betrifft auch den Spieler.
* Erwartung: Werkzeug-Anteil von 53 % auf ≈ 25–30 % des Netto (≈ 200 000 Taler mehr in 24 Städten/120 min).

**P2.2 Händler überbrückt den Grundbedarf.** `tradeOrders()` `ai.ts:1682–1690`: Stoffe, Alkohol (bei `c.top ≥ 1`) und Nahrung
(wenn `foodNow < Verbrauch`) als Auftrag mit Budget `spareBau` (in der `afford`-Zeile `:1712` wie Baustoffe behandeln), nicht
erst bei Kasse > Reserve + 2 000. Kaufplätze (4 auf Kontorstufe 0) nach Wichtigkeit: Stoffe, Nahrung, Werkzeug, Eisen, Alkohol,
Waffen (Waffen heute zuerst). Stoffe für ein Siedlerhaus kosten ≈ 11 Taler/min, das Haus bringt als Siedler 17,5 statt 6,9 Steuer.
Probe W zeigte: ohne mehr Geld bleibt das Budget winzig (1–16 t je 10 min statt ≈ 100 t) – P2.2 wirkt nur zusammen mit P2.1.

**P2.3 Kolonie für Stoffe/Alkohol früh und geschützt.** `maybeExpand()` `ai.ts:1743–1764`:
* Schwelle 3 000 → 2 000, wenn Stoffe/Alkohol fehlen und auf der Heimat kein Platz ist (`b.platz` < 10 min) oder sie dort nicht wachsen.
* Während `sparen`: keine Sofort-Käufe für Aufstiege (`restock()`), keine Werft, keine Söldner im Frieden, keine Türme.
  (Probe W: Werft „nötig“ in Minute 50 hat das Sparen zunichtegemacht → zweite Insel 8/18 statt 18/18.)
* `sparen` nie, solange Häuser hungern – dann zuerst Händler (P2.2).

**P2.4 Keine Doppel-Werkstätten.** `place()` `ai.ts:1153`: Werkstatt (`d.prod && !d.harvest`) nicht bauen, wenn eine gleiche
„ohne Rohstoff“ oder „Lager voll“ steht; `growChain` `:1415` Ausnahme nur ohne solche Werkstatt.

**P2.5 Dienste sparsamer.** `services()` `:1550–1555`: für Dienste des nächsten Aufstiegs nur Häuser zählen, die voll und
zufrieden sind; Schwelle 4 → 6 Häuser.

**P2.6 Nahrung:** mit P1.1 bleibt Brot erlaubt; `placeFood()` `:1105` Brot-Kette schon bei `best.v < 5` (statt 3,5).

### P3 – Militär und Krieg (Z1, Z2, Z4) – in Probe W erprobt

**P3.1 Werft und zweites Schiff als „nötig“** – aber erst **nach** der zweiten Insel (oder im Krieg/nach Vorwarnung):
in `decide()` vor dem Rüsten `if (g.reached(S120) && !werft && p.money > 1 600 && c.hungry < 2 && (kolonie || danger))`;
`shipyard()` `:1602`: Schwelle 2 000/1 600 → 1 500/1 300, zweites Handelsschiff ab Kasse 900 (statt 1 400). Probe W: Schiffe Ø 2,7.

**P3.2 Söldner – Soldaten ohne Burg (nur KI; als Abwandlung in docs/ABGLEICH-1602.md dokumentieren).** Z1 verlangt Soldaten
bei der Eroberin auch ohne 200 Siedler; nach den Regeln (Burg ab 200 Siedlern, wie beim Spieler) ginge das nicht. Vorbild in
den eigenen Unterlagen: docs/1602-INHALT.md Zeile 301 „KI wirbt Soldaten an (höchstens einen pro Minute)“.
* `sollTruppen()` `ai.ts:501`: ohne 200 Siedler (je erreicht) im Krieg/nach Vorwarnung `round(6 × truppen × kiTruppen)`,
  Eroberin ab Minute 60 im Frieden `round(4 × …)` – aber nur, wenn nicht gespart wird (P2.3); sonst 0. (ki-test „vor 200 Siedlern
  keine Soll-Truppen“ prüft Minute 0 → bleibt grün.)
* `recruit()` `combat.ts:1268`: ohne Burg/Freischaltung **Söldner am Kontor**: höchstens 1/min (`b.soeldT`), Preis 3 Schwerter
  zum Sofort-Preis + 100 ≈ 610 Taler, nur bei Kasse ≥ 400 + Preis, Bilanz − Sold ≥ 0, Hunger < 10 %. In tree4 erprobt
  (`combat.ts` Probe W2).
* leicht: Söldner nur im Krieg; schwer: × kiTruppen 1,4.

**P3.3 Rüsten ohne Hunger.** `recruit()`/`warships()` nichts kaufen bei ≥ 10 % hungernden Häusern oder `b.knapp`;
Kanonen für Türme nur sofort, wenn Kasse > 2 000; im Krieg zuerst Soldaten, dann Türme. (Probe W: Hunger 0–2 %.)

**P3.4 Angriffswellen.**
* `raid()` `combat.ts:1350`: Start ab `max(3, round(soll × 0,35))` freien Soldaten, Chance 0,3 je 5 s.
* `:1354`: kein freies Schiff → im Krieg das Schiff der Handelsroute nehmen (`setRoute(g, s, null)`, `s.path = []`;
  `ensureRoute` legt die Route später neu an).
* **Seeangriff** (neu, in `tickAIMilitary` nach `raid`): bewaffnete Kriegsschiffe (≥ 4 Kanonen, ohne Ziel/Weg/Truppen) greifen
  alle 4 min das nächste Kontor/den nächsten Marktplatz des Spielers an (`acquire` Umkreis 12 + `shipAttack`, sonst `moveShip`).
  Nur bei `atWar` – also immer nach der Vorwarnung (Z2).
* Zähler `b.wellen` (optional) bei Landung (`r.phase = 'land'`) und Seeangriff.

**P3.5 Eroberin im Frieden:** Kriegsschiff `want = 1` (`combat.ts:1311`) bleibt; mit P1.1/P3.1 klappt es nach der Kolonie.

### P4 – Kontor verloren (Problem 4) und Kleinigkeiten

**P4.1 Neu gründen oder aufgeben.** `lostKontor()` `ai.ts:414`, neuer Zweig vor `lostAll()`:
* Marktplatz steht + eigenes Schiff ohne Truppen: Platz auf derselben Insel (`planKontor` geht auf eigenem Land), Schiff hin
  (kleine Phase im Brain, z. B. `neu?: { site, route, t }`), dort Holz 6 + Werkzeug 3 aus dem Insellager aufs Schiff (`shipAdd`;
  fehlt etwas: vorher `sofort` ins Insellager – geht, weil das Lager am Marktplatz weiterlebt), `g.place('kontor', …)`.
* Kein Schiff, aber Werft: kleines Handelsschiff bestellen, dann wie oben.
* Sonst bzw. nach 10 min ohne Erfolg (`b.ohneKontorT`): aufgeben – Gebäude verfallen wie beim Fall des letzten Marktplatzes,
  Schiffe → Piraten, ausgeschieden. ki-test Zeilen 159–168 (60 s nach Kontor-Verlust noch im Spiel) bleiben grün.
* `tickAIMilitary` `combat.ts:1205`: ohne Kontor einen Marktplatz als Heimatpunkt nehmen.

**P4.2 Alte Mangel-Flaggen löschen** beim Abstieg (`game.ts:2340`): `h.short`-Einträge für Waren, die die neue Stufe nicht
verbraucht, entfernen (nur Anzeige/Diagnose, keine Wirkung auf Zufriedenheit).

## 5. ki-sim und ki-test

**ki-sim.ts**
* `--krieg`: in Minute 60 vor der Kriegserklärung Kontor + einige Häuser des Spielers auf seiner Heimatinsel setzen – vorher die
  Heimatinsel aufdecken (`seen`), sonst „Noch unentdeckt“ (Probe: nur 2/6 Welten). Code-Vorlage: tree4/scripts/ki-sim.ts.
* Neue Ausgaben/Ziele: Soldaten (ohne Schiffe) nach 90; Eroberin mit Soldaten 60/90/120; Wellen je Welt (`b.wellen`, davon
  Seeangriffe); Kriegsschiffe je Welt; Schiffe Ø; Anteil Entscheidungen mit Material-Sperre; „festgefahren“:
  (a) Siedlerhäuser 30 min > 30 % unter dem Höchststand, (b) Kasse > 8 000 und 20 min nichts gebaut, (c) Ware ≥ Lager − 5 t und
  ≥ 5 Häusern der **aktuellen** Stufe fehlt sie (`need < 0,6`, nicht `short`).
* Z1–Z5 als ✓/✗ (Z5: `--passiv` 135–165 Einwohner; `--stufe leicht|schwer` Einwohner und Soldaten leicht < normal < schwer).

**ki-test.ts** neu: (1) Freischaltung bleibt nach Abstieg (`reached`, `canPlace('burg')`); (2) keine Alkohol-Sperre bei 80 Siedlern
ohne Alkohol; (3) KI-Steuer < 34 % ohne Alkohol, = 34 % voll versorgt; (4) Söldner: Eroberin im Krieg ohne Burg ≥ 1 Soldat nach
2 min, Händler im Frieden 0, leicht im Frieden 0; (5) Überfall nimmt das Routenschiff; Seeangriff erhöht `wellen`; (6) Werft nach
der Kolonie bei 130 Siedlern (je erreicht) und 1 700 Talern; (7) Kontor weg + Marktplatz + Schiff → neues Kontor ≤ 5 min, ohne
Schiff → nach 10 min ausgeschieden; (8) keine zweite Bäckerei neben einer „ohne Rohstoff“; (9) keine Schweinezucht auf der Weide
einer Schaffarm bei Stoffmangel.

## 6. Erwartete Wirkung und ehrliche Grenzen

* **Z1 (Krieg):** mit P1.1 + P3 erreichbar – Probe W: 17/18 mit Soldaten nach 30 min Krieg, Kriegsschiffe 4,3/Welt, Hunger ≤ 2 %;
  Wellen in allen Welten mit Ziel (2/2). Nach Korrektur des ki-sim-Ziels (Aufdecken) erwartet ≥ 2/3 der Welten.
* **Z2:** Eroberin mit Söldnern (Probe 5: nach 120 min in 4/4 Welten 9–18 Soldaten, nach 60 min erst 2/4 – Söldner ab Minute 60
  mit 1/min kommen knapp zu spät; Beginn auf Minute 50 oder Startzahl 2 setzen), Kriegsschiff nach Werft;
  Vorwarnung unverändert (Wellen nur bei `atWar`).
* **Z4:** Schiffe Ø 2,7 in Probe W (Ziel 1,8) – mit der Reihenfolge „erst Kolonie“ eher ≈ 2.
* **Z3 (Wachstum) ist das schwerste Ziel.** Die Proben A/B/5 (Sperren lösen, Steuern, Schmiede) heben die Siedlerhäuser
  (+5 bis +8), aber nicht die Einwohner (Probe 5: 310/302/299 gegen 302/296/306 in denselben Welten; Bürger 1/12 gegen 4/12), weil Stoffe und Alkohol dauerhaft fehlen. Erst P1.4 (Weide
  schützen, nachhaltig planen), P2.1 (Werkzeug-Kosten halbieren) und P2.3 (frühe, geschützte Kolonie) greifen am Engpass an;
  Beleg für die Richtung: Baumeister mit 3 Kontoren in Probe 5 → 503 Einwohner, 65 Siedlerhäuser. Erwartung: Ø ≥ 300 nach 60 min
  und Bürger bei ≥ 2/3 nach 90 min sind realistisch, wenn die Kolonie bis Minute ≈ 35 steht. **Kaufleute ≥ 1/4 nach 120 min**
  brauchen zusätzlich Bürger bis ≈ Minute 70, Tabak/Gewürze und Kakao (tropische Kolonie) sowie Kirche und Badehaus – heute
  0/36; das ist nur mit P1–P2 vollständig plus guten Inseln wahrscheinlich. Falls nach dem Umbau verfehlt: mit diesen Zahlen
  begründen und in Etappe 2 (Handel/Stufen) nachziehen.
* **Z5:** Tempo-Grenze bleibt (`housesWanted`, `assess` `!grow`); KI-Steuern ändern daran nichts. Söldner/Steuern unterscheiden
  sich nach `kiGrenzen().truppen` und der Söldner-Regel für leicht.

## 7. Fairness und Rechenzeit

* Fair: P1.1 gleicht die KI an den Spieler an; P1.3 nutzt den Steuerregler des Spielers; P2.1/P2.2 nutzen Sofort- und
  Händlerhandel wie der Spieler. Einzige Abweichung: P3.2 Söldner (nur KI, begrenzt, teuer, dokumentieren). Tempo-Grenze
  (Spieler × 1,3 + 150), gesperrte Heimatinsel, fairer Start und Vorwarnung bleiben unverändert.
* Rechenzeit: P1.3 (Median je Stufe alle 30 s, ≤ 110 Häuser), P1.1 (5 Stufen × Gegner je Sekunde, `maxPop` zwischengespeichert),
  Söldner 1×/min, Seeangriff alle 4 min (`acquire` Umkreis 12) – klein. Keine neue Platzsuche außer Werkstätten/Werft/Kontor-
  Neugründung (selten). Probe W unter Fremdlast: Bau-Entscheidung Ø 0,393 ms (heute 0,342 ms, gleiche Last-Unsicherheit).
  Spitzen > 20 ms gibt es schon heute (47,8 ms „heimat“ Welt 4 Minute 4 – Platzsuche nach der Gründung); falls die Abnahme 20 ms
  hart verlangt: `coreRoads`/erste `sitesFor` nach der Gründung auf zwei Denkschritte verteilen.
