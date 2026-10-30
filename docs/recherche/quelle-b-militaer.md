# Quelle B: Militär in Anno 1602 (Fakten-Extraktion)

Stand: 2026-10-30. Basis: Tim Howgego (englische Fan-Anleitung, Basisspiel ohne NINA) und die deutschen Texte aus dem Quellenordner. Alles in eigenen Worten, Zahlen und Namen exakt.

## 0. Legende

**Quellen-Kürzel**

| Kürzel | Datei (im Quellenordner `scratchpad/src/`) | Status |
|---|---|---|
| [TM] | tim_appendices_military_data.txt (Tabellen Einheiten, Schiffe) | Hauptquelle |
| [TK] | tim_gameplay_combat.txt | Hauptquelle |
| [TT] | tim_strategies_military_tactics.txt | Hauptquelle |
| [TE] | tim_strategies_military_units.txt | Hauptquelle |
| [TS] | tim_appendices_final_score.txt | Hauptquelle |
| [TMP] | tim_gameplay_multiplayer.txt | Hauptquelle |
| [TSz] | tim_scenarios.txt | Hauptquelle |
| [TTu] | tim_scenarios_tutorials.txt | Hauptquelle |
| [Z-Geb] | tim_appendices_building_industry_data.txt (Gebäudetabelle) | Zusatz, außerhalb der 8 Dateien |
| [Z-Ket] | tim_appendices_production_links.txt (Produktionsfluss) | Zusatz |
| [Z-Schiff] | tim_gameplay_ships.txt | Zusatz |
| [Z-Pir] | tim_gameplay_pirates_natives.txt, tim_strategies_pirates_natives_strategies.txt | Zusatz |
| [Z-Hand] | tim_gameplay_trade_diplomacy.txt | Zusatz |
| [Z-Kol] | tim_gameplay_colony_buildings.txt | Zusatz |
| [D-Giga] | giga.txt (deutsche Gebäudeliste mit Kosten) | Deutsche Namen |
| [D-AK] | ai_ketten.txt (annoinfo, Produktionsketten) | Deutsche Namen und Ketten |
| [D-Wiki] | wiki.txt (deutsche Wikipedia) | Deutsche Namen |
| [D-AI] | ai_infos.txt (annoinfo, Spielinfos) | Deutsche Hintergründe |
| [Alt] | /home/user/Macks/docs/recherche/03-militaer-schiffe-welt.md (bestehende Datei, nur Vergleich) | Nicht als Quelle verwendet |

**Kennzeichnungen**
- **(Ü)** = eigene Übersetzung, kein Quellenbeleg.
- **(abgeleitet)** = aus Tabellenwerten selbst gerechnet, steht so nicht in den Quellen.
- **Geld**: Die Quellen nennen keine einheitliche Währung. Tim schreibt "Cost" und "$", annoinfo "Credits". Hier steht "Geld".
- **Unterhalt** (Tim: "Upkeep"): Einheit in den Quellen nicht angegeben.
- **Betrieb**: "aktiv/passiv" laut Tim-Tabelle. Ein einzelner Wert gilt für beide Zustände.

---

## 1. Militäreinheiten (Land)

### 1.1 Freischaltung, Ausrüstung, Ausbildung [TM], [TE]

| Einheit (EN) | Deutsch | Freischaltung (Bevölkerung) | Geldkosten | Ausrüstung je Einheit | Unterhalt | Ausbildungszeit in Sekunden (Burg / Große Burg / Festung) |
|---|---|---|---|---|---|---|
| Infantry | Infanterist (Ü) | 200 Siedler | keine eigenen Kosten angegeben | 3 Schwerter | 5 | 200 / 140 / 100 |
| Cavalry | Kavallerist (Ü) | 200 Siedler | keine eigenen Kosten angegeben | 3 Schwerter | 8 | 200 / 140 / 100 |
| Cannoneer | Kanonier (Ü) | 400 Bürger | keine eigenen Kosten angegeben | 2 Kanonen | 14 | 200 / 140 / 100 |
| Musketeer | Musketier (Ü) | 400 Kaufleute | keine eigenen Kosten angegeben | 4 Musketen | 10 | 200 / 140 / 100 |

- Ausbildung braucht Waffen im Lager und einen freien Weg ohne Bäume zum nächsten Markt oder Kontor [TE].
- Ausbildungsgebäude sind Burg, Große Burg und Festung [Z-Geb]. Eine "Kaserne" kommt in den Quellen nicht vor.
- Der Gebäudeteil nennt zusätzlich "3 / 5 / 8 soldiers trained" für Burg, Große Burg und Festung [Z-Geb]. Die Bedeutung wird nicht erklärt. Vermutlich ist es die Ausbildungskapazität.
- **Abgeleitet**: Ein Infanterist braucht 3 Schwerter, also 3 Eisen. Ein Kanonier braucht 2 Kanonen, also 2 Holz und 2 Eisen. Ein Musketier braucht 4 Musketen, also 4 Holz und 8 Eisen.

### 1.2 Kampfwerte [TM]

| Einheit | Lebenspunkte | Stärke | Angriffsintervall (s) | Reichweite | Abgeleitet: Stärke / Intervall |
|---|---|---|---|---|---|
| Kanonier | 12 | 7.0 | 4.5 | 7 Felder | 1.56 |
| Kavallerie | 18 | 1.6 | 1.0 | Nahkampf (Mann gegen Mann) | 1.60 |
| Infanterie | 20 | 1.0 | 0.8 | Nahkampf (Mann gegen Mann) | 1.25 |
| Musketier | 15 | 2.4 | 2.0 | 4 Felder | 1.20 |

- Die Tabelle gibt keine Bewegungsgeschwindigkeit für Landeinheiten an.
- "Abgeleitet" ist eine Rechnung aus den Tabellenwerten und kein Wert von Tim.

### 1.3 Stärken und Schwächen gegeneinander

- **Kanonier** [TT], [TE], [Z-Ket]:
  - Die höchste Stärke am Boden (7.0), aber nur 12 Lebenspunkte und ein langsamer Schuss (4.5 s).
  - Reichweite 7 ist kürzer als die eines Turms (8). Deshalb schießt der Turm zuerst.
  - Kanoniers können nicht über Bäume und Gebäude schießen. Türme schon [TT, Robbie47].
  - Bäume blockieren die Schussbahn [TT, Neferankh].
- **Kavallerie** [TT], [TE]:
  - Schneller Schlag (1.0 s). Gut als Flankenschutz und gegen Kanonen.
  - MWHC berichtet, dass Kavallerie im Verhältnis 2:1 gegen Kanonen gewinnt. John Edward sieht Kavallerie als schnelle Eingreiftruppe gegen Invasionen.
  - FrankB hält Kavallerie gegen Türme für schwach.
- **Infanterie** [TE], [TT]:
  - Hält die Kanonen am Leben, weil der Gegner sonst zuerst die Kanonen trifft (King Z-ster).
  - Türme ignorieren laut FrankB Infanterie, was der Aussage von Terry widerspricht (siehe Abschnitt 9).
- **Musketier** [TT], [TE]:
  - Reichweite nur 4, also schwächer als Kanonier oder Turm.
  - Robitoby nutzt einen Musketier als Schutz für Türme: Er nimmt zwei weitere Treffer auf, bevor die Kanonen den Turm zerstören.
  - FrankB trainiert keine Musketiere.
- **Turm** [TM], [TT], [Z-Geb]:
  - Stein: 55 Lebenspunkte, Stärke 4.0, Intervall 3.0 s, Reichweite 8 Felder.
  - Holz: 37 Lebenspunkte, sonst gleiche Werte.
  - Schwach gegen Schiffe: zu kurze Reichweite, leicht auszuschalten, bei Schiffsangriffen oft nutzlos [TT, FrankB].
- **Schiffe** [TM]: Siehe Abschnitt 1.5.

### 1.4 Anzahl, Heilung und Ausmustern

- **Maximal 99 Bodeneinheiten** gleichzeitig [TK, BigTiny].
  - Trick von Joe Cool: Truppen zum Arzt schicken, dann aus der Burg neu ausbilden. Das lässt sich wiederholen.
- **Heilung**:
  - Truppe anklicken, Strg+Klick auf den Arzt (Doctor). Bei Helen laufen die Einheiten auch ohne Strg hin [TK].
  - Während der Heilung zahlt man keinen Sold für die Einheit [TK, Michael].
  - Bug: Speichert man während der Heilung, verschwinden die Einheiten [TK, Zomby Woof].
  - Das Arzt-Symbol im Auswahlmenü wählt nur die am stärksten verwundeten Einheiten aus. Es heilt nicht [TK, Robitoby].
- **Ausmustern**: Spätere Versionen haben einen Knopf dafür. Frühere nicht [TK].
- **Bäume roden**: Einheit wählen, Strg+Klick auf jedes Baumfeld [TTu, TK].

### 1.5 Schiffe [TM], [Z-Schiff]

| Schiff | Deutsch | Freischaltung | Geldkosten | Holz | Tuch | Kanonen (Tabellenspalte) | Bauzeit in s (kleine / große Werft) | Ladung (t) | Lebenspunkte | Stärke | Intervall (s) | Reichweite | Tempo leer / voll (100 = kleines Handelsschiff) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Large Trading | Großes Handelsschiff (Ü) | 500 Kaufleute | 520 | 45 | 5 | 10 | - / 105 | 300 | 80 | 4 | 1 | 7 - 8 | 80 / 48 |
| Large Warship | Großes Kriegsschiff (Ü) | 500 Kaufleute | 900 | 60 | 7 | 14 | - / 140 | 400 | 120 | 7.0 | 2 | 7 - 8 | 120 / 72 |
| Small Trading | Kleines Handelsschiff (Ü) | 120 Siedler | 400 | 25 | 3 | 6 | 120 / 65 | 200 | 50 | 4 | 2 | 7 - 8 | 100 / 60 |
| Small Warship | Kleines Kriegsschiff (Ü) | 120 Siedler | 600 | 32 | 4 | 8 | 150 / 100 | 150 | 65 | 4 | 2 | 7 - 8 | 110 / 66 |
| Pirate | Piratenschiff (Ü) | nur Gegner | - | - | - | 10 (Maximum, laut Falke) | - | - | 95 | 4 | 1 | 7 - 8 | 90 / 54 |

- Schiffe brauchen die Bevölkerungsstufe zum Bau. Kaufen von anderen Spielern geht ohne [TM, Fußnote].
- Die Spalte "Kanonen" in der Schiffstabelle ist nicht eindeutig. Die Tabelle wertet sie wie Baukosten. Tim schreibt aber in 3.8.7, neue Schiffe seien nicht automatisch bestückt [Z-Schiff]. Es ist also wahrscheinlich die Bestückungskapazität. Siehe Widersprüche.
- Die Tabelle zur Stärke bei Schiffen ist widersprüchlich: Das Großes Handelsschiff hat rechnerisch mehr Schaden pro Sekunde (4.0) als das Großes Kriegsschiff (3.5) (abgeleitet). Die Erklärung fehlt in den Quellen.

**Schiffsbau und Werften** [Z-Schiff], [TT]:
- Die kleine Werft braucht 120 Siedler, die große 500 Kaufleute.
- Bestellt wird an der Werft. Das Material kommt automatisch.
- Eine Werft braucht einen Markt in ihrem Einflussbereich.
- Große Werften bauen kleine Schiffe fast doppelt so schnell. Die Tabelle zeigt 120 zu 65 Sekunden (Faktor 1.85) und 150 zu 100 (Faktor 1.5).
- Ein großes Kriegsschiff lässt sich an einer kleinen Werft bauen, wenn eine große Werft existiert (FrankB).
- Reparatur: Werft, Reparatur-Knopf, Holz und Tuch. Es wird nur ein Schiff gleichzeitig repariert [Z-Schiff, Render].
- Schiffe lassen sich vom Handelspfad zur Werft zurückschicken, dort reparieren und dann wieder einsetzen [TT, Maddoc].

**Ladung und Kanonen**:
- Kanonen werden als Fracht ins Schiff geladen und dann im Kampfmenü angeklickt.
- Abrüsten über das größere Kanonensymbol im Schiffsmenü [TTu, Z-Schiff].
- Die KI bestückt neue Schiffe automatisch, aber nur mit einer Kanone [Z-Schiff].

**Transport**:
- Truppen einschiffen: Schiff an die Küste, Einheit wählen, Strg+Klick auf das Schiff [TK, Z-Schiff].
- Aussteigen: Im Laderaum klicken, wenn das Schiff an einer Insel liegt [TTu].
- Mit Patrouille: Zwischen dem Startpunkt und dem gewählten Punkt. Feindliche Schiffe können ihre Insel umkreisen, der Spieler nicht [Z-Schiff, Zomby Woof].

### 1.6 Stärken und Schwächen der Schiffe

- Große Kriegsschiffe sind die schnellsten Kriegsschiffe mit der größten Ladung (400 t) und den meisten Kanonen (14) [TM].
- Mit 200 t Ladung verlieren kleine Schiffe laut Waywardsoul stark an Tempo, große Kriegsschiffe kaum. Robitoby: Ein großes Handelsschiff mit 200 t ist langsamer als ein großes Kriegsschiff mit 200 t [TT]. Die Tempo-Werte der Tabelle passen dazu.
- Ein Schiff mit vier Kanonen kann laut BBDevo nicht gegen ein Piratenschiff bestehen [Z-Pir]. Es handelt sich um eine Erfahrung, keine Regel.

---

## 2. Militärgebäude

### 2.1 Burgen, Festung, Türme, Tore, Mauern

Die Liste zeigt Freischaltung, Kosten, Betriebskosten und Funktion. Abdeckung ist der quadratische Radius in Feldern.

| Gebäude (EN) | Deutsch (Quelle) | Freischaltung | Geld | Holz | Ziegel | Werkzeug | Betrieb (aktiv/passiv) | Größe | Abdeckung | Funktion und Hinweise |
|---|---|---|---|---|---|---|---|---|---|---|
| Castle | Burg (D-Giga: "Kleine Burg" im Kostenteil) | 200 Siedler | 600 | 3 | 10 | 4 | 55 | 2x2 | 15 | Ausbildung aller Landeinheiten (200 s). Angabe "3 soldiers trained", Bedeutung unklar [Z-Geb] |
| Large castle | Große Burg (D-Giga) | 400 Kaufleute | 1300 | 5 | 18 | 8 | 90 | 3x3 | 15 | Ausbildung aller Landeinheiten (140 s). Angabe "5 soldiers trained" [Z-Geb] |
| Fort | Festung (D-Giga) | 600 Aristokraten | 2500 | 8 | 25 | 12 | 130 | 5x5 | 15 | Ausbildung aller Landeinheiten (100 s). Angabe "8 soldiers trained" [Z-Geb] |
| Watchtower | Wachturm (D-Giga) | 200 Siedler | 300 | 1 | 6 | 2 | 5 | 1x1 | 8 | Stein, 55 Lebenspunkte. Braucht 2 Kanonen dauerhaft. Reichweite 8 [TM, TK] |
| Wood watchtower | Hölzerner Wachturm (D-Giga) | 200 Siedler | 200 | 7 | - | 2 | 5 | 1x1 | 8 | Holz, 37 Lebenspunkte. Braucht 2 Kanonen [TM] |
| Palisade | Palisade (D-Giga) | 30 Siedler | 10 | 2 | - | - | - | - | - | Keine Funktion beschrieben, nur Kosten [Z-Geb] |
| Wooden gate | Holztor (D-Giga) | 30 Siedler | 12 | 2 | - | - | - | - | - | Tor aus Holz [Z-Geb] |
| Gate | Tor (D-Giga) | 200 Siedler | 15 | - | 3 | - | - | - | - | Lässt sich nicht schließen [TK] |
| City gate | Stadttor (D-Giga) | 200 Siedler | 25 | - | 4 | - | - | - | - | Lässt sich nicht schließen [TK] |
| Wall | Mauer (D-Giga) | 200 Siedler | 18 | - | 2 | - | - | - | - | Blockiert feindliche Soldaten [Z-Kol, Chrishillcoat] |

- Kein Tor lässt sich schließen [TK, 3.9.14].
- Mauern lassen sich nicht über Flüsse ziehen, nur an der Küste [Z-Kol].
- Einen Turm ohne zwei Kanonen gibt es nicht. Die Kanonen bleiben im Turm, bis er zerstört ist [TK].
- Mehr als 255 Türme schießen laut FrankB nicht mehr [TK]. Das ist eine Behauptung ohne Beleg in den Quellen.
- Türme schießen über Hindernisse hinweg, Kanonier nicht [TT, Robbie47].
- Ein Turm schießt nur auf Feinde, mit denen man im Krieg ist, und nur innerhalb der 8 Felder [TK, FrankB].

### 2.2 Arzt, Triumphbogen und Werften

| Gebäude (EN) | Deutsch (Quelle) | Freischaltung | Geld | Holz | Ziegel | Werkzeug | Betrieb | Größe | Abdeckung | Funktion |
|---|---|---|---|---|---|---|---|---|---|---|
| Doctor | Arzt (D-Giga) | 50 Bürger | 450 | 4 | 9 | 4 | 30 | 2x2 | 16 | Heilung von Truppen [TK, Z-Geb] |
| Arch of Triumph | Triumphbogen (D-Wiki) | Sieg über einen Gegner | nicht angegeben | - | - | - | - | 1x3 | - | Denkmal für jeden besiegten Gegner (und Piraten, wenn die Szenarie sie als Gegner führt). Bringt laut Spieler mehr Schiffe ins Limit [Z-Kol, Z-Schiff] |
| Small shipyard | Kleine Werft (D-Giga) | 120 Siedler | 1100 | 12 | 3 | 8 | 100 / 20 | 3x3 | 13 | Baut kleine Schiffe [Z-Geb] |
| Large shipyard | Große Werft (D-Giga) | 500 Kaufleute | 2800 | 25 | 63 | 10 | 150 / 30 | 4x4 | 17 | Baut große Schiffe [Z-Geb] |

- Den Arzt laut Tim ab 50 Bürgern. Die giga-Liste nennt dieselbe Stufe.
- Denkmäler: Pro besiegtem Gegner ein Triumphbogen, dazu einer bei besiegten Piraten, wenn das Szenario sie als Gegner führt [Z-Kol].
- Palast und Kathedrale nur je einmal pro Spiel [Z-Kol].

---

## 3. Waffenproduktion

### 3.1 Die drei Waffenketten

| Produkt | Freischaltung | Gebäude (EN / deutsch) | Geld | Holz | Ziegel | Werkzeug | Betrieb (aktiv/passiv) | Lager | Eingabe => Ausgabe [TM, Z-Ket] |
|---|---|---|---|---|---|---|---|---|---|
| Swords | 200 Siedler | Swordmaker / Schwertschmiede (D-Giga: "Schwertbauer") | 450 | 4 | 10 | 5 | 30 / 14 | 4 | Eisen => Schwert (1 zu 1, abgeleitet) |
| Cannons | 400 Bürger | Cannon foundry / Kanonengießerei | 750 | 5 | 15 | 6 | 60 / 25 | 4 | Holz + Eisen => Kanone |
| Muskets | 400 Kaufleute | Gunsmith / Musketenbauer | 600 | 4 | 10 | 9 | 45 / 20 | 4 | Holz + 2 Eisen => Muskete |

**Vorstufen**:

| Gebäude (EN / deutsch) | Freischaltung | Geld | Holz | Ziegel | Werkzeug | Betrieb | Lager | Eingabe => Ausgabe |
|---|---|---|---|---|---|---|---|---|
| Ore refinery / Erzschmelze | 120 Siedler | 200 | 1 | 4 | 3 | 25 / 10 | 5 | Holz + Eisenerz => Eisen |
| Iron mine / Erzmine (D-AK, D-Giga: "Kleine Erzmine") | 120 Siedler | 1000 | 20 | 5 | 10 | 60 / 20 | 4 | Eisenerz |
| Deep iron mine / Tiefe Erzmine | 450 Bürger | 1800 | 30 | 7 | 15 | 60 / 20 | 4 | Eisenerz |
| Forester lodge / Forsthaus | keine Bevölkerung | 50 | - | - | 2 | 5 / 0 | 10 | Holz |
| Tool smithy / Werkzeugschmiede | 100 Siedler | 150 | 2 | 5 | 3 | 25 / 10 | 4 | Eisen => 2 Werkzeuge |

- Tim notiert Umwandlungen als "Eingabe => Ausgabe". Ohne Zahl gilt 1 zu 1 (abgeleitet). Ausnahmen laut Notation: "Iron => 2xTools" (1 Eisen ergibt 2 Werkzeuge) und "Wood + 2xIron => Muskets" (2 Eisen je Muskete).
- Das Forsthaus hat laut Tim keine Bevölkerungsstufe.

### 3.2 Gesamtkosten der Waffenketten [D-AK]

Annoinfo gibt die Summe der Gebäude einer Kette an. Die Summe enthält auch die Forsthäuser und die Erzmine.

| Kette | Freischaltung | Baukosten gesamt | Holz | Werkzeug | Ziegel | Betrieb (Unterhalt) | Produktion | Wert je t |
|---|---|---|---|---|---|---|---|---|
| Schwerter | 200 Siedler | 1705 | 25 | 20 | 19 | -125 / -44 | 1,15 t/min | 85,00 |
| Kanonen | 400 Bürger | 2055 | 26 | 23 | 24 | -155 / -55 | 1,15 t/min | 112,0 |
| Musketen | 400 Kaufleute | 1905 | 25 | 26 | 19 | -145 / -50 | 1,15 t/min | 98,00 |

- **Abgeleitet**: Die Summe der Gebäudepreise ergibt 1700 (Schwerter), 2050 (Kanonen) und 1900 (Musketen). Es fehlt jeweils 5 zur Annoinfo-Summe. Die Abweichung ist in allen drei Ketten gleich groß, also vermutlich eine Kleinigkeit wie eine Straße. Nicht geklärt.
- Schwerter: 1 Forsthaus. Kanonen und Musketen: 2 Forsthäuser [D-AK].

### 3.3 Produktionsfluss zur Truppe [Z-Ket]

- Waffen laufen aus Lager oder Markt zur Burg oder Festung.
- Kanone: Kanonengießerei zum Kanonenturm oder zur Burg, Ausbildung Kanonier.
- Muskete: Musketenbauer zur Burg, Ausbildung Musketier.
- Schwert: Schwertschmiede zur Burg, Ausbildung Infanterist oder Kavallerist.
- Schiffe: Kleine Werft für kleine Schiffe, große Werft für große. Beide brauchen Holz und Tuch.

---

## 4. Kampfmechanik

### 4.1 Ablauf eines Gefechts

- **Angriff**: Schiff oder Einheit wählen, Kampfmenü öffnen, Ziel anklicken. Mehrere Einheiten lassen sich mit einem Rahmen wählen [TTu, Z-Pir].
- **Automatik**: Einheiten greifen innerhalb ihrer Reichweite automatisch an. Der Turm schießt auf ein Ziel in der Reichweite. Die Zielpriorität ist widersprüchlich (siehe Abschnitt 9).
- **Gesundheit**: Ein roter und grüner Balken zeigt den Zustand über ausgewählten Einheiten. Beschädigte Schiffe fahren langsamer, komplett zerstörte sinken [TTu].
- **Formationen**: Es gibt Formationsschaltflächen, mit denen sich Einheiten in einer Linie aufstellen [TT, FrankB]. Die Regeln dahinter sind nicht beschrieben.
- **Tastenkürzel**: F4 vor dem Gefecht (Sir Henry). Was F4 bewirkt, steht nicht in den Quellen.
- **Gruppen**: Strg+Ziffern erstellen Gruppen, Ziffern rufen sie ab. Das klappt auch mit Gegnern und in Mehrspielerpartien. Gruppen gehen beim Neustart verloren [TK, FrankB].
- **Feuer**: Eine Brandmechanik für Kampf gibt es in den Quellen nicht. Brände betreffen Häuser und die Feuerwehr, das ist ein anderes Thema.
- **Moral**: nicht in den Quellen.
- **Erfahrung oder Veteranen**: nicht in den Quellen.

### 4.2 Belagerung eines Turms (Rechnung)

Die Werte stammen aus [TM] und [TT], die Schadensmodelle sind von Neferankh bestätigt.

| Größe | Wert | Quelle |
|---|---|---|
| Schaden des Turms pro Treffer | 4 | [TM] |
| Treffer des Turms, um einen Kanonier (12 Lebenspunkte) zu töten | 3 | abgeleitet, Neferankh bestätigt |
| Treffer eines Kanoniers (Stärke 7) gegen Steinturm (55 Lebenspunkte) | 8 | abgeleitet |
| Treffer eines Kanoniers (Stärke 7) gegen Holzturm (37 Lebenspunkte) | 6 | abgeleitet |
| Reichweite Turm / Kanonier | 8 / 7 | [TM] |

- Der Turm schießt zuerst, weil er weiter reicht [TT, Neferankh].
- Neferankh: 8 Kanonier erledigen einen Steinturm in einem Schuss, wenn alle schießen können [TT].
- Blockierte Kanoniers kommen nicht zum Schuss, können aber vom Turm getroffen werden [TT, Neferankh].

**Empfohlene Anzahl Kanoniers pro Turm** (Widerspruch, siehe Abschnitt 9):
- 4 bis 6, nach 1 oder 2 Kavalleristen zur Ablenkung (Robbie47).
- 6 bis 8 (FrankB).
- 7 mit einem Kavalleristen davor (Dread Pirate Terry).
- 8 bis 10 (Sir Henry, auf einer Reihe, vor Angriff F4).
- 10 als Minimum (Neferankh), 16 für verlustfreien Angriff (Neferankh).

**Vorgehen** [TT]:
- Weg zum Turm freiräumen: Häuser, Farmen, Büsche, Bäume (Terry, Robbie47).
- Kanoniers außerhalb der Turmreichweite in einer Linie aufstellen.
- Ein Kavallerist greift zuerst an und lenkt die Turmwache ab, dann die Kanoniers.
- Verwundete Kanoniers zurückziehen, bevor sie sterben (FrankB).
- Zwei überlappende Türme sind schwieriger (Terry).

### 4.3 Eroberung von Gebäuden, Kontoren, Marktplätzen und Inseln

- **Zerstören**: Zuerst Lager und Marktplätze des Gegners auf der Insel zerstören, bis dort kein intaktes Kontor und kein intakter Markt mehr steht [TK, Robitoby].
- **Kontor übernehmen**: Schiff mit genug Baumaterial für ein Kontor an die Stelle des feindlichen Kontors setzen. Dann übernimmt man alle noch stehenden Gebäude und Waren [TK, Robitoby]. Marktplätze verfallen trotzdem und brauchen Reparatur.
- **Alternative**: Den Gegner immer wieder zerstören, bis er keinen Kontor oder Marktplatz mehr baut [TK, Robitoby].
- **Qualität der Gebäude**: Nach der Eroberung oft schlecht geplant. Bauernhöfe und Plantagen liegen oft ungünstig. Ron empfiehlt, die meisten sofort abzureißen [TT].
- **Lager**: Ein großes Kontor durch ein kleines zu ersetzen, senkt das Lager um 70 t (FrankB). Die Tabelle stimmt: Kontor IV 100, Kontor I 30 [D-Giga, Z-Geb].
- **Straßen löschen auf eroberter Insel**: nicht möglich, nach Zach82 ein Bug. Es klappt, wenn noch kein Kontor steht oder das Gebiet dem Feind gehört (Koemi). Michael vermutet, dass Türme die Bauzone bestimmen. Das Tool "Anno 1602 Tile Softener" von Sir Henry kann den Spielstand beschädigen [TK].
- **Piratenkontor**: Verschwindet es sofort nach der Zerstörung, wenn Nahrungsproduzenten (Jäger, Fischer) und Türme ebenfalls weg sind, lässt sich ein eigenes setzen. Lebt die Nahrungsversorgung noch, bleibt die Ruine stehen [Z-Kol, Günter].
- **Kosten nach Eroberung**: Die Stadt des Gegners kann tief im Minus sein. Ihre Einkaufsliste bleibt aktiv, deshalb streichen und unnötige Gebäude abreißen [TK, Budgie, Governor Benji].
- **Heimatlose KI**: Eine KI ohne Land wird zum Piraten und wechselt nicht zurück (Sir Henry) [TT].
- **Eroberte Werft**: Schiffe, die gerade dort fertig werden, gehören danach dem Eroberer [Z-Schiff, Zomby Woof].
- **Szenario-Ziel**: Manche Szenarien verlangen, alle Gegner zu besiegen [TT, Worker72].

### 4.4 Wirtschaftskrieg, Blockade und Aushungern

- **Hafenblockade**: Mehrere Schiffe nötig. Die Obergrenze liegt laut Günter bei 33 Schiffen, aber freie Händler schlüpfen durch [TT]. Bei einem engen Hafen reicht ein Schiff (Zach83).
- **Zwei Schiffe vor der Werft**: Sie zerstören neue Schiffe der KI. Die KI geht irgendwann das Holz aus [TT, FrankB].
- **Bankrott**: Die KI geht nie ganz bankrott. Sie hat nur Probleme, Waren zu bezahlen [TT, Zomby Woof].
- **Nahrung**: Nahrungserzeuger und Warenlager zerstören, damit die Stadt hungert [TT, Zach82].
- **Baustoffe**: Steinbrüche und Holzfäller zerstören, damit die KI keine Mauern neu bauen kann [TT, Rayser, Mircea].
- **Verkaufsstopp**: Keine Baumaterialien an die KI verkaufen, sonst verkaufen freie Händler sie dem Gegner weiter [TT, FrankB].
- **Invasionsbasis**: Ein Lager mit Arzt, großer Werft, großer Burg, Holz, Tuch, Werkzeug, Ziegel und Nahrung auf einer kleinen Nachbarinsel. Dann angreifen [TT, Ron].

### 4.5 Seeschlacht

- **Linientaktik**: Eine Schlachtreihe aus 5 bis 6 Schiffen, Bug an Heck. Jedes Schiff feuert mit allen Kanonen. Kleine Schiffe in die Mitte, dort halten sie Feuer und sinken eher (Ron). Mehr als 5 Schiffe behindern sich (Ggcourt).
- **Start**: Gesunde Schiffe starten den Angriff. Gefecht fern der Küstenverteidigung (Tim-Tipp).
- **Rückzug**: Beschädigte Schiffe über eine Handelsroute zur Werft schicken. Sie fahren dann langsam zurück, während das Gefecht weiterläuft (Maddoc).
- **Hinterhalt**: Eine feindliche Schiffsreihe von hinten aufrollen. Die Angriffsgruppe zieht sich bei etwa 50 Prozent Schaden zurück, die Reserve deckt den Rückzug (Terry).
- **Küstenangriff**: 5 Schiffe zerstören Küstenwachtürme, Märkte, Häuser und Produktionsgebäude in Kanonenreichweite (Ggcourt).
- **Überraschungsangriff**: Ein großes Schiff des Gegners angreifen, dann kommt die Flotte der KI (Shane).
- **Kanonen je Schiff**: Stefanus meint, 10 Kanonen schießen schneller. Das ist unsicher und nicht überprüft.
- **Schiffslimit**: Siehe Abschnitt 9.

### 4.6 Piraten und Eingeborene

**Piraten** [Z-Pir]:
- Bestechung: mit einem unbewaffneten Schiff am Piratenkontor. Dann kann man Schutz kaufen oder Piraten gegen andere Spieler schicken (Terry).
- Die Summe hängt vom Geld des Spielers ab (FrankB). Konkrete Beträge stehen in den Quellen nicht.
- Bestechung wirkt nur eine Zeit lang. Wer auf der Piraten-Insel siedelt, kann sich nicht freikaufen (FrankB).
- Piraten können Bodeneinheiten stehlen, aber keine Kanonen an Deck (Tim, Günter).
- Ein Piratenschiff repariert sich nicht (Eric Lorah).
- Weiße Flagge (Taste W) lässt den Angriff ausbleiben. Die Flagge bleibt nicht beim Neustart (FrankB, Mircea).
- Ein Tribut in Form von Gütern lässt die Piraten eine Zeit lang in Ruhe (mamayourpeoplearehungry, Manfred).
- Versenkte Piratenschiffe kommen als Ersatz wieder (Manfred). Stark beschädigte, nicht versenkte Schiffe fahren nur langsam (Manfred, Robbie47).

**Eingeborene** [Z-Pir], [TM]:
- Angriff auf eine Siedlung löst einen Fluch aus: Dürre, Feuer, Seuche. Außerdem kein Handel mehr und Goldvorkommen werden zerstört (Zomby Woof, Robbie47). Der Fluch dauert etwa 15 bis 20 Minuten (Joe Cool).
- Eingeborene greifen selten an, meist nur, wenn man Truppen in ihre Siedlung bewegt [Z-Hand].
- Schuss auf Bäume in Eingeborenen-Gebiet gilt als Angriff und beendet den Handel (Wargamerit) [Z-Hand].

---

## 5. Taktik-Faustregeln

1. **Erst Wirtschaft, dann Krieg.** Krieg kostet viel. FrankB nennt mindestens 700 Kaufleute, Zomby Woof 750. Ein großes Kriegsschiff braucht 500 Kaufleute [TT].
2. **Militärindustrie stufenweise aufbauen**: erst Schwertschmiede, dann Kanonengießerei, dann Burgen und Truppen (blacstorm).
3. **Kanonier braucht Infanterist**: Infanterie schützt die Kanonen vor dem Tod (King Z-ster).
4. **Turmangriff in der Gruppe**: 8 bis 10 Kanoniers in einer Reihe, Weg freiräumen, Verwundete zurückziehen (Sir Henry).
5. **Verteidigung billig halten**: 2 bis 3 Türme reichen gegen eine kleine Invasion (Zomby Woof). FrankB rät zu 1 bis 2 Türmen plus Mauer oder Bäumen.
6. **Kavallerie als schnelle Reserve**: gegen Kanonen im Verhältnis 2:1 gut, im Heimatland stationiert (MWHC).
7. **Schiffe vor Gefecht reparieren**. Bei Angriff zurückschicken, wenn sie halb zerstört sind (Terry, Maddoc).
8. **Schlachtreihe** statt Gewühl: große Schiffe vorn, kleine in der Mitte (Ron).
9. **Hinterhalt auf KI-Handelsrouten**: Routen vorher beobachten (Terry).
10. **Vor der Invasion die gegnerische Flotte versenken**, Werft blockieren und Baustoffe kappen (FrankB, Mircea).
11. **Piraten nicht vollständig versenken**: stark beschädigt fahren sie langsam, neue Schiffe kommen sonst immer wieder (Manfred).
12. **Eingeborene nicht angreifen**: sonst kein Handel mehr (Robbie47).
13. **Verwundete an einem Lager heilen**: Lager und Arzt nahe beieinander (hiking).
14. **Frühen Angriff auf Mitspieler meiden**: Ein angeschlagenes Schiff bremst Erkundung, Handel und Siedlung (Immelman).

---

## 6. Punkte und Endwertung [TS]

Die Endwertung folgt Charlies Berechnungen. Viele Faktoren sind nicht vollständig bekannt.

### 6.1 Siedlungen und Bevölkerung

Bevölkerung in Häusern, Ergebnis für einen Aristokraten-Stadtteil auf einer riesigen Insel:

| Bevölkerung | Punkte | Zuwachs |
|---|---|---|
| 1.000 | 615 | 615 |
| 2.000 | 1.777 | 1.162 |
| 3.000 | 3.203 | 1.426 |
| 4.000 | 5.004 | 1.801 |
| 5.000 | 6.694 | 1.690 |
| 6.000 | 8.668 | 1.974 |
| 7.000 | 10.748 | 2.080 |
| 8.000 | 13.655 | 2.907 |
| 9.000 | 19.491 | 5.836 |
| 10.000 | 25.596 | 6.105 |
| 11.000 | 29.860 | 4.264 |
| 12.000 | 34.246 | 4.386 |

- Bis etwa 10.000 Einwohner bringt jedes Haus mehr als das vorherige. Danach bringt jedes Haus weniger (Charlie).
- Punkte pro 100 Einwohner nach Stufe (GameStar): Pioniere 60, Siedler 80, Bürger 100, Kaufleute 150, Aristokraten 200.
- Die Insel-Größe zählt. 10 Aristokratenhäuser ergeben auf einer kleinen Insel etwa 110 Punkte, auf einer riesigen etwa 185.
- Öffentliche Gebäude geben kleine Werte, etwa 0,75 für eine Plantage und 0,55 für einen Marktplatz.

### 6.2 Statuen, Kasse, Inseln

- **Statuen (Zufriedenheit)**: Punkte für die ersten sieben Statuen: 700, 600, 400, 400, 300, 300, 270. Ab Statue 48 zählt praktisch nichts mehr, danach beginnt das Muster von vorn (Charlie). Dread Pirate Terry beschreibt einen anderen Verlauf: Der Wert eines Denkmals sinkt langsam von etwa 500 Punkten, nie auf null (siehe Abschnitt 9).
- **Kasse**: Ab 50.000 gibt es 1.000 Punkte, ab 100.000 1.500, ab 250.000 2.000, ab 500.000 2.500, ab 1 Mio. 3.000, ab 5 Mio. 4.000, ab 10 Mio. 5.000. Mehr Geld zählt laut Neferankh vermutlich nicht.
- **Inseln**: Quadrate unter Kontrolle durch 5 ergibt die Punkte. Der Höchstwert liegt laut Charlie kaum über 6.000.

### 6.3 Kampfpunkte

| Eigene Einheiten getötet | Punkte | Schiffe getötet | Punkte |
|---|---|---|---|
| 50 | 1.000 | 20 | 1.000 |
| 100 | 2.000 | 40 | 2.000 |
| 200 | 3.000 | 80 | 3.000 |
| 300 | 4.000 | 120 | 4.000 |
| 400 | 5.000 | 160 | 5.000 |
| 550 | 6.000 | 220 | 6.000 |
| 700 | 7.000 | 280 | 7.000 |
| 800 | 8.000 | 320 | 8.000 |
| 900 | 9.000 | 360 | 9.000 |
| 1.000 | 10.000 | 400 | 10.000 |

- Die Einheiten-Wertung ist auf 10.000 gedeckelt, ebenso die Schiffs-Wertung.
- Eigene Verluste werden abgezogen.
- Eingeborene-Tote zählen als gegnerische Einheiten (Frieden).
- **Gegner besiegt**: 1.500 Punkte je besiegtem Gegner.
- **Missionsbonus**: +100 Prozent, nur in Szenarien, nicht im Endlosspiel.

### 6.4 Siegbedingungen

- Im Endlosspiel nennen die Quellen kein Siegziel. Die Endwertung ist der Punktestand [TS].
- Szenarien haben eigene Ziele. Ein Beispiel ist "alle Gegner besiegen" (Worker72). Die Szenario-Ziele selbst fehlen in den Quellen (siehe Abschnitt 8).

---

## 7. Mehrspieler [TMP]

- **Verbindung**: Es gibt keinen Server und keinen Dienst. Die Spieler tauschen IP-Adressen über Messenger (ICQ, AIM). Die eigene IP erfährt man mit winipcfg (Windows 9x) oder ipconfig (Windows 2000/XP) oder einem IP-Prüfdienst im Netz. Spieler finden sich im Forum.
- **Versionen**: Alle Spieler brauchen dieselbe Version. US-, UK- und deutsche Version sind nicht kompatibel. Original und NINA sind nicht kompatibel. Gleiche DirectX-Version empfohlen (Marc Huppke).
- **Chat**: Alt+1 an Rot, Alt+2 an Blau, Alt+3 an Gelb, Alt+4 an Weiß, Alt+5 an alle.
- **Spielstände**:
  - Jeder kann einen Mehrspieler-Spielstand im Einzelspiel laden. Weiterspielen kann aber nur der Host.
  - Die anderen Spieler bleiben im Einzelspiel stehen und gehen durch fehlende Versorgung zugrunde.
  - Fortsetzen geht nur auf dem Host-Rechner. Er lädt das Spiel für alle, das kann mehrere Minuten dauern. Niemand darf in dieser Zeit handeln (Günter).
  - Mehrspieler-Spielstände erkennt man an einem grauen Icon mit Nummer.
- **Spielerzahl** (Zusatz, nicht bei Tim): Annoinfo nennt bis zu 4 Spieler über Netzwerk und 2 über Modem [D-AI]. Wikipedia nennt Internet und LAN [D-Wiki].
- Tim nennt keine Spielerzahl.

---

## 8. Szenarien [TSz], [TTu]

### 8.1 Liste (Titel, Ziel nicht in den Quellen)

Die Quelle nennt nur die Titel. Die Ziele fehlen. Tim sagt, Ziele, Startressourcen und Karte bleiben bei den meisten Szenarien gleich. Bei einigen ist die Karte zufällig. Ein Neustart des Spiels zeigt den Zufall, ein Neustart des Szenarios nicht.

| Nr. | Titel (EN) | Deutsch (Ü) | Ziel | Hinweis Tim |
|---|---|---|---|---|
| 4.1 | Tutorials | Tutorials (Ü) | Lehrgang mit sechs Abschnitten (Abschnitt 10) | Erklärt die Grundlagen im Spiel |
| 4.2 | The End of a Long Trip | Das Ende einer langen Reise (Ü) | nicht in Quellen | - |
| 4.3 | One Lone Settlement | Eine einsame Siedlung (Ü) | nicht in Quellen | - |
| 4.4 | The Search for Ore Deposits | Die Suche nach Erzvorkommen (Ü) | nicht in Quellen | - |
| 4.5 | Peaceful Reign | Friedliche Herrschaft (Ü) | nicht in Quellen | - |
| 4.6 | The Test (The Trial) | Die Prüfung (Ü) | nicht in Quellen | - |
| 4.7 | Little Land | Kleines Land (Ü) | nicht in Quellen | - |
| 4.8 | New Discoveries | Neue Entdeckungen (Ü) | nicht in Quellen | - |
| 4.9 | Good Neighbors | Gute Nachbarn (Ü) | nicht in Quellen | - |
| 4.10 | Dark Clouds on the Horizon | Dunkle Wolken am Horizont (Ü) | nicht in Quellen | - |
| 4.11 | Competition | Konkurrenz (Ü) | nicht in Quellen | - |
| 4.12 | The Monopoly | Das Monopol (Ü) | nicht in Quellen | - |
| 4.13 | Cooperation | Zusammenarbeit (Ü) | nicht in Quellen | - |
| 4.14 | The Alliance | Das Bündnis (Ü) | nicht in Quellen | - |
| 4.15 | A Plague of Pirates | Eine Piratenplage (Ü) | nicht in Quellen | - |
| 4.16 | The Intruder | Der Eindringling (Ü) | nicht in Quellen | - |
| 4.17 | The Fortress | Die Festung (Ü) | nicht in Quellen | - |
| 4.18 | NINA Campaigns and Scenarios | NINA-Kampagnen und -Szenarien (Ü) | nicht beschrieben | Nur Hinweis auf Zusatzinhalt |

- Die ersten Szenarien sind verlängerte Tutorials, später offener mit mehreren Lösungswegen [TSz].
- Annoinfo nennt für die Königs-Edition über 100 Missionen und für NINA über 40 neue Szenarien [D-AI]. Tim zählt dagegen nur die 17 Einträge des Basisspiels (siehe Abschnitt 9).

---

## 9. Widersprüche

| Thema | Aussage A (Quelle) | Aussage B (Quelle) | Einordnung |
|---|---|---|---|
| Schiffslimit | 33 Schiffe (Eric Lorah, Günter, Worker72) [Z-Schiff, TT] | 20 Schiffe in der UK-Version, "gilt auch für die deutsche Version" (AnnoDan1602) [Z-Schiff] | Unklar. Die 33 stehen in mehr Beiträgen. Ein Schiffslimit lässt sich über Kauf, Eroberung und Arch of Triumph erhöhen |
| Zielpriorität des Turms | Schießt nur auf Kanonier, ignoriert Infanterie und Kavallerie (FrankB) [TT] | Schießt auf die erste Einheit in Reichweite, hier Kavallerie (Terry) [TT] | Widersprüchlich. Sir Henry schreibt "den nächsten" [TT] |
| Kanonier pro Turm | 4 bis 6 (Robbie47), 6 bis 8 (FrankB), 7 (Terry), 8 bis 10 (Sir Henry), 10 bis 16 (Neferankh) [TT] | Unterschiedliche Risikobereitschaft, kein echter Widerspruch | Die Rechnung mit 8 Schüssen für einen Steinturm passt zu allen |
| Anzahl Türme für Verteidigung | 1 bis 2 Türme plus Mauer (FrankB) [TT] | 2 bis 3 Türme (Zomby Woof) [TT] | Unterschiedlich. Keine Angabe zur Invasionsgröße |
| Kavallerie | Nie trainieren, schwach gegen Türme (FrankB) [TE] | 10 Kavalleristen gehalten (night hawk), gut gegen Kanonen (MWHC) [TE, TT] | Abhängig von Strategie |
| Musketier | Nie trainieren (FrankB) [TE] | 1 Musketier als Turmschutz (Robitoby) [TE] | Abhängig von Strategie |
| Kavallerie-Stärke | Muke09: "0,8 mehr Angriff als Schwertkämpfer" [TT] | Tabelle: 1.6 gegen 1.0, also 0,6 Unterschied [TM] | Der Wert des Spielers passt nicht zur Tabelle. Vermutlich ältere Werte |
| Kosten im Zitat "Zomby Woof" | Turm "kostet 5", Kanonier "14" [TT] | Tabelle: Turm 300 Geld, Kanonier keine Geldkosten. Unterhalt: Turm 5, Kanonier 14 [TM] | Zomby meint den Unterhalt, nicht die Baukosten |
| Kanonen-Spalte bei Schiffen | Tabelle: Kanonen als Baukosten (10 / 14 / 6 / 8) [TM] | Neue Schiffe werden nicht automatisch bestückt (3.8.7) [Z-Schiff] | Unklar. Vermutlich Bestückungskapazität |
| Statuen-Punkte | Feste Werte 700, 600, 400, 400, 300, 300, 270 (Charlie) [TS] | Wert sinkt langsam ab etwa 500 und nie auf null (Terry) [TS] | Widersprüchlich. Terry sagt, die Tabelle stimme für die US-Version nicht |
| Mehrspieler-Spielerzahl | Bis zu 4 Netzwerk, 2 Modem (annoinfo) [D-AI] | Internet und LAN ohne Zahl (Wikipedia) [D-Wiki]; keine Zahl bei Tim [TMP] | Nicht geklärt |
| Anzahl Szenarien | 17 Einträge (4.1 bis 4.17) plus NINA (Tim) [TSz] | Mehr als 40 neue Szenarien bei NINA, über 100 Missionen bei der Königs-Edition (annoinfo) [D-AI] | Unterschiedliche Zählung. Tim zählt nur Titel des Basisspiels |
| Namensvarianten | "Kleine Burg" im Kostenteil, "Burg" im Freischaltungsteil (D-Giga) [D-Giga] | Tim: "Castle" 200 Siedler, "Large castle" 400 Kaufleute, "Fort" 600 Aristokraten | Gleiches Gebäude, zwei deutsche Bezeichnungen |
| Schwertbau | "Schwertschmiede" in Freischaltung und Produktionsbeschreibung (D-Giga, D-AK) | "Schwertbauer" im Kostenteil (D-Giga) | Gleiches Gebäude, zwei Bezeichnungen |
| Werft-Bauzeit | "Fast doppelt so schnell" (Tim-Text) [Z-Schiff] | Tabelle 120 zu 65 Sekunden (Faktor 1.85), 150 zu 100 (Faktor 1.5) [TM] | Im Rahmen der Ungenauigkeit |
| Schule (nicht militärisch) | Tabelle: Schule 490 Geld [Z-Geb] | giga: Schule 450 Geld [D-Giga] | Nebenbefund |

**Die bestehende Datei 03-militaer-schiffe-welt.md** [Alt] passt nicht zu den Quellen:

- "Schwertschmiede ab 150 Bürgern": Quellen sagen 200 Siedler (Tim, giga, annoinfo).
- "Kanonengießerei ab 250 Kaufleuten": Quellen sagen 400 Bürger (Tim, giga, annoinfo).
- "Musketenbauer und große Burg ab 500 Kaufleuten": Quellen sagen 400 Kaufleute für beide.
- "Bestechung ca. 700, später 1400 Taler": in den Quellen dieses Ordners nicht belegt.
- "26 Einzelszenarien": Tim zählt 17 plus NINA.

Diese Angaben sollten nicht übernommen werden.

---

## 10. Tutorials [TTu]

| Abschnitt | Neue Konzepte (eigene Worte) |
|---|---|
| 4.1.1 Überblick | Anleitung folgt dem Spiel. Konzepte bleiben in späteren Szenarien bekannt. |
| 4.1.2 Erkunden | Schiff anklicken, dann Ziel anklicken. Erkunden: nahe an eine Insel fahren, anhalten, Augensymbol klicken, Balken füllt sich rot. Ressourcen: Mauszeiger über die Insel, Anzeige in der Textleiste. Erzvorkommen: Hämmer mit Erzklumpen-Symbol über dem Berg. Lager bauen: Schiff anklicken, Lagersymbol, Küstenplatz. Entladen: Schiff neben Lager, Tür-Symbol, Pfeile. |
| 4.1.3 Besiedeln | Bauen: Menü, Untermenü, Gebäude. Forsthaus braucht Bäume im Umkreis. Fischerhütte braucht mittelblaues Meer. Straßen verbinden Gebäude (ein Feld reicht). Häuser starten als Pioniere, Straßenanschluss empfohlen für die Feuerwehr. Informationsmenü zeigt Steuern und Zufriedenheit. Schafsfarm braucht freie Wiese. Markt erweitert das Gebiet und gibt zwei Karren. |
| 4.1.4 Handel und Diplomatie | Diplomatie: Handelsverträge, Friedensverträge (alle Szenarien starten im Frieden), Tribut. Handel mit Spielern läuft wie mit dem eigenen Lager, aber nur so weit, wie der andere verkaufen oder kaufen will. |
| 4.1.5 Seeschlacht | Kanonen bestücken: Schiff anklicken, Kanone im Laderaum anklicken. Angriff: Schiff, Kampfmenü, Ziel. Mehrfachauswahl mit Rahmen. Schäden: roter und grüner Balken, beschädigte Schiffe langsamer, zerstörte sinken. Patrouille: zwischen Startpunkt und gewähltem Punkt. |
| 4.1.6 Landschlacht | Truppen entladen: Schiff zur Küste, auf jeden Laderaum klicken. Einladen: Schiff nah ans Ufer, Truppe wählen, Strg+Klick aufs Schiff. Bäume roden: Einheit wählen, Strg+Klick auf jedes Baumfeld. |

---

## 11. Lücken

- **Szenarien-Ziele fehlen.** Die Quelle enthält nur die Titel. Ein Ziel je Szenario lässt sich daraus nicht ableiten. Die Seiten 4.2 bis 4.17 sind nicht im Ordner.
- **Deutsche Einheiten- und Schiffsnamen fehlen**: Infanterist, Kavallerist, Kanonier, Musketier und die Schiffsnamen sind Übersetzungen (Ü).
- **Moral, Erfahrung, Formationsregeln, Brandmechanik**: in den Quellen nicht beschrieben. Formationen erscheinen nur als Schaltfläche.
- **Landeinheiten-Geschwindigkeit** fehlt. Die Tabelle gibt nur Schiffsgeschwindigkeit an, und die ist nur relativ (100 = kleines Handelsschiff).
- **Einheit der Stärke** fehlt. Die Abschnitte oben nehmen an, dass die Stärke pro Treffer gilt. Neferankh bestätigt das für Turm und Kanonier.
- **Unterhaltseinheit** fehlt. Tim nennt den Wert nur als Zahl.
- **Piratenbestechung**: Beträge fehlen.
- **Kampfreichweite der Schiffe** ist nur grob angegeben (7 bis 8 Felder).
- **Kosten der Triumphbögen** fehlen.
- **Währung** ist nicht einheitlich. "Taler" ist in den Quellen nicht belegt.
- **Kanonen-Spalte der Schiffe** ist unklar (siehe Abschnitt 9).
- **Die 3 Zusatzdateien** (Z-Schiff, Z-Pir, Z-Hand, Z-Kol, Z-Ket, Z-Geb) sind nicht komplett gelesen, nur die militärisch relevanten Stellen. Es gibt weitere Passagen, die hier nicht berücksichtigt sind.
- **Keine Angaben zu Kampf-Heilung durch Arzt außerhalb von Burgen**, und keine zu Ausbildung in NINA-Szenarien.
