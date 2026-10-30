# Spielkonzept – Neue Ufer

Dieses Dokument beschreibt, wie das Spiel sich anfühlen und funktionieren soll. Es orientiert sich inhaltlich eng am Klassiker „Anno 1602“ (1998) und übernimmt nur dessen allgemeine Spielregeln (die sind nicht geschützt). Alle Namen, Texte und Zahlen sind eigen. Wo ich mir beim Original nicht sicher bin, steht **(eigene Festlegung)**.

**Kleines Wörterbuch:** *Kontor* = dein Hafenlager auf einer Insel. *Warenkette* = eine Reihe von Betrieben, die aus einem Rohstoff Schritt für Schritt ein Endprodukt machen. *Bedürfnis* = etwas, das Bewohner haben wollen, sonst sind sie unzufrieden. *Balancing* = das Feintuning aller Zahlen, damit das Spiel fair und spannend bleibt.

---

## 1. Kurzbeschreibung und Spielgefühl

Du landest mit einem Schiff an einer unbewohnten Insel im Segelzeitalter um 1600 und gründest ein Kontor. Aus einem Zeltlager wird Stück für Stück eine Stadt. Bald ist die Insel zu klein, du segelst zu neuen Ufern, findest dort andere Pflanzen und Rohstoffe, handelst, wehrst Piraten ab und misst dich mit Computergegnern.

Das macht das Erlebnis aus:

- **Eine Stadt, die wächst.** Zufriedene Bewohner steigen in fünf Stufen auf: Pioniere, Siedler, Bürger, Kaufleute, Aristokraten. Jede Stufe will mehr und zahlt mehr.
- **Warenketten wie ein Uhrwerk.** Du verbindest Betriebe so, dass alles läuft, und feilst am Gleichgewicht aus Einnahmen und Ausgaben.
- **Entdecken.** Nicht jede Insel kann alles. Wer Tabak, Gewürze oder Gold will, muss losfahren.
- **Kampf und Verteidigung** sind gleichwertig zum Aufbau, nicht optional: Piraten, Truppen, Seeschlachten, Eroberungen.
- **Handel** ergänzt das Ganze (weniger wichtig, aber dabei).
- **Ruhiger Takt:** Echtzeit mit Pause und Tempo 1x/2x/4x, Bedienung mit dem Finger im Querformat.

---

## 2. Bevölkerungsstufen

Bedürfnisse **addieren sich**: Wer aufsteigt, behält die alten Wünsche und bekommt neue dazu. Ausnahme: Die Kirche ersetzt die Kapelle. „Nahrung“ und „Alkohol“ sind jeweils **eine** Sammel-Ware aus mehreren Quellen. Ein öffentliches Gebäude muss **in Reichweite** stehen (Radius in Feldern).

| Stufe | Neue Waren-Bedürfnisse | Neue öffentliche Gebäude |
|---|---|---|
| Pioniere | Nahrung | Marktplatz |
| Siedler | Stoffe | Kapelle |
| Bürger | Alkohol | Wirtshaus |
| Kaufleute | Tabakwaren, Gewürze, Kakao | Kirche (ersetzt Kapelle), Schule |
| Aristokraten | Kleidung, Schmuck | Badehaus, Hochschule, Theater |

Die Verteilung der Luxuswaren auf Kaufleute und Aristokraten ist **(eigene Festlegung)**; Pioniere bis Bürger entsprechen dem heutigen Code.

| Stufe | Max. Bewohner/Haus | Aufstieg kostet | Steuer je Bewohner/Min. (Taler) | Verbrauch je Bewohner/Min. |
|---|---|---|---|---|
| Pioniere | 4 | – | 1,2 | Nahrung 0,12 |
| Siedler | 8 | 2 Holz, 1 Werkzeug | 2,0 | Nahrung 0,12; Stoffe 0,06 |
| Bürger | 15 | 2 Holz, 2 Werkzeug, 4 Ziegel | 3,0 | Nahrung 0,13; Stoffe 0,07; Alkohol 0,06 |
| Kaufleute | 25 | 3 Holz, 3 Werkzeug, 6 Ziegel | 4,5 | Nahrung 0,14; Stoffe 0,07; Alkohol 0,07; Tabakwaren 0,04; Gewürze 0,04; Kakao 0,03 |
| Aristokraten | 40 | 4 Holz, 4 Werkzeug, 10 Ziegel | 6,5 | Nahrung 0,15; Stoffe 0,08; Alkohol 0,08; Tabakwaren 0,05; Gewürze 0,05; Kakao 0,04; Kleidung 0,04; Schmuck 0,02 |

Kaufleute und Aristokraten sind **(eigene Festlegung)**; die ersten drei Zeilen stammen aus `src/data.ts`. Erfüllte Bedürfnisse: Bewohner ziehen ein, das Haus steigt auf. Unerfüllte: sie werden unzufrieden, zahlen weniger Steuern und ziehen schließlich weg. Die Haus-Info zeigt immer, was fehlt.

---

## 3. Waren und Warenketten

Schreibweise: **Gebäude** (Standort) → Ware.

**Baustoffe**
- **Holzfäller** (Wald in Reichweite) → Holz
- **Steinbruch** (am Berg) → Stein → **Steinmetz** (Stein) → Ziegel
- **Köhlerei** (Holz) → Holzkohle

**Werkzeug und Metall**
- **Erzmine** (am Berg, erschöpfbar) bzw. **tiefe Erzmine** (am Berg, praktisch unerschöpflich) → Erz
- **Erzschmelze** (Erz + Holzkohle) → Eisen
- **Werkzeugschmiede** (Eisen + Holz) → Werkzeug

**Nahrung** (eine Ware, viele Quellen)
- **Fischerhütte** (am Wasser) → Nahrung
- **Jagdhütte** (Wald) → Nahrung
- **Schweinezucht** (Weide) → Schweine → **Fleischerei** → Nahrung (ergiebig; ersetzt die Rinderfarm des Originals)
- **Getreidefarm** (fruchtbarer Boden) → Getreide → **Mühle** → Mehl → **Bäckerei** → Nahrung (ergiebig)

**Alkohol** (eine Sammel-Ware: Bier, Rum und Wein zählen gleich)
- **Getreidefarm** → Getreide → **Brauerei** → Bier *(Abwandlung, siehe Abschnitt 9)*
- **Zuckerrohrplantage** (Süden) → Zuckerrohr → **Rumbrennerei** → Rum
- **Weingut** (Norden) → Trauben → **Weinkelter** → Wein

**Stoffe und Kleidung**
- **Schaffarm** → Wolle, oder **Baumwollplantage** (Süden) → Baumwolle
- **Weberei** (Wolle oder Baumwolle) → Stoffe
- **Schneider** (Stoffe) → Kleidung

**Genuss und Luxus**
- **Tabakplantage** (Süden) → Tabak → **Tabakwarenfabrik** → Tabakwaren
- **Gewürzplantage** (Süden) → Gewürze
- **Kakaoplantage** (Süden) → Kakao
- **Goldmine** (am Berg, selten) → Gold → **Goldschmied** → Schmuck

**Waffen**
- **Schwertschmiede** (Eisen) → Schwerter
- **Musketenbauer** (Eisen + Holz) → Musketen
- **Kanonengießerei** (Eisen + Holzkohle) → Kanonen

Waffen sind keine Bewohner-Bedürfnisse, sondern Rüstzeug für Burg und Werft (Abschnitt 7).

---

## 4. Gebäude nach Kategorien

Größe in Feldern (Breite × Tiefe). Freischaltung: „Start“ oder die Zahl der Einwohner einer Stufe (oder höher) in der Siedlung. Alle Schwellen sind **(eigene Festlegung)** auf Basis grober Werte.

| Kategorie | Gebäude (Größe) | Freischaltung |
|---|---|---|
| **Wohnen** | Wohnhaus (2×2) | Start |
| **Öffentlich** | Marktplatz (3×3) | Start |
| | Kapelle (2×2) | Start |
| | Wirtshaus (2×2) | 20 Siedler |
| | Feuerwache (2×2), Arzt (2×2) | 50 Siedler |
| | Kirche (3×3), Schule (3×3) | 100 Bürger |
| | Badehaus (3×3), Theater (4×4), Hochschule (4×4) | 50 / 150 / 250 Kaufleute |
| **Nahrung** | Fischerhütte (2×2), Jagdhütte (2×2) | Start |
| | Schweinezucht (3×3), Fleischerei (2×2), Getreidefarm (3×3), Mühle (2×2), Bäckerei (2×2) | 50 Siedler |
| **Rohstoffe** | Holzfäller (2×2) | Start |
| | Steinbruch (2×2) | 50 Pioniere |
| | Schaffarm (3×3) | 30 Pioniere |
| | Erzmine (2×2) | 120 Siedler |
| | Goldmine (2×2) | 200 Bürger |
| | Tiefe Erzmine (3×3) | 250 Kaufleute |
| | Plantagen: Zuckerrohr, Wein, Tabak, Gewürze, Kakao, Baumwolle (je 3×3) | 50 Siedler, Boden muss passen |
| **Werkstätten** | Weberei (2×2), Brauerei (2×2) | 30 Pioniere / 50 Siedler |
| | Steinmetz (2×2) | 50 Pioniere |
| | Köhlerei (2×2), Erzschmelze (2×2) | 120 Siedler |
| | Werkzeugschmiede (2×2) | 100 Siedler |
| | Rumbrennerei, Weinkelter, Tabakwarenfabrik, Schneider (je 2×2) | 50 Bürger |
| | Goldschmied (2×2) | 100 Kaufleute |
| **Hafen** | Kontor (3×3, nicht baubar, wird per Schiff gegründet) | Start |
| | Kleine Werft (3×4) | 120 Siedler |
| | Große Werft (4×5) | 500 Kaufleute |
| **Militär** | Wachturm (1×1), Mauer und Torhaus (1×1) | 150 Siedler |
| | Schwertschmiede (2×2) | 100 Bürger |
| | Burg (4×4) | 200 Bürger |
| | Kanonengießerei (3×3) | 250 Kaufleute |
| | Musketenbauer (2×2) | 500 Kaufleute |
| **Wege** | Feldweg (1×1) | Start |

Dazu gelten die Regeln aus den Anforderungen: Betriebe brauchen einen Weg zum Kontor oder Marktplatz, bauen darf man nur im Einflussbereich von Kontor oder Marktplatz.

---

## 5. Inseln und Rohstoffe

- **Zufällige Inseln** in drei Größen (klein, mittel, groß), verteilt über ein Meer mit mehreren Gruppen.
- **Nordinseln** (gemäßigt): guter Boden für Getreide, Wein und Schafe, viel Wald, selten Gold.
- **Südinseln** (tropisch): Zuckerrohr, Tabak, Gewürze, Kakao, Baumwolle; Getreide wächst nur mäßig.
- **Fruchtbarkeit:** Jede Insel hat pro Pflanze die Stufe gut, mäßig oder ungeeignet. Auf ungeeignetem Boden lässt sich die Pflanze nicht anbauen. Ein Warnhinweis erscheint schon beim Platzieren.
- **Berge:** Stein gibt es fast überall und er geht nicht aus. **Erz** ist erschöpfbar (jede Ader hat einen Vorrat). Dann hilft die **tiefe Erzmine**. **Gold** ist selten, meist auf kleinen Inseln, und ebenfalls erschöpfbar.
- **Ureinwohner:** Auf manchen Inseln leben sie in Dörfern. Sie sind friedlich, tauschen Waren (z. B. Gold oder Gewürze gegen Werkzeug oder Stoffe) und teilen die Insel mit dir. Ein Angriff auf sie ist möglich, bringt aber Strafen im Ansehen **(eigene Festlegung)**.

---

## 6. Schiffe, Handel, Piraten, Computergegner, Diplomatie

**Schiffe** (Namen eigen, kommen aus den Werften):

| Schiff | Aufgabe | Werft |
|---|---|---|
| Kutter | kleines Frachtschiff, Entdecker | Kleine Werft |
| Kogge | mittleres Frachtschiff | Kleine Werft |
| Karacke | großes Frachtschiff | Große Werft |
| Schaluppe | kleines Kriegsschiff | Kleine Werft |
| Galeone | großes Kriegsschiff mit vielen Kanonen | Große Werft |

Schiffe brauchen Holz, Stoffe (Segel) und Werkzeug, Kriegsschiffe zusätzlich Kanonen. Wind und Küstennähe wirken sich auf die Fahrt aus.

**Neue Inseln:** Ein Schiff mit Holz und Werkzeug gründet dort ein Kontor. Danach kann man bauen wie auf der Startinsel. Das Lager der Inseln ist getrennt; Waren werden per Schiff befördert.

**Handel:** Schiffe fahren auf festen **Handelsrouten** zwischen Kontoren (Beladen und Entladen einstellbar). **Freie Händler** laufen die Küsten an und tauschen Waren gegen Taler; Preise schwanken leicht. Ureinwohner handeln wie oben.

**Piraten:** Sie greifen Handelsschiffe an und plündern Küsten. Man kann sie abwehren oder **bestechen** (sie ziehen gegen Taler ab, ein weiterer Angriff bleibt möglich).

**Computergegner:** Ein bis drei Gegner (Anführer mit eigenen Namen) bauen eigene Städte und Flotten. Sie kämpfen wie du, sind aber auf Wunsch einstellbar (leicht, mittel, schwer).

**Diplomatie:** Pro Gegner drei Zustände: Krieg, Frieden, Handelsvertrag. Geschenke verbessern die Laune, Grenzverletzungen verschlechtern sie. Eine Kriegserklärung ist jederzeit möglich. Sieg: Gegner besiegen oder einen Wohlstandswert erreichen **(eigene Festlegung)**.

---

## 7. Militär und Kampf

Kampf ist Kernbestandteil und wird für den Finger entworfen: **wenige Befehle, Pause jederzeit möglich.**

**Einheiten** (immer als Trupp von etwa 6 Mann bzw. einer Kanone, damit man nicht Einzelne tippen muss):

| Einheit | Stärke | Schwäche |
|---|---|---|
| Schwertkämpfer | stark im Nahkampf, besiegt Kanonen | langsam gegen Musketen |
| Musketiere | Fernkampf, besiegen Schwertkämpfer | schwach im Nahkampf, verlieren gegen Reiter |
| Reiter | schnell, jagen Musketiere | verlieren gegen Schwertkämpfer |
| Kanonen | zerstören Gebäude und Mauern | ungeschützt, langsam |

Alles kostet einmalig Waffen und Taler und dann Unterhalt je Minute.

**Gebäude:** *Burg* bildet Truppen aus (Schwerter, Musketen, Pferde, Kanonen kommen aus den Werkstätten). *Wachturm* beschießt Feinde in Reichweite. *Mauer und Torhaus* lenken den Gegner. Alles lässt sich beschädigen und reparieren.

**Bedienung:**
1. Einen Trupp antippen, oder mit dem Finger einen Rahmen aufziehen für mehrere.
2. Auf ein Ziel tippen: Gehen, Angreifen oder Verteidigen (Knopfleiste am Rand).
3. Die Gefechte laufen automatisch. Der Spieler lenkt Aufstellung, Ziel und Rückzug.

**Seeschlacht:** Schiff antippen, Gegner antippen. Kanonen feuern automatisch bei richtiger Lage (Breitseite), Wind und Position entscheiden. Beschädigte Schiffe lassen sich im Hafen reparieren.

**Eroberung:** Truppen werden per Schiff an Land gesetzt. Ziel ist das **gegnerische Kontor**: Fällt es, geht die Insel samt Gebäuden an den Sieger über. Die Bevölkerung ist zunächst unzufrieden. Wer sein eigenes Kontor verliert, verliert die Insel. Verteidigen heißt: Türme, Mauern, Truppen und Schiffe vor der Küste.

---

## 8. Sonstiges

- **Steuersatz** einstellbar je Stufe (niedrig, normal, hoch). Hohe Steuern bringen Geld, senken aber die Zufriedenheit.
- **Feuer:** kann in Häusern ausbrechen. Eine Feuerwache in Reichweite löscht, sonst brennt es weiter und greift über.
- **Pest:** bricht in großen, dichten Städten aus. Ein Arzt in Reichweite heilt, später schützt das Badehaus.
- **Ereignisse:** Sturm (Schiffe beschädigt), Piratenüberfall, Dürre (Ernte schlechter), Besuch freier Händler. Ereignisse lassen sich in den Einstellungen abmildern oder abschalten **(eigene Festlegung)**.
- **Zufriedenheit** und **Aufgaben-Liste** (Anleitung mit Belohnungen) bleiben wie in den Anforderungen.

---

## 9. Etappenplan (jede Etappe ist spielbar)

| Etappe | Inhalt | Spielbar, weil … |
|---|---|---|
| **1** | **Eine Insel:** Pioniere bis Bürger. Nahrung (Fischer, Jäger, Schweinezucht+Fleischerei, Mühle+Bäckerei), Stoffe (Schaf+Weberei), Stein, Erz, Werkzeug (Erz+Holz direkt in der Schmiede, wie im Code), **Bier statt Alkohol**, Steuern, Feuer und Arzt. Baustoff „Stein“ zählt wie Ziegel. | Man kann die Insel voll ausbauen und bis Bürger spielen. |
| **2** | **Schiffe und neue Inseln:** Kleine Werft, Kontor gründen, Südinseln mit Tabak, Gewürzen, Zuckerrohr, Kakao, Baumwolle; Steinmetz (echter Ziegel), Köhlerei, Erzschmelze, Rumbrennerei; **Kaufleute**; Ureinwohner. Entdecken, Aufbau auf mehreren Inseln. | Ohne Gegner, aber mit echtem Ziel: die Kaufleute-Stadt versorgen. |
| **3** | **Kampf:** Piraten (inkl. Bestechen), Burg, Türme, Waffenwerkstätten, Truppen, Seeschlachten, Computergegner, Diplomatie. | Man kann Gegner besiegen oder sich verteidigen. |
| **4** | **Handel und Spitze:** Handelsrouten, freie Händler, **Aristokraten**, Schmuck (Gold), Kleidung, Theater, Hochschule, Badehaus, Große Werft, Musketen, tiefe Erzmine. | Das Spiel ist vollständig. |

**Zum Bier:** Im Code wünschen sich Bürger „Bier“ (Getreide → Brauerei), weil Zuckerrohr oder Wein nur auf anderen Inseln wachsen. Das ist eine **Abwandlung**. Ab Etappe 2 gilt: Bedürfnis heißt allgemein „Alkohol“, Bier, Rum und Wein zählen alle. Damit bleibt die Startinsel selbstständig und die späteren Quellen fügen sich ohne Umbau ein. Besser wäre sonst nur, die Bürger-Stufe erst mit Etappe 2 zu öffnen; das würde Etappe 1 aber kürzer und weniger spannend machen.

---

## 10. Abwandlungen gegenüber dem Original

| Abwandlung | Begründung |
|---|---|
| Bier (Brauerei) als zusätzliche Alkohol-Quelle | Startinsel soll bis Bürger tragen, ohne fremde Pflanzen. |
| Schweinezucht statt Rinderfarm (Schweine → Fleischerei → Nahrung) | Wunsch des Nutzers; gleiche Kette wie im Original, nur mit Schweinen. |
| Trupps statt Einzelfiguren | Finger-Bedienung: weniger Tippen, weniger Fehler. |
| Waffen und Schiffsnamen eigen | Rechtlich sauber, keine Namen aus dem Original. |
| Werkzeug in Etappe 1 ohne Erzschmelze | Kürzere Ketten am Anfang; Schmelze und Köhlerei kommen in Etappe 2 dazu. |
| Stein zählt in Etappe 1 als Ziegel | Gleicher Spielinhalt, weniger Gebäude am Anfang. |
| Sammel-Bedürfnis „Alkohol“ | Gleiche Idee wie „Nahrung“, mehrere Wege zum selben Ziel. |
| Eigene Zahlen (Steuern, Schwellen, Verbrauch) | Eigenes Balancing, Feinschliff beim Testen. |
| Pausierbare Echtzeit, einstellbare Ereignisse | Gemütliches Spielen auf dem Handy, kein Zwang. |
| Ureinwohner friedlich, Ansehensstrafe bei Angriff | Eigenes Konzept, klare Regeln. |
