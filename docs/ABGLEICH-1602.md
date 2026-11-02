# Abgleich mit 1602: „Neue Ufer“, Stand 31.10.2026, Tabellen nachgeführt am 2.11.2026

*Alle 210 Einzelbefunde mit Belegen und Umsetzungsvorschlägen stehen in `docs/recherche/abgleich-befunde.json` (eine Fachliste für die Umsetzung, du musst sie nicht lesen). Die Umsetzung läuft in Arbeitspaketen (siehe Abschnitt 5 „So geht es weiter“ und docs/OFFEN.md).*

**Zeichen in den Tabellen:** ✅ wie in 1602 · 🟡 anders oder nur teilweise · ❌ fehlt · ⭐ besser als 1602 · **Fehler** = funktioniert nicht richtig

**Grundlage:** die Inhaltsliste von 1602 (docs/1602-INHALT.md mit den Recherchen), der Programmcode und viele Tests: Simulationen über mehrere Spielstunden, Hunderte Zufallswelten und Browser-Tests im iPhone-Querformat (852 × 393 Punkte, mit Touch). Was bewusst anders gemacht wurde, zählt nicht als Mangel: Schweinezucht statt Rinderfarm und Steine statt Ziegel (dein Wunsch) sowie eine Weberei, die Brauerei und das schnellere Spiel (unsere Vereinfachungen).

**Stand der Unterlagen:** Der Abgleich wurde am Spielstand vom 31.10.2026 (vor der ersten Umsetzungswelle) gemacht. **Am 2.11.2026 wurden alle Tabellen und die Prozentwerte gegen den Programmcode nachgeprüft** (Belege in Klammern: Datei und Zeile). Was seitdem erledigt ist, steht mit dem Vermerk „behoben“ und dem Paketnamen (L1, L2, S1, S2, M1, KI1, P1, G3, R1, R2, U1; die Kürzel sind in Abschnitt 5 erklärt) in den Tabellen. Wichtig zum Lesen: Bei Statistik, Meldungsverlauf, Schiffsliste, Punktewertung und Ureinwohnern ist die Berechnung im Hintergrund teils schon da, das Fenster dazu aber noch leer. Das zählt hier als „fehlt“, weil der Spieler noch nichts davon sieht.

---

## 1. Kurzfazit

**Passt schon alles 1:1? Noch nicht.**

- **Die Zahlen stimmen sehr gut.** Bei allem, was schon im Spiel ist, stimmen Kosten, Unterhalt, Reichweiten, Freischaltungen, Kampfwerte, Schiffe und Preise zu über 90 % mit dem Original überein; der Verbrauch ist bewusst etwa 8-mal so schnell.
- **Der Spielablauf ist zu gut zwei Dritteln da.** Steuerregler, Bankrott, Hunger, Händlerschiffe und Handelsrouten gibt es inzwischen. Es fehlen vor allem ganze Bereiche (Ureinwohner, Katastrophen, Prachtbauten, Endwertung, sichtbare Felder) und die Fenster zur Übersicht (Statistik, Meldungsverlauf, Schiffsliste). Die Computergegner sind noch schwach.
- **Die Grafik ist gemischt, aber deutlich besser als beim Abgleich.** Landschaft, Wasser, Wege, Bäume und Kampf sind schon schöner als in 1602; Schornsteine rauchen, Neubauten wachsen aus dem Boden. 34 Gebäudearten stehen als realistische Meshy-Modelle im Spiel, die übrigen Gebäude sind noch einfacher. Es fehlen sichtbare Bewohner und Felder, und Kontor I–IV sehen noch gleich aus.

| Bereich | Nähe zu 1602 (Schätzung) | Warum |
|---|---|---|
| Spielumfang & Inhalt | ≈ 65 % | Stufen, Waren, Ketten, Gebäudezahlen, Schiffe und Militär sind 1:1 da. Es fehlen Ureinwohner, Katastrophen (Feuerwehr, Arzt, Galgen sind nur vorbereitet), Prachtbauten, Endwertung und Szenarien. |
| Wirtschaft | ≈ 75 % | Steuerregler je Stufe, Bankrott, Hunger mit Auszug, Abstieg der Häuser, Unterhalt im Betrieb und in Ruhe, schnelleres Wirtschaftstempo, Händlerschiff mit Aufträgen und Handelsrouten sind da (L2, S2). Es fehlen sichtbare Felder, der Förster, Anlieferung der Rohstoffe mit Karren und Handel mit den Computergegnern. |
| Krieg | ≈ 70 % | Kampfwerte, Eroberung, Tore im Wegenetz, weiße Flagge, Aufstellung, Heilung beim Arzt (Regeln) und Blockade des Händlers sind da (L1, M1). Es fehlen Feuer und Feuerwehr, ein baubarer Arzt, das Piratennest und die Bedienung für Reihe, Ausmustern und Bäume fällen. Die Gegner sind noch kaum eine Bedrohung. |
| Bedienoberfläche | ≈ 65 % | Die Infos sind klarer als in 1602; Steuerregler im Haus- und Kontorfenster, Reiter „Handel“, zweispaltiges Baumenü und Spielstände sind da. Die Fenster für Statistik, Meldungsverlauf und Schiffsliste sind noch leer, die dauernd sichtbare Übersichtskarte fehlt (es gibt nur die Weltkarte als eigenes Fenster). |
| Bedienung auf dem Handy (gemessen am Ziel) | ≈ 75 % | Gute Grundlage: Knöpfe unten erreichbar und mindestens 44 px, Zoom-Knöpfe und Kompass, Gesten, Hochformat-Pause, Schiff-auf-Land, antippbare Soldaten (alles seit U1/L1/G3). Es gibt noch kein Rückgängig (Regel steht, Knopf fehlt) und kein Symbol für den Home-Bildschirm. Noch nicht auf einem echten iPhone ausprobiert. |
| Grafik & Details (Ziel: schöner als 1602) | ≈ 55 % | Landschaft, Wasser, Wege, Bäume, Kampf und Auswahl-Zeichen ⭐. Schornsteine rauchen, Neubauten wachsen aus dem Boden. 34 Gebäudearten und 2 Schiffe sind realistische Meshy-Modelle; die übrigen Gebäude haben noch einfache Code-Modelle. Es fehlen Kontor I–IV als eigene Formen, Bewohner in der Stadt, sichtbare Felder und Katastrophen. |
| Geschwindigkeit des Spiels (Performance, gemessen am Ziel) | ≈ 70 % | Die Spielrechnung ist sehr sparsam. Seit R1/R2 wird nur Sichtbares gezeichnet, die Qualität passt sich dem Gerät an, die Grafik wird beim Start vorbereitet, Gegner und Wegsuche rechnen versetzt. Noch nie auf einem echten iPhone gemessen; bei einer großen Stadt mit vielen Meshy-Gebäuden bleibt das Risiko. |
| Übersicht & Spielfluss | ≈ 55 % | Infos zu einzelnen Gebäuden ⭐, Warnungen mit Ring nach Dringlichkeit, Meldungen bei Mangel, Hunger und Minus, mehrere Spielstände, Fenster „Neues Spiel“ mit Schwierigkeit. Das Gesamtbild fehlt noch: Statistik-Fenster, Meldungsverlauf, Übersichtskarte, Liste der Schiffe und Inseln, Ziele parallel. |
| Inselwelt, Computergegner, Ereignisse | ≈ 35 % | Die zufällige Inselwelt wird sehr verlässlich erzeugt. Die Wirtschaft der Gegner läuft seit KI1; sie bleiben aber klein, handeln nicht und wachsen nicht über die Siedler hinaus (KI2). Ureinwohner und alle Katastrophen fehlen (Gerüste ohne Wirkung). |
| **Gesamt** | **≈ 63 %** | Durchschnitt der neun Werte, gerundet (Stand 2.11.2026, vorher ≈ 55 %). „Handy“, „Grafik“ und „Leistung“ messen am Ziel des Projekts, nicht an 1602. |

Die Prozente sind eine grobe Schätzung: Wie viel vom Spielgefühl von 1602 ist in diesem Bereich schon da? Wichtige Punkte zählen mehr. Am 2.11.2026 wurden sie vorsichtig neu geschätzt, nachdem alle Tabellenzeilen gegen den Programmcode geprüft waren. Zählt man nur die Tabellenzeilen aus Abschnitt 2 (✅ und ⭐ voll, 🟡 halb, ❌ null), kommen zwischen 47 % und 92 % heraus (Spielumfang 53, Wirtschaft 84, Krieg 76, Oberfläche 73, Handy 89, Grafik 66, Leistung 92, Übersicht 59, Inselwelt 47). Bei Wirtschaft, Handy und Leistung liegt die Zeilenzählung deutlich über der Schätzung, weil die Zeilen nur Einzelpunkte zählen: Sichtbare Felder, Anlieferung der Rohstoffe und der Test auf dem iPhone fehlen noch und wiegen schwerer. Bei „Handy“ und „Leistung“ ist die Schätzung besonders unsicher, weil das Spiel noch nie auf einem iPhone getestet wurde.

> **Dein Beispiel: Schiff auf eine Insel tippen.** Beim Abgleich fuhr das Schiff bei einem Tipp auf Land an die Küste, aber nicht ganz so, wie du es willst (so war es beim Abgleich):
> - Es fährt zum Küstenwasser, das dem angetippten Punkt am nächsten liegt. Tippst du mitten auf eine Insel, kann es deshalb um die halbe Insel fahren.
> - Tippst du auf ein eigenes Gebäude, wird das Gebäude ausgewählt, statt hinzusegeln.
> - Führt zu diesem Punkt kein Weg, bleibt das Schiff stehen oder fährt auf dem alten Kurs weiter, und eine Meldung erscheint.
> - Im Nebel verrät die Meldung „Kurs zur Küste“, dass dort Land ist.
>
> **Behoben (Arbeitspakete L1 und U1, die Kürzel sind in Abschnitt 5 erklärt):** Das Schiff fährt in Tipp-Richtung, so weit es kommt, und hält an der zugewandten Küste. Nur wenn das nicht geht, sucht es einen nahen Küstenplatz; „kein Weg“ gibt es nur, wenn es sich gar nicht bewegen kann. Tippst du auf ein eigenes Gebäude, segelt das Schiff hin (am Kontor in Ladereichweite); ein zweiter Tipp zeigt die Gebäude-Info. Im Nebel behandelt die Wegsuche Unentdecktes als Wasser und plant neu, sobald Land auftaucht. Das Verhalten ist jetzt als Anforderung festgeschrieben (ANFORDERUNGEN.md, B-Schiff). Noch nicht auf dem iPhone ausprobiert.

**Schon besser als 1602:** Rohstoffe, die sichtbar nachwachsen. Klare Info-Fenster („was fehlt und warum“). Wege per Tippen mit automatischem Umweg. Eine faire Vorwarnung vor Kriegen. Weiterspielen nach einer Niederlage. Landschaft, Wasser und Kampfgrafik.

**Ehrlicher Hinweis:** Alle Zeiten wurden auf einem PC gemessen, mit Ersatz-Grafik. Auf dem iPhone werden die Rechnungen voraussichtlich etwa 2- bis 3-mal so lange dauern (geschätzt, nicht gemessen). Ein Test auf deinem iPhone fehlt noch.

---

## 2. Punkt für Punkt

### 2.1 Spielumfang & Inhalt

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Fünf Bevölkerungsstufen | Pioniere bis Aristokraten; je Stufe sind Waren und Gebäude Bedingung | gleich; Bedingungen und Schwellen gelten wie im Original je Insel | ✅ |
| Waren | 23 Waren | alle 23 | ✅ |
| Verbrauch | Werte des Originals | Original × 8, gerundet (das Spiel läuft schneller) | ✅ bewusst schneller |
| Zahlen der Gebäude | rund 60 Gebäude mit Kosten, Unterhalt, Reichweite, Freischaltung | 52 Gebäudearten (ohne Wege), fast alle mit genau diesen Zahlen. Seit L2 stimmen auch Kapelle (Reichweite 8), Jagdhütte (Reichweite 8), Steinbruch (ohne Unterhalt) und Fleischerei (10 Steine) mit dem Original überein (data.ts:136, 154, 159, 171). Übrig: Holzfäller und Schaffarm arbeiten in einem Umkreis von 4 statt 3 Feldern (data.ts:168, 173); die Jagdhütte lagert bewusst 6 t statt 3 t | 🟡 fast gleich (Kanonengießerei ab 400 Bürgern, Stadttor 4 Steine, kleines Tor: behoben in L1) |
| Grundfläche der Gebäude | viele Gebäude länglich (z. B. Marktplatz 4 × 3); das Wohnhaus belegt vermutlich nur 1 Feld (Quelle unsicher) | alle Gebäude quadratisch, Wohnhaus 2 × 2. Falls das Original 1 Feld hat, versorgen Kapelle & Co. nur ein Viertel so viele Häuser. Recherche-Ergebnis (D1): siehe Abschnitt 2.1a | 🟡 offen, Vorgabe für L5 steht in 2.1a |
| Freischalt-Reihenfolge | 30 Pioniere bis 600 Aristokraten | gleich | ✅ |
| Schiffe | 5 Typen, Laderaum, Kanonen, höchstens 20 | gleich (auch im Original erlaubt jeder Triumphbogen ein Schiff mehr). Beschädigte Schiffe fahren langsamer (L1) | ✅ |
| Kontor I–IV | 30 / 50 / 75 / 100 t Lager | gleich | ✅ |
| Feuerwehr, Arzt, Galgen | Schutz gegen Feuer, Pest und Verbrechen | als Gebäude mit Kosten und Reichweite vorbereitet, aber noch nicht baubar und ohne Wirkung (data.ts:248–252, events.ts ist ein leeres Gerüst); kommen zusammen mit den Katastrophen (siehe 2.9) | ❌ |
| Prachtbauten | Palast, Kathedrale, Denkmal, Zierbaum | Palast, Kathedrale, Denkmal und Zierbaum sind in der Datentabelle vorbereitet, aber noch nicht baubar (data.ts:255–261); nach dem Theater haben Aristokraten kaum noch Ziele | ❌ |
| Plätze, Brücken, Anlegesteg | Plätze I–III, Holz- und Steinbrücken über Flüsse, Steg | fehlen; nur Feldweg und Pflasterweg, keine Flüsse | ❌ |
| Ureinwohner | Dörfer, Tauschhandel, Fluch | Hütte und Häuptlingshütte sind nur vorbereitet (data.ts:264–266); natives.ts und das Fenster dazu sind leere Gerüste: keine Dörfer, kein Tausch (siehe 2.9) | ❌ |
| Punkte und Endwertung | Punkte für Einwohner, Kasse und Siege; Endwertung | score.ts ist ein leeres Gerüst (0 Punkte, nur das Ziel „Endlos“); ein Sieg beendet das Spiel nicht, er schaltet nur den Triumphbogen frei | ❌ |
| Szenarien | 26 Szenarien (+20 in der Erweiterung) | keine; nur das freie Spiel mit 24 Aufgaben | ❌ |
| Mehrspieler, Karteneditor | ja (Editor in der Erweiterung) | fehlen vorerst; jetzt als bewusste Abweichung in 1602-INHALT.md (Abschnitt 12) eingetragen | ❌ (bewusst) |
| Rohstoffe wachsen nach | Wald nur über den Förster, Bestände unsichtbar | Bäume, Fische und Wild verbrauchen sich sichtbar und wachsen nach (Weideland und Ackerland als getrennte Bestände, aber unsichtbar; die Skala beim Bauen zeigt sie); Nachbarn teilen sich den Rohstoff; beim Bauen zeigt eine Skala die Ergiebigkeit | ⭐ |
| Hilfe für Einsteiger | Handbuch | 24 Aufgaben mit Belohnung führen durch alle Ketten | ⭐ |

#### 2.1a Grundflächen: was die Recherche (Paket D1) ergeben hat

*Frage:* Wie groß ist das Wohnhaus im Original, und gibt es dort längliche Grundflächen?

- **Wohnhaus:** Die gesammelten Quellen (`docs/recherche/quelle-a-kolonie-wirtschaft.md`, Abschnitt 3.2) geben für alle fünf Haustypen „1 × 1 (abgeleitet)“ an. Die Zahl stammt aus Stadtplänen von Fans, in denen Häuser als Einzelquadrate gezeichnet sind, nicht aus den Spieldaten. Dieselbe Quelle sagt, dass Fans Häuserblöcke als 2 × 2, 3 × 2 oder 4 × 2 Häuser anlegen. Ein Fan-Tipp (PC Games) nennt Straßenquadrate mit 6 × 6 Feldern Innenfläche für acht Wohnhäuser; das passt zu einem Wohnhaus von 1 Feld nicht eindeutig. **Ergebnis: Die Quellen sprechen eher für 1 × 1, bewiesen ist es nicht.** Die Spieldaten selbst (Gebäudedatei oder Karteneditor) konnten wir nicht einsehen.
- **Längliche Grundflächen:** Im Original sind viele öffentliche Gebäude länglich: Marktplatz 4 × 3, Kapelle 2 × 1 (oder 3 × 4, die Quellen widersprechen sich), Wirtshaus 3 × 2, Kirche 4 × 3, Badehaus 4 × 3, Kontor 2 × 3, Kathedrale 6 × 4, Palast 5 × 7, Triumphbogen 1 × 3 (Zahlen in `docs/1602-INHALT.md`, Abschnitt 5). In Neue Ufer sind alle Gebäude quadratisch (`size` in `src/data.ts`), das Wohnhaus ist 2 × 2.
- **Vorgabe für Paket L5 (und ein mögliches Folgepaket):**
  1. Das Wohnhaus bleibt vorerst 2 × 2. Vier Mal so viele Häuser auf derselben Fläche würden die Zeichenlast und die Rechenzeit stark erhöhen, und die Bewohnerzahlen je Haus (3/7/15/25/40) sind schon auf das größere Haus eingestellt. L5 prüft stattdessen, wie viele Häuser eine Kapelle (Reichweite 8 bis 9) abdeckt und wie viele Einwohner das im Vergleich zum Original sind, und gleicht notfalls die Reichweiten an.
  2. Länglich sind nur Gebäude, deren Maße in den Quellen übereinstimmen (Marktplatz 4 × 3, Kirche 4 × 3, Badehaus 4 × 3, Wirtshaus 3 × 2, Kontor 2 × 3). Dafür braucht das Spiel Breite und Tiefe getrennt statt einer Zahl und einen Knopf zum Drehen beim Bauen. Das ist ein eigenes Folgepaket, das erst nach der Entscheidung des Nutzers beginnt (nicht eilig: es ändert die Form der Siedlung, nicht die Wirtschaft).
  3. Bevor das umgesetzt wird, sollten die Maße an einer zweiten Quelle bestätigt werden (z. B. dem Gebäudedaten-Anhang „Building and Industry Data“ der Fan-Handbücher; er war in unserer Recherche nicht verfügbar).

### 2.2 Wirtschaft: Zufriedenheit, Steuern, Bilanz, Kosten, Handel

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Steuersatz | je Stufe einstellbar (Höchstsätze 48 % bis 35 %), Gesichter zeigen die Stimmung; das wichtigste Werkzeug fürs Geld | Regler je Stufe im Haus- und Kontorfenster, Höchstsätze 48/45/38/36/35 %, Gesicht zeigt die Stimmung (L2) | ✅ behoben (L2) |
| Steuer je Einwohner | flach: ein Aristokrat zahlt etwa 1,4-mal so viel wie ein Pionier | flach wie im Original: 2,3 … 3,2 Taler je Bewohner, Aristokrat ≈ 1,4 × Pionier (L2) | ✅ behoben (L2) |
| Hunger und Unzufriedenheit | Hunger macht unzufrieden, Bewohner ziehen aus, das Haus verfällt | Hunger lässt alle Stufen ausziehen (Meldung mit Grund), Häuser steigen ab („Haus verfällt“) (L2) | ✅ behoben (L2) |
| Bankrott | lange tief im Minus (etwa −10 000 Taler): Spiel verloren | Warnungen ab −2 000 Talern, nach 10 Minuten unter −10 000 Bankrott mit Wahl „Schulden erlassen“ oder „Neues Spiel“ (L2) | ✅ behoben (L2) |
| Einwohner je Betrieb | z. B. Weberei-Kette 283, Weingut 167, Schneiderei 457 Einwohner | Bedarfsbetriebe beschleunigt: jeder versorgt 60–83 % der Bewohner des Originals (L2, Nachweis scripts/wirtschaft-sim.ts) | ✅ behoben (L2) |
| Unterhalt im Betrieb und in Ruhe, Betrieb abschalten | ja (z. B. Weingut 35 im Betrieb, 15 in Ruhe) | Unterhalt im Betrieb und in Ruhe mit den Werten des Originals, Knopf „💤 Ruhen lassen“ (L2) | ✅ behoben (L2) |
| Baumaterial an Bewohner sperren | Schalter am Kontor | Schalter im Kontorfenster (L2) | ✅ behoben (L2) |
| Lager voll | der Betrieb hält an, nichts geht verloren | war ein **Fehler** (Ware verschwand still): behoben in L1. Karren holen nichts mehr ab, wenn das Insellager voll ist, laden nur ab, was Platz hat, und der Betrieb meldet von selbst „Lager voll“ | ✅ behoben (L1) |
| Lager und Freischaltungen je Insel | ja | gleich | ✅ |
| Kosten für den Haus-Aufstieg | Tabelle | gleich | ✅ |
| Marktkarren | holen im Umkreis von 6 Feldern ums Kontor ab; Marktplätze nahe den Betrieben beschleunigen den Transport | sichtbare Karren, auf Pflaster schneller, holen nur in Abholweite (Kontor 8, Marktplatz 12 Felder) (L2) | ✅ behoben (L2) |
| Felder | einzeln um Farm oder Plantage angelegt (5 Taler), müssen reifen | Ackerland (Getreide, Plantagen) und Weideland (Schafe, Schweine) sind jetzt getrennte Bestände (game.ts:366–368, data.ts:158–193), aber weiterhin unsichtbar: jede freie Wiese im Arbeitsumkreis zählt sofort als reifes Feld bzw. als Weide (game.ts:486). Der Bau legt keine Felder an (keine 5 Taler je Feld), es gibt kein Feld-Werkzeug | 🟡 |
| Wald pflanzen | der Förster pflanzt neu | niemand pflanzt neuen Wald: gefällte Bäume wachsen zwar nach, aber Wald, den ein Gebäude oder Weg überbaut hat, kommt nie zurück (die Unterlagen behaupten fälschlich „gleicher Effekt“) | 🟡 |
| Rohstoffe zu den Werkstätten | Karren liefern an; der Weber holt die Wolle direkt beim Nachbarn | Rohstoffe „springen“ ohne Weg aus dem Lager in die Werkstatt; der Standort spielt keine Rolle | 🟡 |
| Erz | Vorkommen 80 oder 240 t; die tiefe Mine baut den Rest ab | die normale Mine stimmt; die tiefe Mine baut den Rest ab und endet bei 3 × der Startmenge, rund 15 % der Vorkommen sind unerschöpflich (L1; früher förderte sie endlos) | ✅ behoben (L1) |
| Wachstum | allmählich | Ein Haus steigt nur auf, wenn es voll ist, die Bewohner zu 85 % zufrieden sind, die Dienste in der Nähe stehen und die Aufstiegswaren mindestens 2 Minuten reichen (game.ts:2352–2368, seit L2); der Aufstieg selbst dauert dann nur 10 Sekunden. Dass eine volle Aristokratenvilla in unter 5 Minuten möglich ist, wurde nach L2 nicht neu gemessen | 🟡 |
| Freier Händler | kommt mit dem Schiff und handelt nach deinen Aufträgen (Ware, Menge, Preis); Zahl der Plätze je Kontorstufe; verkauft nur, was jemand hergestellt hat (Ausnahme: Werkzeug, Erz) | Händlerschiff kommt alle 3–6 Minuten und handelt nach Aufträgen je Kontor (Plätze je Kontorstufe), Sortiment wie im Original; Sofort-Handel nur noch als teurer Notbehelf (S2) | ✅ behoben (S2) |
| Handelsrouten | Schiffe fahren automatisch zwischen Kontoren | Routen mit 2–4 Halten im Schiffsfenster, Schiff fährt allein (S2); große Bedienung kommt mit U5 | ✅ behoben (S2) |
| Handel mit Computergegnern | direkt, günstiger als beim Händler; Handelsvertrag | fehlt; die Gegner kaufen und verkaufen nur über den alten Sofort-Handel. Im Handelsteil ist eine eigene Preisliste für einen späteren Handelsvertrag vorbereitet (trade.ts:318) | ❌ |
| Bilanz | Einnahmen und Ausgaben nach Arten | Das Kontorfenster zeigt Steuern, Unterhalt und Sold je Minute (info.ts:80–84). Das Kassenbuch nach Arten (Steuern je Stufe, Betriebe, Dienste, Militär, Handel) mit Verlauf wird im Hintergrund geführt (stats.ts, S1); das große Fenster dazu kommt mit U2 | 🟡 Logik da (S1) |
| Waren-Statistik | Erzeugung und Verbrauch je Ware | Erzeugung, Verbrauch und Reichweite je Ware und Insel werden berechnet, Warnungen bei Mangel (S1); das Fenster kommt mit U2 | 🟡 Logik da (S1) |
| Händlerpreise | Preistabelle | etwa 90 % davon, Kauf zu Verkauf etwa 3 : 2 | ✅ |
| Preis für Frieden und für Schutz vor Piraten (im Original nur beim Piraten-Schutz belegt) | richtet sich nach dem Vermögen | gleich | ✅ |
| Gewinn einer Aristokratenstadt | rechnerisch etwa ein Drittel | rechnerisch etwa ein Drittel | ✅ |
| Startgeld | 20 000 (leicht) bis 10 000 (schwer) | wählbar im Fenster „Neues Spiel“: 20 000 / 15 000 / 10 000 Taler (Standard normal), dazu die Belohnungen der Aufgaben (bei „schwer“ halbiert) (P1) | ✅ behoben (P1) |

### 2.3 Krieg und seine Auswirkungen

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Kampfwerte | Soldaten, Türme, Burgen, Schiffe | 1:1 übernommen | ✅ |
| Gefechte | der Turm schießt zuerst; ein Steinturm braucht etwa 8 Kanoniertreffer | passt im Test; zusätzlich gehen 15–25 % der Schüsse daneben (steht nicht in den Unterlagen) | ✅ |
| Deckung | Kanoniere und Musketiere schießen nicht durch Wald | gleich | ✅ |
| Seeschlacht, Truppentransport, Eroberung | fällt Kontor oder Marktplatz, wechselt die Insel den Besitzer | gleich und funktioniert (im Test fiel ein KI-Kontor samt 48 Gebäuden) | ✅ |
| Triumphbogen | nach einem Sieg | gleich (auch dort erlaubt jeder Bogen ein Schiff mehr) | ✅ |
| Computergegner im Krieg | bauen Burgen, Waffenketten und Flotten und greifen an | meist nur 2–4 Soldaten; Krieg frühestens nach 40 Minuten und erst 15 Minuten, nachdem du 200 Siedler hast (spätestens ab 90 Minuten), und nur bei klarer Überlegenheit; Angriffe sind selten | 🟡 schwach |
| Mauern und Tore | das Tor sitzt im Weg, Karren fahren hindurch | war ein **Fehler**: Das Tor trennte das Wegenetz und ließ sich nicht auf einen Weg setzen. Behoben in L1: eigene Tore gehören zum Wegenetz (fremde sperren), ein Tor darf auf einen eigenen Weg, das kleine Tor ist da (15 Taler, 3 Steine, ab 200 Siedlern), das Stadttor kostet 4 Steine | ✅ behoben (L1) |
| Kanonen setzen in Brand, Feuerwehr | ja | Kanonentreffer rufen das Anzünden schon auf (combat.ts:303), aber events.ts ist ein leeres Gerüst: kein Feuer, keine Feuerwehr, Flammen gibt es nur als Bild ohne Wirkung | ❌ |
| Arzt heilt Verwundete | ja | Spielregel da (M1, combat.ts:1352–1376): Soldaten heilen beim eigenen Arzt schnell und kosten dort keinen Sold, sonst nur ganz langsam. Der Arzt ist aber noch nicht baubar (data.ts:250, kommt mit den Katastrophen) | 🟡 |
| Piraten | Nest auf einer Insel (lässt sich zerstören), Bestechung gegen andere, Nahrung als Geschenk | Schiffe tauchen per Zufall auf und haben keine Heimat; man kann Schutz kaufen oder sie mit Kriegsschiffen und Türmen bekämpfen (3 versenkte Piratenschiffe bringen einen Triumphbogen), aber kein Nest zerstören und sie nicht bestechen | 🟡 |
| Weiße Flagge | friedliche Fahrt | Knopf im Schiffsfenster; Piraten und Gegner lassen das Schiff in Ruhe (M1) | ✅ behoben (M1) |
| Beschädigte Schiffe | fahren langsamer | fahren langsamer (bis zur halben Fahrt, L1) | ✅ behoben (L1) |
| Bäume fällen, Aufstellung | Soldaten roden die Schusslinie frei und stellen sich in einer Reihe auf | Spielregeln da (M1: fällen, Reihe/Block), Knöpfe kommen mit U4 | 🟡 |
| Mehrere Einheiten wählen | Rahmen aufziehen, Gruppen, Patrouille | nur der Knopf „+N in der Nähe“; Schiffe nur einzeln | 🟡 |
| Ausmustern | per Knopf | Spielregel da (M1, ohne Sold), Knopf kommt mit U4 | 🟡 |
| Diplomatie | Handels- und Friedensvertrag; Krieg aus einem Anlass (Siedeln auf fremder Insel, Blockade) | nur Krieg und Frieden; die Gegner erklären Krieg nach Zeit, Stärke und Zufall | 🟡 |
| Krieg und Handel | Blockaden stören den Handel | Ein bewaffnetes Feindschiff vor dem Kontor (Umkreis 10 Felder) hält den Händler fern, Routenschiffe warten dann und melden „Route blockiert“ (trade.ts:384); Waffen gibt es beim Händler nur knapp (10 t je Besuch) und zum dreifachen Preis (trade.ts:86) (S2) | ✅ behoben (S2) |
| Heer in der Bilanz | sichtbar | eigene Zeile „Sold der Soldaten“ in der Bilanz am Kontor, im Kassenbuch als Militär (L2, S1) | ✅ behoben (L2) |
| Gegner ohne Land | wird zum Piraten | sitzt für immer still herum und gilt nicht als besiegt | 🟡 |
| Vorwarnung vor Krieg | keine | 3 Minuten Vorwarnung mit Rat, was man bauen sollte | ⭐ |
| Nach dem Verlust von allem | Spiel verloren | neues Schiff und 40 Minuten Ruhe | ⭐ |

### 2.4 Bedienoberfläche im Vergleich zu 1602

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Baumenü | alle Kategorien und der Abriss-Hammer sind immer sichtbar | zeigt nur Nutzbares ⭐. Die Spalte war zu lang; seit U1 ist sie ab 8 Knöpfen zweispaltig (44 × 44, nur Symbol, Name oben im Baumenü), „Abreißen“ ist ein fester Knopf 💥 oben | ✅ behoben (U1) |
| Steuerfenster | Tipp auf ein Haus zeigt die Steuer der Stufe | Tipp auf ein Haus zeigt den Steuerregler der Stufe (L2) | ✅ behoben (L2) |
| Kontor- und Lagerfenster | getrennte Ansichten | Lager, Bilanz und Steuern zuerst, der Handel in einem eigenen Reiter „⚖️ Handel“ (L2, S2); feste Kopfzeile und Fußleiste | ✅ behoben (L2, S2) |
| Warenleiste oben | zeigt die wichtigen Werte | bis zu 23 Symbole (am Anfang nur die gerade nötigen) ohne Namen, nur 5–10 gleichzeitig sichtbar; seit U1 zeigt ein Verlauf am Rand das Weiterwischen an; leere Waren werden nicht rot | 🟡 |
| Schiff beladen | Laden je Ware, Routen | Einladen mit +10 / +50 / Max (U1), Ausladen nur „alles“ (jetzt ganz oben im Schiffsfenster) | 🟡 |
| Wohnhäuser bauen | ganze Wohnblöcke zügig | jedes Haus einzeln, 2 Tipps je Haus | 🟡 |
| Abreißen | einen Bereich aufziehen | Feld für Feld, Rückfrage bei jedem Gebäude | 🟡 |
| Kontor abreißen, Insel aufgeben | geht, wenn sonst nichts mehr auf der Insel steht | Knopf „💥 Kontor abreißen“, sobald sonst nichts mehr auf der Insel steht (L2) | ✅ behoben (L2) |
| Wege und Mauern | mit der Maus ziehen | Start, Ziel, ✓; mit automatischem Umweg und Kostenanzeige. Start und Ziel sind gelb markiert. Ist das Ziel nicht erreichbar, endet die Strecke am nächsten erreichbaren Feld; gibt es gar keinen Durchgang, wird nichts gebaut (keine Bruchstücke). Mauern lassen sich nicht über Wege setzen | ⭐ |
| Haus- und Betriebs-Info | Gesichter und Fragezeichen | sagt im Klartext, was fehlt und warum | ⭐ |
| Hinweis auf Freischaltungen | (im Handbuch) | Karte mit Vorhängeschloss 🔒 „ab N …“ ⭐, aber ohne deinen Stand („du hast 23“) und ohne „NEU“-Marke | 🟡 |
| Texte | – | Hilfe und Hinweise wurden in L1/U1 angepasst („Tippe Start und Ziel, dann ✓“, Hilfe in drei kurzen Karten, „Tippe aufs Meer oder auf eine Insel“); weitere Reste sind möglich | 🟡 größtenteils behoben |
| Bilder im Baumenü | Bilder der Gebäude | Emoji | 🟡 |

Statistik, Meldungen, Übersichtskarte, Schiffsliste und Spielstände stehen in 2.8.

### 2.5 Bedienung auf dem Handy

| Punkt | 1602 / Ziel | Neue Ufer | Status |
|---|---|---|---|
| Schiff: Tipp auf eine Insel (dein Beispiel) | „fährt in die Richtung, so weit es kann“ | beim Abgleich: fuhr an die Küste, die dem Tipp am nächsten lag (eventuell um die halbe Insel). Jetzt (L1/U1): Das Schiff folgt der Linie zum Tippunkt und hält an der zugewandten Küste; ein Tipp auf ein eigenes Gebäude schickt es hin; es gibt immer ein Ersatzziel; im Nebel verrät nichts, dass dort Land ist | ✅ behoben (L1/U1), nicht auf dem iPhone getestet |
| Kerbe (Notch) und Home-Balken | – | werden überall beachtet; im Hochformat erscheint ein Hinweis | ✅ |
| Wischen, Zoomen, Drehen | – | ein Finger schiebt (baut nie aus Versehen), zwei Finger zoomen und drehen ✅. Beim Abgleich wanderte der Zoom weg, schon eine kleine Fingerdrehung drehte die Karte, und die Karte glitt nach dem Wischen nicht nach. Seit U1: Der Zoom hält den Punkt zwischen den Fingern fest, gedreht wird erst ab 9°, die Karte gleitet weich nach, ein Doppeltipp zoomt eine Stufe näher | ✅ behoben (U1), nicht auf dem iPhone getestet |
| Wichtige Knöpfe erreichbar | alles ist sichtbar | „Alles ausladen“, „Los geht's“ und „Schließen“ der Weltkarte lagen unter dem Bildrand (nur durch Wischen im Fenster erreichbar, ohne Hinweis), ebenso Militär und Abreißen im Baumenü. Seit U1: Hauptknopf fest unten, ✕ oben rechts, „Alles ausladen“ ganz oben im Schiffsfenster, Abreißen als fester Knopf | ✅ behoben (U1) |
| Infofenster | am Rand | nahm ⅓ der Breite ein. Seit U1 schmaler (220–270 px), mit ▾ zum Einklappen, und die Kamera weicht bei jeder Auswahl sanft aus | ✅ behoben (U1) |
| Hinweisleiste beim Bauen | – | saß mittig unten und fing Fingertipps genau dort ab, wo man bauen will. Seit U1 sitzt sie oben unter der Leiste (nicht antippbar); unten rechts bleiben nur ✓ und ✕ (48 px); ein zweiter Tipp auf dieselbe Stelle baut erst nach 0,5 s | ✅ behoben (U1) |
| Größe von Knöpfen und Schrift | Apple empfiehlt 44 Punkte je Knopf | Beim Abgleich: Knöpfe 34–40, kleinste Schrift 10 px. Seit U1: Tippziele mindestens 44 px, kleinste Schrift 12 px, Geld und Einwohner sind echte Knöpfe | ✅ behoben (U1) |
| Rückgängig | (in 1602: Spielstand laden) | Die Spielregel steht (game.ts:1812, `undoBuild`: innerhalb von 10 Sekunden nach dem Bau, volle Erstattung, gerodeter Wald kommt zurück), aber es gibt noch keinen Knopf dazu (kommt mit U4); zweimal tippen baut weiter sofort | 🟡 Regel da, Knopf fehlt |
| Zoomen mit einer Hand | – | Seit U1: Knöpfe + / − und Kompass 🧭 (antippen = Norden oben, lang drücken = zum Kontor), Doppeltipp zoomt, Mausrad zoomt zum Zeiger | ✅ behoben (U1) |
| Hochformat | – | Im Hochformat erscheint der Hinweis „Bitte drehen“ und das Spiel hält an wie bei einem offenen Menü (main.ts:85–104, style.css:72) | ✅ behoben |
| Figuren antippen | – | Die Tippfläche ist mindestens 24 Bildpunkte groß, also fingerbreit (scene.ts:1241, citysigns.ts `tapRadius`); beim Herauszoomen (ab Abstand 45) trägt jeder eigene Soldat eine 28 Punkte große Marke zum Antippen (G3) | ✅ behoben (G3) |
| Start ohne Internet | – | früher Schriften von Google; seit U1 sind die Schriften eingebettet, das Spiel startet ohne Internet | ✅ behoben (U1) |
| Symbol auf dem Home-Bildschirm | – | fehlt | ❌ |
| Größe, Start, Hintergrund | – | Spiel ≈ 1,2 MB (beim Abgleich 887 KB, siehe 2.7), Start in etwa 2,5 s; speichert beim Verlassen; der Ton startet nach der ersten Berührung | ✅ |

### 2.6 Grafik und Details

*Dreiecke* sind die kleinen Flächen, aus denen ein 3D-Modell besteht. Mehr Dreiecke bedeuten mehr Details.

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Details der Gebäude | handgezeichnet, sehr detailreich | beim Abgleich einfache Formen aus Code (etwa 150 Dreiecke je Gebäude). **Seit 31.10.2026:** 34 Gebäudearten als realistische Meshy-Modelle mit echten Oberflächen (Wohnhäuser etwa 7 000 Dreiecke, Einzelgebäude bis etwa 30 000); 14 weitere Modelle waren unbrauchbar und kommen später neu (Liste in `docs/OFFEN.md`), dort gelten bis dahin die Code-Modelle | 🟡 besser, noch nicht vollständig |
| Jedes Gebäude erkennbar | ja | Kirche, Hochschule, Theater, Schule, Wirtshaus, Kapelle, Betriebe, Plantagen, Werkstätten, Werft, Türme und Burgen haben jetzt eigene Meshy-Modelle; Badehaus, Marktplatz und 12 weitere noch ein Code-Modell | 🟡 |
| Fünf Haustypen | 5 | fünf verschiedene Häuser (seit G1 im Code, seit 31.10.2026 als Meshy-Modelle) | ✅ |
| Kontor I–IV | sichtbar größer | sehen gleich aus: alle vier Stufen teilen sich dieselbe Form (render/models/index.ts:87); sichtbar ist nur das Gerüst beim Ausbau (G3) | ❌ |
| Stil (deine Regeln 2 und 6) | – | Bäume sind jetzt realistisch: Kronen aus vielen Blattbüscheln, Rinde, gefiederte Palmen (render/trees.ts). Gras hat Flecken und Halme, Wege Fahrspuren und Pflastersteine (siehe unten). Die Gebäude ohne Meshy-Modell sind noch aus einfachen, kantigen Formen („Low Poly“, also stark vereinfacht) | 🟡 |
| Rauchende Schornsteine | ja | Schornsteine rauchen nur, solange der Betrieb arbeitet bzw. jemand im Haus wohnt; je Art anders (dunkel und kräftig bei Erzschmelze und Schmieden, mittel bei Brauerei, Fleischerei, Wirtshaus, hell bei der Bäckerei, dünn beim Wohnhaus), nur nah an der Kamera, in der Pause ruhig; auch die Meshy-Modelle rauchen (render/citysigns.ts:93–112, scene.ts:1051–1066, G3) | ✅ behoben (G3) |
| Leben auf den Straßen | Marktkarren, Arbeiter, Tiere | Karren, Holzfäller, Jäger, Fischerboote und Tiere ✅ (Tiere laufen, bleiben stehen und grasen; Arbeiter gehen mit schwingenden Beinen; Karren, Boote und Schiffe gleiten ohne Sprünge); über großen Fischschwärmen kreisen Möwen (render/life.ts:7). Bewohner in der Stadt fehlen (in modernen Anno-Teilen sind es viele) | 🟡 |
| Man sieht, wer arbeitet | an vielen Betrieben | Die Mühle dreht sich nur, wenn sie arbeitet (läuft sanft an und aus: scene.ts:1076); Schornsteine rauchen nur bei Arbeit; Holzfäller, Jäger und Fischer sind sichtbar unterwegs, Schafe und Schweine laufen im Hof. Bei den anderen Betrieben sieht man keine Arbeiter | 🟡 |
| Felder und Weiden | sichtbar, wachsen und werden geerntet | unsichtbar (nur farbige Streifen am Hof) | ❌ |
| Bauen | das Gebäude steht sofort (soweit bekannt) | Ein Neubau wächst in 1,3 s aus dem Boden (Staub, Hammerschläge, die Fahne erst danach); Aufstieg und Kontor-Ausbau mit kurzem Gerüst; Abriss und Zerstörung mit Staub und Einsinken (render/buildanim.ts, G3) | ⭐ |
| Farbe des Besitzers | Fahnen in der Spielerfarbe | Fahne in der Besitzerfarbe auf Kontor, Marktplatz, Werften, Burgen, Festung, Türmen, Triumphbogen und Schiffen; alle anderen Gebäude tragen einen kleinen Wimpel in der Besitzerfarbe (01.11.2026; vorher waren die Fahnen der Gebäude durch einen Fehler schwarz) | ✅ |
| Auswahl-Zeichen (Regel 14) | – | Angewählte Schiffe, Gebäude und Soldaten tragen einen goldenen Pfeil darüber, der sanft wippt und am Bildschirm immer gleich groß bleibt; Bäume oder Dächer davor verdecken ihn nicht (render/selmark.ts) | ⭐ |
| Bauen im Wald (Regel 14) | – | Beim Platzieren sind die Bäume auf der Grundfläche ausgeblendet, Bäume davor durchsichtig; ein Rahmen zeigt die Grundfläche (grün = geht, rot = geht nicht), der Arbeitsring folgt dem Gelände (render/placehelp.ts) | ⭐ |
| Gebietsgrenze | der Einflussbereich wird gezeigt | Gestrichelte Linie in der Besitzerfarbe wie auf einer Landkarte, auf Gras, Wald, Sand und Fels gut zu sehen, endet sauber am Strand (render/border.ts) | ⭐ |
| Landschaft | gezeichnete Kacheln | echte Höhen, Wind in Bäumen und Gras, Gras mit Flecken und Halmen, Nebel über Unentdecktem | ⭐ |
| Berge | klar gezeichnet | verschwommen; verdecken Gebäude am Fuß des Berges | 🟡 |
| Nord- und Südinseln | im Süden Palmen und eigene Farben | Auf Südinseln wächst Palmenwald (am Strand fast nur Palmen) mit kräftigerem Grün, im Norden Nadel- und Laubwald (render/vegetation.ts:292–334). Boden, Berge und Strand sehen sonst gleich aus | 🟡 |
| Wasser | Wellen, Küste | Farbe nach Tiefe (an der Küste hell und durchsichtig), feine bewegte Wellen, Himmelsspiegelung, Sonnenglitzern, Lichtnetz am Grund und ein weicher, vor- und zurücklaufender Schaumsaum (render/water.ts:1–12); das Kielwasser der Schiffe ist noch ein einfacher Streifen (ships.ts:147); ob am Kartenrand noch eine harte Kante liegt, wurde nicht neu geprüft | ⭐ |
| Licht und Himmel | – | echter Himmel und weiche Schatten ⭐; Möwen kreisen jetzt sichtbar über Fischschwärmen (life.ts:7); keine Wolkenschatten; ob die Schatten beim Verschieben noch flimmern, wurde nicht neu geprüft | 🟡 |
| Wege | Feldweg und Pflaster sehen verschieden aus | Feldweg mit ausgefransten Rändern, niedergetretenem Gras und Fahrspuren, die in Kurven mitbiegen; Pflaster als Kopfsteinpflaster quer zur Wegrichtung mit schmalen Fugen und weichem Rand; Wege enden sauber vor dem Wasser (render/terrain.ts:69–103) | ✅ behoben (nicht auf dem iPhone beurteilt) |
| Gebäude im Gelände | stehen im Boden | keine Bodenplatten mehr: Wohnhäuser stehen auf einem Steinsockel (render/models/haeuser.ts:6), öffentliche Gebäude mit Code-Modell auf einem gepflasterten Hof (models/index.ts:61) | ✅ behoben (G1) |
| Menschen | kleine, lebendige Figuren | Soldaten sehr detailreich ⭐; Arbeiter haben jetzt Beine und gehen sichtbar, sind aber noch sehr einfache Figuren (aus Zylinder und Kugel) | 🟡 |
| Schiffe | gut zu unterscheiden | Masten, gewölbte Segel, Schaukeln, Untergang ⭐; kleine und große Schiffe sind verschieden groß (Faktor 1,3 und 1,6), Handels- und Kriegsschiff haben je ein eigenes Meshy-Modell, die Fahne weht am Mast (ships.ts:212, 341; cloth.ts); die Segel selbst bewegen sich nicht | 🟡 |
| Kampf | kleine Bilder | Mündungsfeuer, Kugeln im Bogen, Rauch, Feuer, Lebensbalken, sinkende Schiffe | ⭐ |
| Rohstoffe sichtbar | nur Dekoration | Fischschwärme, Wild und fallende Bäume zeigen den echten Bestand | ⭐ |
| Katastrophen | Brände, Sensenmann über dem Haus, vertrocknete Felder | fehlen: events.ts ist ein leeres Gerüst, das Symbol über dem Haus ist vorbereitet (`iconFor`), liefert aber noch nie eines | ❌ |
| Wale, Delfine, Ruinen | ja (Wale und Delfine erst in der Erweiterung) | fehlen | ❌ |
| Modelle von Meshy | – | 34 Gebäudearten und 2 Schiffe (Handels- und Kriegsschiff, Piraten dunkel) im Spiel; die Mühle dreht ihre Flügel; Menschen, Tiere, Bäume und Bewegungen fehlen noch | 🟡 |

### 2.7 Geschwindigkeit und Flüssigkeit (Performance)

| Punkt | 1602 / Ziel | Neue Ufer | Status |
|---|---|---|---|
| Spielrechnung | flüssig auch bei 4-fachem Tempo | unter 1 ms je Schritt bei 570 Gebäuden; im großen Gefecht mit 115 Soldaten etwa 5 ms | ✅ |
| Speicher | stundenlang stabil | Speicherleck der Schiffsroute und Aufräumen bei „Neues Spiel“ behoben (R1). Meshy-Modelle werden erst geladen, wenn sie gebraucht werden, jede Datei nur einmal; Oberflächenbilder verkleinert (alle Modelle zusammen ≈ 227 statt ≈ 640 MB Grafikspeicher) | ✅ (iPhone-Test fehlt) |
| Bäume und Gras | nur zeichnen, was man sieht | Die Welt ist in Blöcke zu 16 × 16 Feldern geteilt, was außerhalb des Bildes liegt, wird weggelassen; in der Ferne weniger Bäume, kein Gras (render/vegetation.ts:1–9, R2) | ✅ behoben (R2, iPhone-Test fehlt) |
| Anpassung ans Gerät | – | automatische Qualität (Auflösung und Schatten passen sich der Bildzeit an), in Pause und Menü wird nur bei Änderung gezeichnet (R1) | ✅ (iPhone-Test fehlt) |
| Bauen im Wald, Erkunden, Wege bauen | nur die betroffene Stelle neu zeichnen | Bei Änderungen wird nur der betroffene Block neu aufgebaut (vegetation.ts:7, terrain.ts:3–4, R2) | ✅ behoben (R2, iPhone-Test fehlt) |
| Daten zur Grafikkarte | – | etwa 1,3 MB je Bild, auch wenn nichts passiert | 🟡 |
| Gefechte hinter Mauern | – | Nach einer vergeblichen Wegsuche wartet ein Soldat eine Weile, und je Rechenschritt gibt es nur eine begrenzte Zahl von Suchen (combat.ts:63–79, 561–583, M1); das große Gefecht lag danach im Mittel bei etwa 1 ms | ✅ behoben (M1) |
| Große Stadt | – | jedes Gebäude ist ein eigener Befehl an die Grafikkarte; mit detailreichen Meshy-Modellen wird das riskant | 🟡 |
| Computergegner | – | Die Gegner denken versetzt statt alle im selben Augenblick, und der Spielstart (Insel wählen, Platz planen, losfahren) ist auf drei Schritte verteilt (ai.ts:19–22, 178) | ✅ behoben (KI1) |
| Erster Gebrauch | – | Die Grafik wird gleich nach dem Start vorbereitet („vorgewärmt“: Materialien, Schiffe, Marken, Pflanzen), nicht erst beim ersten Bauen oder Kampf (scene.ts:347–387, R1) | ✅ behoben (R1, iPhone-Test fehlt) |
| Automatisches Speichern | – | Speichern alle 20 s, aber nur wenn sich etwas getan hat; gepackt (etwa ein Zehntel der Größe), abwechselnd in „Auto 1“ und „Auto 2“; Fehler werden gemeldet (main.ts:75–81, saves.ts, P1) | ✅ behoben (P1) |
| Größe der App | klein | Spiel ≈ 1,2 MB (mit dem Modell-Lader) plus Meshy-Modelle ≈ 18 MB, die nur bei Bedarf nachgeladen werden | ✅ |
| Test auf dem iPhone | nötig | fehlt noch; bisher nur am PC gemessen | – |

### 2.8 Übersicht und Spielfluss

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Warnungen bei Problemen | Fragezeichen, Gesichter | Symbole über einzelnen Gebäuden ✅ und Häuser mit gelbem oder rotem Gesicht (G3). Dazu kommen Meldungen mit ⚠️ bei Warenmangel, Hunger, Auszug, vollem Lager und Minus in der Kasse, je Ware und Insel höchstens alle 5 Minuten (stats.ts:518–552, S1) | ✅ behoben (S1, G3) |
| Statistik | Fenster mit Bevölkerung, Waren und Bilanz | Die Berechnung steht (stats.ts: Kassenbuch, Warenfluss, Bevölkerung, Vergleich mit den Gegnern, Verläufe über 120 Minuten), aber das Fenster ist noch leer (ui/stats.ts, `ready` ist false): Tipp auf Geld oder Einwohner zeigt weiter „Lager & Bilanz“ | ❌ Fenster fehlt (U2) |
| Bevölkerung im Überblick | Stimmung je Stufe | Das Kontorfenster zeigt die Einwohner je Stufe; die Übersicht mit Stimmung und „Es fehlt“ ist berechnet (`popSummary` in stats.ts), aber noch nirgends zu sehen; was fehlt, sieht man nur Haus für Haus | ❌ Fenster fehlt (U2) |
| Meldungen | Meldungszeile, Sprung zum Ort des Geschehens | Meldungen tragen jetzt einen Ort und werden samt Spielzeit gesammelt (die letzten 60, ui/log.ts:33–37), aber der Verlauf ist noch nirgends zu sehen (die Glocke 🔔 bleibt versteckt). Gezeigt werden weiter kurze Einblendungen (höchstens 3, nach wenigen Sekunden weg), ohne Sprung zum Ort | ❌ Fenster fehlt (U3) |
| Übersichtskarte | immer am Rand sichtbar | nur eine große Karte als eigenes Fenster: hält das Spiel an, zeigt keine Inselnamen, kein Erz und kein Gold | 🟡 |
| Meine Schiffe und Inseln | schnell zu wählen, umbenennbar | keine Liste, kein Sprung, kein Umbenennen; das Fenster „Flotte & Inseln“ ist ein leeres Gerüst (ui/fleet.ts, Knopf ⛵ versteckt) | ❌ (U3) |
| Spielstände | mehrere | Fünf Plätze: „Auto 1“ und „Auto 2“ (wechseln alle 5 Minuten, so bleibt immer ein älterer Stand) und „Platz 1“ bis „Platz 3“ zum selbst Sichern; Laden, Löschen, Weitergeben als Text oder Datei und Einlesen; ein unlesbarer Stand wird gesichert statt überschrieben; Fehler beim Speichern werden gemeldet (saves.ts:1–28, ui/settings.ts, P1) | ✅ behoben (P1) |
| Einstellungen für ein neues Spiel | Schwierigkeit, Startbedingungen, Optionen | Fenster „Neues Spiel“ mit Schwierigkeit leicht / normal / schwer (Startgeld 20 000 / 15 000 / 10 000, Standard normal), 0–3 Konkurrenten, Piraten an oder aus, Feuer, Pest und Dürre aus / mild / normal und einer Inselwelt-Nummer zum Teilen (ui/settings.ts:49–78, schwierigkeit.ts, P1). Noch ohne Wirkung: die Grenzen der Gegner (KI2) und die Katastrophen (S3); Weltgröße und Spielziel erscheinen erst, wenn es mehr als eine Wahl gibt (L5, S5) | 🟡 größtenteils behoben (P1) |
| Spielstart | Schiff in einer unbekannten Welt | gleich ✅; das Startschiff liegt 10 bis 13 Felder vor der Heimatküste, ein Stück Küste ist aufgedeckt, es ist also Land in Sicht (game.ts:524, 548). Ein Pfeil zur nächsten unentdeckten Insel fehlt noch (U3) | 🟡 |
| Anleitung | Lehrgang in mehreren Teilen | war ein langes Textfenster; seit U1 drei kurze Karten (Segeln, Kontor, Bauen) plus „Mehr Hilfe“, der Hauptknopf sitzt fest unten | ✅ behoben (U1) |
| Symbole über Gebäuden | ein Fragezeichen | 7 klare Symbole für die Ursache ⭐; ein Ring zeigt die Dringlichkeit (rot = steht still oder bestimmt ein Auszug, gelb = eingeschränkt, grau = Hinweis), beim Herauszoomen werden sie zu Sammelmarken mit Zahl je 6 × 6 Felder (render/citysigns.ts:12–70, G3) | ⭐ behoben (G3) |
| Aufgaben | die Ziele lassen sich jederzeit anzeigen | 24 Aufgaben streng nacheinander, nur eine sichtbar; „Wehrhaft“ steht seit L2 hinter „Bürger“ und „Eisen und Werkzeug“ (game.ts:2399 ff.); Nebenaufgaben parallel gibt es noch nicht (U3) | 🟡 |
| Erz, Gold, Fruchtbarkeit | Symbole auf entdeckten Inseln | Über entdeckten Inseln stehen ab Kameraabstand 20 Symbole für Erz, Gold und die Pflanzen mit Fruchtbarkeit in Prozent, dazu die Infos im Insel-Fenster (citysigns.ts:80–90, scene.ts:971–992, G3) | ✅ behoben (G3) |
| Zeit | Pause, Tempo | Pause und 1x/2x/4x ✅; in der Pause zeigt der Knopf ▶️ und die Oberleiste bekommt eine goldene Kante (hud.css:12, hud.ts `updateSpeedBtn`); keine Anzeige der Spielzeit | 🟡 |
| Insel prüfen | Schiff hinfahren, warten, bis der Balken am „Auge“ voll ist | einfach antippen | ⭐ (einfacher) |
| Beim Bauen | der Einflussbereich wird gezeigt | Begründung im Klartext, Radius, Skala für die Ergiebigkeit, fremdes Gebiet wird abgedunkelt | ⭐ |

### 2.9 Inselwelt, Computergegner, Ereignisse

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Zufällige Inselwelt mit Nebel | ja | ja, sehr verlässlich: in 300 Testwelten immer alle Pflanzen und Erz, Gold in rund 96 %, keine Mini-Inseln | ⭐ |
| Inselgrößen | 5 Größenklassen bis etwa 100 × 90 Felder | 3 Klassen, jede eine Klasse kleiner (die größte etwa 60 × 60) | 🟡 |
| Inselformen und Gelände | viele Formen, Flüsse, Steppe, große Berge | rundliche Formen mit zufälligem Rand; keine Flüsse, keine Steppe; kleine Berge | 🟡 |
| Klima Nord/Süd | eigene Fruchtbarkeit je Pflanze | gleich (zum Aussehen siehe 2.6) | ✅ |
| Erste Insel | groß, mit Erz und einer Pflanze, die zu 100 % wächst | beim Abgleich nicht garantiert (in rund 10 % der Welten fehlte das Erz, in rund 20 % eine Pflanze mit 100 %, in knapp 4 % gab es gar kein Gold). Seit L1 gibt es eine Heimatinsel (nächste mittlere oder große Berginsel) mit sicherem Erz und einer Pflanze auf 100 %, dazu eine Gold-Garantie auf einer kleinen Berginsel; der Spielstart deckt ein Stück Küste der Heimatinsel auf | ✅ behoben (L1) |
| Computergegner: Wirtschaft | ihre Städte laufen über Stunden | war ein **Fehler** (Wege nicht angeschlossen, Hunger, Pleite; nach 2 Stunden fast alle im Minus). Seit KI1 gemessen (20 Welten mit je drei Gegnern, 120 Spielminuten): 0 % im Minus, im Mittel 154 Einwohner, alle Betriebe am Wegenetz, kein Hunger | ✅ behoben (KI1) |
| Computergegner: Wachstum | alle 5 Stufen, mehrere Inseln | bleiben bei den Siedlern, auf einer Insel und mit 9 Gebäudearten | 🟡 |
| Computergegner: Wahl der Insel | – | sichern sich in den ersten 1–3 Minuten die großen Inseln | 🟡 |
| Computergegner: Handel und Schiffe | handeln und fahren eigene Schiffe | handeln nie mit dir; im Frieden stehen ihre Schiffe nach der Gründung still (im Krieg bauen sie ein Kriegsschiff und fahren Überfälle) | ❌ |
| Computergegner: Charakter | eigene Persönlichkeit, richten ihr Tempo nach dem Spieler | nur Name und Farbe | ❌ |
| Computergegner gründen | – | zuverlässig und nach denselben Regeln wie du | ✅ |
| Ureinwohner | Dörfer, Tausch Ware gegen Ware (etwa 1 : 1,5), Fluch bei Angriff | fehlen ganz: natives.ts liefert nie ein Dorf, das Fenster zur Häuptlingshütte ist ein leeres Gerüst | ❌ |
| Feuer | Brände springen über, die Feuerwehr löscht | fehlt: events.ts ist ein leeres Gerüst (`ignite` tut nichts), die Feuerwehr ist nicht baubar | ❌ |
| Pest, Kriminalität | Arzt, Galgen | fehlen (Gerüst events.ts; Arzt und Galgen nicht baubar) | ❌ |
| Dürre, Schatz, Vulkan | ja (Vulkan in der Erweiterung) | fehlen (`droughtOn` liefert immer „nein“); im Fenster „Neues Spiel“ gibt es die Wahl aus / mild / normal, sie wirkt aber noch nicht | ❌ |
| Abwechslung | Kartengrößen, Optionen | Start immer unten links, die Mischung der Inseln ist fast immer gleich (geplant sind 3 große, 6 mittlere und 5 kleine; 11 bis 14 bleiben übrig), und die Namen verraten die Inselgröße | 🟡 |

---

## 3. Stärken: was schon gut oder besser ist

- **Zahlen wie im Original:** 52 Gebäudearten mit (fast immer) genauen Kosten, Unterhalt, Reichweiten und Freischaltungen. Dazu der Verbrauch je Stufe (bewusst etwa 8-mal so schnell), Kosten für den Haus-Aufstieg, Kontor I–IV, alle Schiffe, alle Kampfwerte und die Händlerpreise.
- **Der Kern von 1602 steht:** fünf Stufen mit denselben Bedingungen, alle 23 Waren und Ketten, Lager und Freischaltungen je Insel. Eine Aristokratenstadt trägt sich wie im Original (rechnerisch etwa ein Drittel Gewinn).
- **Kampf nah am Original:** Gefechte rechnen wie in 1602, Wald gibt Deckung. Es gibt Seeschlachten, Truppen an Bord, Eroberung über Kontor oder Marktplatz, Krieg und Frieden, Schutz vor Piraten nach Vermögen und den Triumphbogen.
- ⭐ **Lebendige Rohstoffe:** Bäume fallen und wachsen nach. Fischgründe und Wild haben sichtbare Bestände (Fischschwärme, Hirsche), das Weideland nur als Zahl in der Skala beim Bauen. Zu dicht gebaute Betriebe teilen sich den Rohstoff, und beim Bauen zeigt eine Skala, wie ergiebig der Platz ist.
- ⭐ **Klare Infos:** Haus- und Betriebs-Info sagen im Klartext, was fehlt und warum. Warnsymbole nennen die Ursache, und beim Bauen begründet das Spiel jedes „Geht nicht“. 24 Aufgaben führen durch alle Ketten.
- ⭐ **Gute Grundlage fürs Handy:** Kerbe und Home-Balken werden beachtet, ein Finger schiebt ohne Bauen aus Versehen, Wege baut man per Tippen mit Umweg-Suche. Vor dem Abreißen von Gebäuden und vor Kriegserklärungen kommt eine Rückfrage, beim Verlassen pausiert und speichert das Spiel.
- ⭐ **Fairer Ablauf:** 3 Minuten Vorwarnung vor Kriegen mit Rat, nach einem Totalverlust ein Rettungsschiff und 40 Minuten Ruhe; Piraten rauben, statt zu versenken.
- **Verlässliche Inselwelt:** in 300 Testwelten immer alle Pflanzen und Erz, Gold in rund 96 %, keine Mini-Inseln, Inselinfo per Antippen (⭐).
- **Schöne Teile der Grafik:** Berge und Täler, Wind in Bäumen und Gras, Schaum an der Küste, Nebel über Unentdecktem, echter Himmel und weiche Schatten. Burgen, Soldaten und Kampfeffekte sind sehr detailreich. Schiffe schaukeln, bekommen Schlagseite und sinken.
- **Schlanke Technik:** Das Spiel selbst hat etwa 1,2 MB (beim Abgleich 887 KB, dazu kam der Lader für die Meshy-Modelle; die Modelle, zusammen etwa 18 MB, werden erst bei Bedarf geladen) und startet in etwa 2,5 s. Die Spielrechnung ist sparsam, und der Speicher bleibt bis auf einen Fehler stabil. Nach einem simulierten Grafikausfall kam das Bild im PC-Test wieder zurück (auf dem iPhone noch ungetestet). Der Anschluss für Meshy-Gebäude funktioniert.

## 4. Größte Schwächen: was zuerst angehen

1. **Fehler und Stolpersteine im Spielgefühl:**
   - Ein volles Lager vernichtete Ware, Tore trennten das Wegenetz (beides behoben in L1); die Schiffsroute füllte den Speicher der Grafikkarte, und die Hausstufen 4 und 5 sahen aus wie Stufe 3 (behoben in R1 und G1).
   - Militär, Abreißen, „Alles ausladen“ und „Los geht's“ lagen unter dem Bildrand, und die Hinweisleiste fing Fingertipps ab (behoben in U1).
   - Schiff-auf-Land war nur halb gelöst (behoben in L1/U1).

   → L1 ✔, U1 ✔, R1, G1
2. **Die Stellschrauben der Wirtschaft sind da** (Steuersatz je Stufe, Bankrott, Hunger, Abstieg, Wirtschaftstempo; L2 ✔). Offen: das große Steuer- und Bilanzfenster. → U2
3. **Computergegner:** Ihre Wirtschaft kam nicht in Gang und rutschte ins Minus (behoben in KI1), sie bleiben bei den Siedlern auf einer Insel, handeln nicht und sind im Krieg kaum eine Gefahr. → KI1, KI2, M2
4. **Handel:** Händlerschiffe mit Aufträgen und Handelsrouten gibt es seit S2 ✔. Offen: eine große Handelsoberfläche (Aufträge mit Schiebereglern, Routen auf der Karte) und Handel mit den Computergegnern. → U5, M2
5. **Kein Überblick:** Warnungen bei Mangel, Hunger und Minus gibt es (S1 ✔), Meldungen tragen einen Ort. Offen: Statistik-Fenster, Meldungsverlauf mit Sprung zum Ort, Übersichtskarte, Liste der Schiffe und Inseln (die Berechnungen dahinter stehen schon). → U2, U3
6. **Die Stadt-Grafik:** Rauch, Bau-Animation, Warnsymbole und 34 Meshy-Gebäude stehen im Spiel (G3 ✔, G5a/G5b ✔). Offen: eigene Formen für Kontor I–IV, Bewohner in der Stadt, sichtbare Felder, Nord- und Südinseln (Boden und Berge), die übrigen Gebäude ohne Meshy-Modell. → G2, G3b, G4a, G5c
7. **Ganze Bereiche von 1602 fehlen:** Ureinwohner, Feuer, Pest, Kriminalität, Dürre, Prachtbauten, Piratennest, Endwertung, Szenarien. → S3, S4, L3, M2, S5, F2
8. **Die Grafik-Leistung** ist seit R1/R2 abgesichert (nur Sichtbares zeichnen, Neuaufbau nur des Geänderten, Qualität passt sich dem Gerät an, Vorwärmen). Offen: der Test auf dem iPhone und die Zahl der Zeichenaufrufe in großen Städten. → iPhone-Test
9. **Warenwege einfacher als in 1602:** Felder entstehen unsichtbar von selbst, Wald lässt sich nicht pflanzen, Rohstoffe „springen“ in die Werkstatt, Marktplätze bringen kaum etwas. → L2, L4
10. **Die Welt ist kleiner und gleichförmiger:** Inseln eine Größenklasse kleiner, keine Flüsse und keine Steppe, Start immer unten links. → L5

## 5. So geht es weiter

Die Schwächen sind auf 35 Arbeitspakete verteilt (die Buchstaben zeigen den Bereich: L = Spielregeln und Spielwelt, U = Oberfläche und Bedienung, KI = Computergegner, M = Kampf, S = neue Spielteile wie Statistik, Handel, Ereignisse, Ureinwohner und Endwertung, G = Grafik, R = Flüssigkeit der Grafik, P = Spielstart und Spielstände, A = Klänge, F = Feinschliff, D = Unterlagen). Zu jedem gibt es eine eigene Liste mit Einzelschritten und Dateien. Die Pakete laufen in vier Wellen. Innerhalb einer Welle können mehrere Helfer gleichzeitig arbeiten.

| Welle | Inhalt | Pakete |
|---|---|---|
| 1 – Fehler & Spielgefühl | Fehler beheben, Schiff wie gewünscht, Stolpersteine auf dem Handy weg, Wirtschaft der Gegner reparieren, Grafik-Leistung, Fehler an Gebäuden, Unterlagen bereinigen | L1 ✔, U1 ✔, KI1 ✔, R1 ✔, R2 ✔, G1 ✔, D1 ✔ |
| 2 – Kern von 1602 | Steuern, Bankrott und Kosten; Statistik und Warnungen; Händlerschiffe und Routen; Kampfregeln; Gegner wachsen; die passenden Fenster; Gebäude neu gestalten; Rauch, Fahnen und Symbole; Plan für Meshy | L2 ✔, S1 (Berechnung ✔), S2 ✔, M1 (Regeln ✔), G3 ✔, G5a ✔; offen: KI2, U2–U5, G2 |
| 3 – fehlende Inhalte | Katastrophen, Ureinwohner, Endwertung, Prachtbauten, Felder, Förster und Anlieferung, Piratennest und Diplomatie, Spielstart und Spielstände, sichtbare Bewohner und Felder, Landschaft, Wasser und Licht, Klänge | P1 ✔; offen: S3, S4, S5, L3, L4, M2, G3b, G4a, G4b, A1 |
| 4 – Feinschliff | Meshy-Modelle im Spiel, Inselgrößen und Flüsse, Bilder der Gebäude und App-Symbol, Szenarien, Unterlagen nachziehen | G5b, L5, F1, F2, D2 |

Damit sich die Helfer nicht gegenseitig stören:

- **Andockstellen (Paket L1):** Neue Spielteile (Ereignisse, Statistik, Händler, Punkte, Ureinwohner) bekommen je eine eigene Datei, die an einer festen Stelle im Spiel eingehängt wird. Neue Gebäude stehen schon vorbereitet in der Datentabelle und erscheinen erst, wenn ihr Spielteil fertig ist (Regel 8).
- **Bausteine der Oberfläche (Paket U1):** Die große Datei der Oberfläche wird zerlegt. Jedes Fenster bekommt eine eigene Datei mit eigener Gestaltung.
- Wo zwei Pakete dieselbe Datei brauchen, wartet das eine auf das andere; das ist in der Liste vermerkt. Die Unterlagen ändern nur D1 (erledigt mit dieser Fassung) und D2 (am Ende).
- Jedes Paket endet mit den automatischen Prüfungen (Programmcode prüfen, Spiel zusammenbauen, im Browser im Handy-Format ausprobieren). Danach prüft ein unabhängiger zweiter Claude (der „Prüf-Agent“) das Ergebnis gegen ANFORDERUNGEN.md.

**Was du beitragen kannst:**

- die Fragen aus Abschnitt 6 hast du beantwortet (siehe dort); offen bleiben nur die Rückmeldung zur Meshy-Probe und der Test auf dem iPhone,
- den Meshy-Schlüssel `MESHY_API_KEY` in den Umgebungs-Einstellungen anlegen, wenn Meshy alle Modelle erzeugen soll (nie im Chat),
- nach Paket R1 einmal auf deinem iPhone spielen. Mit Paket R1 kommt eine kleine Anzeige dazu, wie lange ein Bild braucht (dann „?debug“ an die Adresse hängen).

## 6. Entscheidungen

Die sechs Fragen aus dem Abgleich hat der Nutzer am 31.10.2026 beantwortet (festgehalten in `CLAUDE.md`, Abschnitt „Entscheidungen aus dem 1:1-Abgleich“). Alle sechs folgten der Empfehlung. Die Entscheidungen gelten als feste Vorgaben, die prüfbaren Anforderungen dazu stehen in `docs/ANFORDERUNGEN.md` (Abschnitt „Entscheidungen aus dem 1:1-Abgleich“).

| Nr. | Entscheidung | Was das heißt | Paket | Stand |
|---|---|---|---|---|
| 1 | **Steuern wie 1602** | Ein Regler je Stufe mit den Höchstsätzen des Originals (Pioniere 48 %, Siedler 45 %, Bürger 38 %, Kaufleute 36 %, Aristokraten 35 %). Zu hohe Steuern machen unzufrieden bis zum Auszug. Flache Steuerkurve (Aristokrat etwa 1,4 × Pionier statt 6 ×). Die Gesamteinnahmen werden so eingestellt, dass das Spiel nicht schwerer wird. | L2, U2 | erledigt (L2) |
| 2 | **Wirtschaftstempo wie 1602** | Betriebe werden so beschleunigt, dass einer wieder 60 bis 100 % so viele Bewohner versorgt wie im Original (heute bei Luxuswaren nur ¼ bis ⅓). | L2 | erledigt (L2, 60–83 %) |
| 3 | **Felder automatisch** | Eine Farm oder Plantage legt beim Bau automatisch sichtbare Felder an (5 Taler je Feld); sie reifen erst. Ein Feld-Werkzeug dient zum Nachbessern. | L4, G3b | offen |
| 4 | **Grafik** | Zuerst sichtbare Fehler im Code beheben (G1), dann eine Meshy-Probe mit 3 Modellen (Wohnhaus, Kontor, Schaf). Nach Freigabe werden alle Modelle mit Meshy erzeugt; im Code wird nur nachgebaut, was Meshy nicht liefert. Der Schlüssel `MESHY_API_KEY` kommt vom Nutzer in die Umgebungs-Einstellungen, nie in den Chat. | G1, G5a, G5b | Probe freigegeben; 34 Meshy-Modelle sind im Spiel, 16 Gebäude warten noch auf ein neues Modell (OFFEN.md, G5c) |
| 5 | **Schwierigkeit wählbar** | leicht / normal / schwer mit Startgeld 20 000 / 15 000 / 10 000. Standard „normal“: Gegner wachsen bis Kaufleute, besiedeln 2 bis 3 Inseln und greifen nach Vorwarnung an. Katastrophen standardmäßig „mild“. | P1, KI2, S3 | Fenster und Startgeld erledigt (P1); Grenzen der Gegner wirken mit KI2, Katastrophen mit S3 |
| 6 | **Inselgrößen wie 1602** | Fünf Größenklassen, größere Welt, beim Start wählbar. Erst nach der Arbeit an der Grafik-Leistung (R1, R2) und einem Test auf dem iPhone des Nutzers. | L5 | offen, zuletzt |

Bis zum Test auf dem iPhone bleibt die heutige Weltgröße (eine Größe, `WORLD_SIZES` in `src/world.ts`).
