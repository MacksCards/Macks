# Arbeitsstand KI2 (Computergegner) – gesichert am 06.11.2026

Der Nutzer hat die Arbeit am 06.11.2026 angehalten. Dieser Ordner hält den Zwischenstand fest, damit nichts verloren geht.

## Was hier liegt
- `ki2-zwischenstand.patch`: zwei Commits (KI2b und KI2c) auf Basis von `c8f1ed8`. Sie betreffen vor allem `src/ai.ts`, `src/combat.ts`, `src/schwierigkeit.ts`, `src/game.ts`, `scripts/ki-sim.ts`, `scripts/ki-test.ts` und `docs/OFFEN.md`. Sie sind **noch nicht** im Spiel.
  - Einspielen: `git am -3 docs/arbeitsstand/ki2-zwischenstand.patch` (vorher prüfen: `git apply --check --3way …` lief am 06.11. auf dem Stand `ceb847f` sauber durch).
- `ki2-diagnose-plan.md`: Diagnose der Ursachen und Umbauplan.

## Stand
- Umgesetzt, einmal unabhängig geprüft und einmal nachgebessert. Die zweite unabhängige Prüfung lief noch, als angehalten wurde. **Vor dem Einspielen erneut unabhängig prüfen.**
- Messung des Bauers nach der Nachbesserung (ki-sim, Schwierigkeit normal, 12 Welten × 3 Gegner):
  - **Krieg (`--krieg`):** nach 30 min Krieg haben 36/36 Gegner Soldaten; Angriffswellen in 12/12 Welten (1–9 je Welt); Kriegsschiffe bewaffnet (Ø 1,4 je Welt); höchstens 9 % hungernde Häuser; niemand pleite.
  - **Frieden:** Eroberin ab Minute 60 mit Soldaten (12/12); 6 von 7 Eroberinnen mit Werft haben ein Kriegsschiff; kein Angriff ohne Vorwarnung.
  - **Wachstum:** Ø 339/359/346 Einwohner nach 60/90/120 min (Ziel ≥ 300 ✓). Bürger nach 90 min bei 44 % (Ziel 2/3 ✗), nach 120 min 56 %. **Kaufleute: 0** (Ziel ≥ 1/4 ✗).
  - Zwei Schiffe im Mittel ✓; `--passiv` ≈ 155 Einwohner ✓; leicht < normal < schwer ✓ (leicht nur knapp unter normal).
  - Rechenzeit: Spitzen 16,6 ms auf ruhigem Rechner, unter Last 24–27 ms (Ursache: Neuberechnung im Spiel nach jedem Bau, nicht die KI).
- Noch offen laut Bauer: Bürger/Kaufleute (Stoffe fehlen, Weiden zu klein; Nahrung auf Inseln ohne Fischgründe), 2 von 36 Gegnern nach 120 min leicht im Minus.

## Erste unabhängige Prüfung (vor der Nachbesserung)
{
 "ok": false,
 "maengel": [
  {
   "schwere": "wichtig",
   "ziel": "Z1",
   "datei": "src/combat.ts",
   "text": "Die Kriegsschiffe der Gegner haben fast nie Kanonen an Bord, deshalb gibt es keinen einzigen Angriff nur mit Kriegsschiffen. In ki-sim --krieg (8 Welten) waren es 0 Seeangriffe, im Frieden (--liste) ebenfalls 0. Ein eigener Messlauf (4 Welten, Krieg) zeigt die Kanonen je Kriegsschiff: [0,0], [3,0,0], [8,0,0], [0], [0,0], und im Lager liegen immer 0 Kanonen. Ursache in warships(): Kanonen kauft die KI nur mit dem Geld über MIL_RESERVE (800) zu je ca. 476 Taler, also erst ab rund 1 300 Talern. Die Gegner haben aber meist 200 bis 900 Taler. Außerdem bricht hungert() das Bewaffnen ab. seaAttack() verlangt mindestens 4 Kanonen und springt daher nie an. Der Kennwert ‚3,1 Kriegsschiffe je Welt‘ zählt also unbewaffnete Hüllen. Die Angabe in docs/OFFEN.md (‚auch Angriffe nur mit Kriegsschiffen‘) ließ sich nicht nachvollziehen."
  },
  {
   "schwere": "wichtig",
   "ziel": "Z1",
   "datei": "src/combat.ts",
   "text": "Gerade die Eroberin ist im Krieg kaum eine Bedrohung. In 3 von 4 Messwelten hat sie nach 60 Minuten Krieg genau 1 Soldaten und in keiner Welt eine Angriffswelle (wellen 0). Angreifer war fast immer der Baumeister. Ursache in mercenary(): Ab dem zweiten Söldner muss die Kasse 400 + 612 Taler halten. Die Eroberin hat aber meist 200 bis 800 Taler. Formal ist Z1 erfüllt: 92 % der Gegner haben Soldaten, und jede Welt hat eine Welle, aber in 7 von 8 Welten genau eine in 60 Minuten Krieg. Diese eine Welle zerstörte die unverteidigte Spieler-Stadt der Simulation. Danach gab es kein Ziel mehr."
  },
  {
   "schwere": "wichtig",
   "ziel": "Z3",
   "datei": "src/ai.ts",
   "text": "Das Wachstum ist weiter verfehlt und teils schlechter als vorher. Gemessen mit ki-sim --liste, normal, 8 Welten: Einwohner Ø 335/331/338 nach 60/90/120 min. Die Städte stehen von Minute 60 bis 120 still, obwohl die Grenze von 670 auf 1 450 steigt. Bürger nach 90 min bei 5 von 24 Gegnern (21 %, Ziel 2/3), nach 120 min bei 8 von 24 (33 %, vorher 17 von 36 = 47 %). Kaufleute 0 von 24 (Ziel ≥ 1/4). Das Baumaterial am Kontor ist in 67 % aller Bau-Entscheidungen gesperrt (im Krieg 69 %). Die Aufstiege bleiben also meist blockiert. Nur ‚Ø ≥ 300 nach 60 min‘ ist erfüllt (335)."
  },
  {
   "schwere": "wichtig",
   "ziel": "Z1/Z3",
   "datei": "src/ai.ts",
   "text": "Zu viele Häuser hungern. Im Krieg (--krieg) sind es höchstens 15 % nach 90 min und 12 % nach 120 min (Ziel ≤ 10 %, vorher 2 %). Einzelne Städte trifft es stark: Baumeister W0 mit 42 von 87 Häusern nach 60 min, Händler W3 mit 35 von 76 nach 120 min. Im Frieden höchstens 9 % (knapp im Ziel)."
  },
  {
   "schwere": "klein",
   "ziel": "Z3",
   "text": "Einige Gegner gehen pleite. Bei normal sind nach 120 min 2 von 24 im Minus (kleinster Stand −1 365, vorher 0). Bei schwer sind es 3 von 18, der tiefste Stand −3 031."
  },
  {
   "schwere": "klein",
   "ziel": "Z2",
   "text": "Die Eroberin hält im Frieden nicht immer Truppen. Nach 60 min haben 7 von 8 Eroberinnen Soldaten, meist nur einen. Kriegsschiff: Nach 120 min haben nur 3 der 4 Eroberinnen mit Werft eines, und diese sind unbewaffnet (siehe oben). Die Vorwarnung kommt weiter vor jedem Angriff (0 Angriffe ohne Vorwarnung) ✓."
  },
  {
   "schwere": "klein",
   "ziel": "Z6",
   "datei": "src/game.ts",
   "text": "Die Rechenzeit-Spitze liegt über der Grenze. KI je Spielschritt höchstens 21,1 ms (liste), 23,7 (krieg), 24,6 (leicht) und 26,7 (schwer), Grenze 20 ms. Gemessen unter Parallellast. Der Mittelwert 0,13 ms ist ✓. Der Bauer hat das selbst als offen benannt (Neuberechnung nach dem Bauen)."
  },
  {
   "schwere": "klein",
   "ziel": "Z5",
   "text": "Die Stufen unterscheiden sich in der Rüstung gut (Soldaten Ø 3,3 / 6,5 / 8,8 für leicht/normal/schwer), in den Einwohnern kaum (310 / 338 / 343). Bei schwer erreicht niemand Kaufleute (laut Vorgabe ‚bis Aristokraten‘), und Bürger gibt es nur bei 6 von 18. --passiv: Ø 163 Einwohner ✓, einzelne Gegner aber bis 231."
  }
 ],
 "messung": "Eigener Worktree (detached e70f1f6, node_modules per Symlink), inzwischen wieder entfernt. Am Branch wurde nichts geändert.\n\nPrüfungen:\n- tsc ✓, vite build ✓\n- Alle 14 scripts/*-test.ts ✓, darin ki-test mit den neuen KI2b-Prüfungen\n- smoke.mjs ✓ („FEHLER: keine“, 171/171 Gebäude nach dem Neuladen)\n- SAVE_VERSION bleibt 6, neue Felder sind optional, der Test für alte Spielstände ist grün\n- src/ui*, src/render* und trade.ts sind nicht angefasst\n\nErgebnisse ki-sim (Schwierigkeit normal, 8 Welten, 120 min):\n\n--liste:\n- Einwohner nach 60/90/120 min: 335/331/338\n- Bürger: 5/24 nach 90 min, 8/24 nach 120 min; Kaufleute 0\n- Baumaterial gesperrt in 67 % der Entscheidungen\n- Schiffe Ø 1,96 (Z4 ✓), Soldaten 21/24\n- Eroberin: Soldaten nach 60 min 7/8; mit Werft und Kriegsschiff 3 von 4\n- Wellen in 7/8 Welten, 0 Seeangriffe, 0 Angriffe ohne Vorwarnung\n- Hunger höchstens 9 %, im Minus 2/24, keine festgefahrene Stadt\n- KI je Spielschritt Ø 0,131 ms, Spitze 21,1 ms\n\n--krieg:\n- nach 30 min Krieg 22/24 mit Soldaten, jede Eroberin mit Soldaten\n- Wellen in 8/8 Welten (1,1,1,1,1,5,1,1), 0 Seeangriffe\n- Kriegsschiffe 3,1 je Welt\n- Hunger 15 % (✗)\n- Spitze 23,7 ms\n\nEigener Messlauf (4 Welten, Krieg):\n- Kriegsschiffe fast ohne Kanonen, Kanonen im Lager immer 0\n- Die Eroberin bleibt meist bei 1 Soldaten und greift nie an\n- Die Spieler-Attrappe der Simulation ist nach einer Welle zerstört\n\nWeitere Läufe:\n- --passiv: Ø 163 Einwohner ✓, Spitze 18,1 ms\n- leicht (6 Welten): 310 Einwohner, Soldaten Ø 3,3\n- schwer (6 Welten): 343 Einwohner, Soldaten Ø 8,8, 3/18 im Minus\n\nKein Gemogel gefunden:\n- Die Söldner sind als Abwandlung dokumentiert und laufen im echten Spiel über tickAIMilitary.\n- Die Spieler-Stadt in ki-sim ab Minute 40 ist nur ein Angriffsziel.\n- Fairness bleibt: die Einwohner-Grenze (popGrenze) ist unverändert, die Vorwarnung kommt vor jedem Angriff.\n\nFazit: Rüsten im Krieg ist deutlich besser

## Nächste Schritte
1. Patch einspielen (eigener Zweig oder Arbeitsbaum), alle Tests und ki-sim laufen lassen.
2. Unabhängige Prüfung (Ziele Z1–Z6, siehe `ki2-diagnose-plan.md`).
3. Offene Punkte (Bürger, Kaufleute) nachbessern, dann ins Spiel übernehmen und veröffentlichen.
