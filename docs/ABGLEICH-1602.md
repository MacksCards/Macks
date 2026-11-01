# Abgleich mit 1602: „Neue Ufer“, Stand 31.10.2026

*Alle 210 Einzelbefunde mit Belegen und Umsetzungsvorschlägen stehen in `docs/recherche/abgleich-befunde.json` (eine Fachliste für die Umsetzung, du musst sie nicht lesen). Die Umsetzung läuft in Arbeitspaketen (siehe Abschnitt 5 „So geht es weiter“ und docs/OFFEN.md).*

**Zeichen in den Tabellen:** ✅ wie in 1602 · 🟡 anders oder nur teilweise · ❌ fehlt · ⭐ besser als 1602 · **Fehler** = funktioniert nicht richtig

**Grundlage:** die Inhaltsliste von 1602 (docs/1602-INHALT.md mit den Recherchen), der Programmcode und viele Tests: Simulationen über mehrere Spielstunden, Hunderte Zufallswelten und Browser-Tests im iPhone-Querformat (852 × 393 Punkte, mit Touch). Was bewusst anders gemacht wurde, zählt nicht als Mangel: Schweinezucht statt Rinderfarm und Steine statt Ziegel (dein Wunsch) sowie eine Weberei, die Brauerei und das schnellere Spiel (unsere Vereinfachungen).

**Stand der Unterlagen:** Der Abgleich wurde am Spielstand vom 31.10.2026 (vor der ersten Umsetzungswelle) gemacht. Was seitdem erledigt ist, steht in den Tabellen mit dem Vermerk „behoben“ und dem Paketnamen (L1, KI1, U1; die Kürzel sind in Abschnitt 5 erklärt). Die Prozentwerte in Abschnitt 1 beschreiben noch den Stand vor diesen Arbeiten; sie werden am Ende (Paket D2) neu geschätzt.

---

## 1. Kurzfazit

**Passt schon alles 1:1? Noch nicht.**

- **Die Zahlen stimmen sehr gut.** Bei allem, was schon im Spiel ist, stimmen Kosten, Unterhalt, Reichweiten, Freischaltungen, Kampfwerte, Schiffe und Preise zu über 90 % mit dem Original überein; der Verbrauch ist bewusst etwa 8-mal so schnell.
- **Der Spielablauf ist erst gut zur Hälfte da.** Es fehlen wichtige Stellschrauben (Steuersatz, Bankrott) und ganze Bereiche (Ureinwohner, Katastrophen, Handelsrouten, Prachtbauten, Endwertung). Die Computergegner sind noch schwach.
- **Die Grafik ist gemischt.** Landschaft, Wasser und Kampf sind schon schöner als in 1602. Die Gebäude der Stadt liegen dagegen noch *unter* dem Niveau von 1602.

| Bereich | Nähe zu 1602 (Schätzung) | Warum |
|---|---|---|
| Spielumfang & Inhalt | ≈ 65 % | Stufen, Waren, Ketten, Gebäudezahlen, Schiffe und Militär sind 1:1 da. Es fehlen Ureinwohner, Katastrophen, Prachtbauten, Handelsrouten, Endwertung und Szenarien. |
| Wirtschaft | ≈ 55 % | Der Steuersatz ist fest (kein Regler), es gibt keinen Bankrott, und Häuser steigen nie ab. Bei Luxuswaren, Stoffen und Kleidung versorgt ein Betrieb nur ¼ bis ⅓ so viele Bewohner wie in 1602. Handel nur per Sofort-Knopf. (Der Fehler bei vollem Lager ist seit L1 behoben.) |
| Krieg | ≈ 65 % | Kampfwerte und Eroberung sind 1:1. Aber die Gegner sind kaum eine Bedrohung, es gibt kein Feuer, kein Piratennest und nur eine einfache Mehrfachauswahl per Knopf (kein Rahmen aufziehen). (Dass Tore das Wegenetz trennten, ist seit L1 behoben.) |
| Bedienoberfläche | ≈ 55 % | Die Infos sind klarer als in 1602. Steuerfenster, Statistik, Meldungsverlauf, eine dauernd sichtbare Übersichtskarte und die Schiffsliste fehlen (es gibt nur die Weltkarte als eigenes Fenster); das Baumenü passt nicht auf den Bildschirm. |
| Bedienung auf dem Handy (gemessen am Ziel) | ≈ 55 % | Gute Grundlage. Beim Abgleich lagen mehrere wichtige Knöpfe unter dem Bildrand, die Hinweisleiste fing Fingertipps ab, und Schiff-auf-Land war nur halb gelöst (alles seit U1/L1 behoben). Es gibt noch kein Rückgängig. |
| Grafik & Details (Ziel: schöner als 1602) | ≈ 45 % | Landschaft, Wasser und Kampf ⭐. Beim Abgleich waren die Gebäude noch einfache Formen; seit 31.10.2026 stehen 34 Gebäudearten (alle fünf Hausstufen) und 2 Schiffe als realistische Meshy-Modelle im Spiel, 14 Gebäudearten haben noch Code-Modelle. Es gibt noch keinen Rauch, keine Felder und keine Bewohner. |
| Geschwindigkeit des Spiels (Performance, gemessen am Ziel) | ≈ 60 % | Die Spielrechnung ist sehr sparsam. Beim Abgleich zeichnete die Grafik zu viel, es gab ein Speicherleck und keine Anpassung ans Gerät – das ist seit R1/R2 behoben (nur Sichtbares zeichnen, automatische Qualität). Noch nie auf einem echten iPhone gemessen. |
| Übersicht & Spielfluss | ≈ 50 % | Die Infos zu einzelnen Gebäuden sind ⭐. Das Gesamtbild fehlt: Statistik, Warnungen, Ziele, mehrere Spielstände. |
| Inselwelt, Computergegner, Ereignisse | ≈ 35 % | Die zufällige Inselwelt wird sehr verlässlich erzeugt. Die Wirtschaft der Gegner kam anfangs nicht in Gang (Schulden, Betriebe ohne Wegeanschluss); das ist seit Paket KI1 behoben, sie bleiben aber noch klein; Ureinwohner und alle Katastrophen fehlen. |
| **Gesamt** | **≈ 55 %** | Durchschnitt der neun Werte, gerundet. „Handy“, „Grafik“ und „Leistung“ messen am Ziel des Projekts, nicht an 1602. |

Die Prozente sind eine grobe Schätzung: Wie viel vom Spielgefühl von 1602 ist in diesem Bereich schon da? Wichtige Punkte zählen mehr. Zählt man nur die Tabellenzeilen aus Abschnitt 2 (✅ und ⭐ voll, 🟡 halb, ❌ null), kommen ähnliche, meist etwas niedrigere Werte heraus (zwischen 41 % und 56 %). Bei „Handy“ und „Leistung“ ist die Schätzung besonders unsicher, weil das Spiel noch nie auf einem iPhone getestet wurde.

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
| Zahlen der Gebäude | rund 60 Gebäude mit Kosten, Unterhalt, Reichweite, Freischaltung | 52 Gebäudearten (ohne Wege), fast alle mit genau diesen Zahlen. Kleinigkeiten weichen ab: Reichweite Kapelle 9 statt 8 und Jagdhütte 7 statt 8, der Steinbruch kostet Unterhalt, die Fleischerei braucht keine 10 Steine, Holzfäller und Schaffarm arbeiten in einem Umkreis von 4 statt 3 Feldern | 🟡 fast gleich (Kanonengießerei jetzt ab 400 Bürgern wie in der Tabelle des Originals, Stadttor 4 Steine, neues kleines Tor: behoben in L1) |
| Grundfläche der Gebäude | viele Gebäude länglich (z. B. Marktplatz 4 × 3); das Wohnhaus belegt vermutlich nur 1 Feld (Quelle unsicher) | alle Gebäude quadratisch, Wohnhaus 2 × 2. Falls das Original 1 Feld hat, versorgen Kapelle & Co. nur ein Viertel so viele Häuser. Recherche-Ergebnis (D1): siehe Abschnitt 2.1a | 🟡 offen, Vorgabe für L5 steht in 2.1a |
| Freischalt-Reihenfolge | 30 Pioniere bis 600 Aristokraten | gleich | ✅ |
| Schiffe | 5 Typen, Laderaum, Kanonen, höchstens 20 | gleich (auch im Original erlaubt jeder Triumphbogen ein Schiff mehr). Beschädigte Schiffe fahren langsamer (L1) | ✅ |
| Kontor I–IV | 30 / 50 / 75 / 100 t Lager | gleich | ✅ |
| Feuerwehr, Arzt, Galgen | Schutz gegen Feuer, Pest und Verbrechen | fehlen (zusammen mit den Katastrophen, siehe 2.9) | ❌ |
| Prachtbauten | Palast, Kathedrale, Denkmal, Zierbaum | fehlen; nach dem Theater haben Aristokraten kaum noch Ziele | ❌ |
| Plätze, Brücken, Anlegesteg | Plätze I–III, Holz- und Steinbrücken über Flüsse, Steg | fehlen; nur Feldweg und Pflasterweg, keine Flüsse | ❌ |
| Ureinwohner | Dörfer, Tauschhandel, Fluch | fehlen (siehe 2.9) | ❌ |
| Punkte und Endwertung | Punkte für Einwohner, Kasse und Siege; Endwertung | fehlen; ein Sieg beendet das Spiel nicht, er schaltet nur den Triumphbogen frei | ❌ |
| Szenarien | 26 Szenarien (+20 in der Erweiterung) | keine; nur das freie Spiel mit 24 Aufgaben | ❌ |
| Mehrspieler, Karteneditor | ja (Editor in der Erweiterung) | fehlen vorerst; jetzt als bewusste Abweichung in 1602-INHALT.md (Abschnitt 12) eingetragen | ❌ (bewusst) |
| Rohstoffe wachsen nach | Wald nur über den Förster, Bestände unsichtbar | Bäume, Fische und Wild verbrauchen sich sichtbar und wachsen nach (Weideland und Felder nur unsichtbar, die Skala beim Bauen zeigt sie); Nachbarn teilen sich den Rohstoff; beim Bauen zeigt eine Skala die Ergiebigkeit | ⭐ |
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
| Steuersatz | je Stufe einstellbar (Höchstsätze 48 % bis 35 %), Gesichter zeigen die Stimmung; das wichtigste Werkzeug fürs Geld | fest, kein Regler. Entschieden: Regler je Stufe wie 1602 (Paket L2) | ❌ entschieden, noch offen |
| Steuer je Einwohner | flach: ein Aristokrat zahlt etwa 1,4-mal so viel wie ein Pionier | steil: 6-mal so viel. Pioniere zahlen die Hälfte des Originals, Aristokraten mehr als das Doppelte (nirgends begründet) | 🟡 |
| Hunger und Unzufriedenheit | Hunger macht unzufrieden, Bewohner ziehen aus, das Haus verfällt | Zufriedenheit, Steuer und Aufstieg sinken. Aber ab den Siedlern zieht wegen Hunger allein niemand aus, und Häuser steigen nie ab | 🟡 |
| Bankrott | lange tief im Minus (etwa −10 000 Taler): Spiel verloren | Schulden haben keine Folgen außer einer roten Zahl und gesperrten Käufen | ❌ |
| Einwohner je Betrieb | z. B. Weberei-Kette 283, Weingut 167, Schneiderei 457 Einwohner | bei Luxuswaren, Stoffen und Kleidung nur ¼ bis ⅓ davon (bei Fischerei, Fleischerei und Bäckerei etwa 80–90 %): Der Verbrauch ist 8-mal so schnell, die Herstellung meist nur 2- bis 3-mal. Bei diesen Waren braucht man etwa 3-mal so viele Betriebe | 🟡 |
| Unterhalt im Betrieb und in Ruhe, Betrieb abschalten | ja (z. B. Weingut 35 im Betrieb, 15 in Ruhe) | ein fester Betrag, nichts lässt sich abschalten; Werften zahlen nur den Ruhebetrag | 🟡 |
| Baumaterial an Bewohner sperren | Schalter am Kontor | fehlt; mehrere Häuser auf einmal können das knappe Werkzeug und die Steine leerräumen, die man für Betriebe braucht | ❌ |
| Lager voll | der Betrieb hält an, nichts geht verloren | war ein **Fehler** (Ware verschwand still): behoben in L1. Karren holen nichts mehr ab, wenn das Insellager voll ist, laden nur ab, was Platz hat, und der Betrieb meldet von selbst „Lager voll“ | ✅ behoben (L1) |
| Lager und Freischaltungen je Insel | ja | gleich | ✅ |
| Kosten für den Haus-Aufstieg | Tabelle | gleich | ✅ |
| Marktkarren | holen im Umkreis von 6 Feldern ums Kontor ab; Marktplätze nahe den Betrieben beschleunigen den Transport | sichtbare Karren ✅, auf Pflaster schneller ✅. Sie holen aber im ganzen Gebiet (16 Felder) ab, deshalb bringen Marktplätze dafür kaum etwas | 🟡 |
| Felder | einzeln um Farm oder Plantage angelegt (5 Taler), müssen reifen | jede freie Wiese im Umkreis zählt unsichtbar und sofort reif als Feld und zugleich als Weide | 🟡 |
| Wald pflanzen | der Förster pflanzt neu | niemand pflanzt neuen Wald: gefällte Bäume wachsen zwar nach, aber Wald, den ein Gebäude oder Weg überbaut hat, kommt nie zurück (die Unterlagen behaupten fälschlich „gleicher Effekt“) | 🟡 |
| Rohstoffe zu den Werkstätten | Karren liefern an; der Weber holt die Wolle direkt beim Nachbarn | Rohstoffe „springen“ ohne Weg aus dem Lager in die Werkstatt; der Standort spielt keine Rolle | 🟡 |
| Erz | Vorkommen 80 oder 240 t; die tiefe Mine baut den Rest ab | die normale Mine stimmt; die tiefe Mine baut den Rest ab und endet bei 3 × der Startmenge, rund 15 % der Vorkommen sind unerschöpflich (L1; früher förderte sie endlos) | ✅ behoben (L1) |
| Wachstum | allmählich | ein Haus kann in unter 5 Minuten zur vollen Aristokratenvilla werden | 🟡 |
| Freier Händler | kommt mit dem Schiff und handelt nach deinen Aufträgen (Ware, Menge, Preis); Zahl der Plätze je Kontorstufe; verkauft nur, was jemand hergestellt hat (Ausnahme: Werkzeug, Erz) | Sofort-Knopf ±5 t am Kontor, feste Preise, verkauft alles, auch Kanonen und Schmuck | 🟡 |
| Handelsrouten | Schiffe fahren automatisch zwischen Kontoren | fehlen; Einladen nur von Hand in 10-t-Schritten, Ausladen nur „alles“ | ❌ |
| Handel mit Computergegnern | direkt, günstiger als beim Händler; Handelsvertrag | fehlt | ❌ |
| Bilanz | Einnahmen und Ausgaben nach Arten | nur „Steuern“ und „Unterhalt“ (die Kosten des Heeres sind darin versteckt), kein Handel, kein Verlauf | 🟡 |
| Waren-Statistik | Erzeugung und Verbrauch je Ware | fehlt; Raten stehen nur einzeln am Betrieb | ❌ |
| Händlerpreise | Preistabelle | etwa 90 % davon, Kauf zu Verkauf etwa 3 : 2 | ✅ |
| Preis für Frieden und für Schutz vor Piraten (im Original nur beim Piraten-Schutz belegt) | richtet sich nach dem Vermögen | gleich | ✅ |
| Gewinn einer Aristokratenstadt | rechnerisch etwa ein Drittel | rechnerisch etwa ein Drittel | ✅ |
| Startgeld | 20 000 (leicht) bis 10 000 (schwer) | 8 000, dazu 25 800 aus den Belohnungen der Aufgaben. Entschieden: wählbare Schwierigkeit mit Startgeld 20 000 / 15 000 / 10 000 (Paket P1) | 🟡 entschieden, noch offen |

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
| Kanonen setzen in Brand, Feuerwehr | ja | Flammen gibt es nur als Bild, ohne Wirkung | ❌ |
| Arzt heilt Verwundete | ja | Soldaten heilen überall im eigenen Gebiet von selbst | ❌ |
| Piraten | Nest auf einer Insel (lässt sich zerstören), Bestechung gegen andere, Nahrung als Geschenk | Schiffe tauchen per Zufall auf und haben keine Heimat; man kann Schutz kaufen oder sie mit Kriegsschiffen und Türmen bekämpfen (3 versenkte Piratenschiffe bringen einen Triumphbogen), aber kein Nest zerstören und sie nicht bestechen | 🟡 |
| Weiße Flagge | friedliche Fahrt | Knopf im Schiffsfenster; Piraten und Gegner lassen das Schiff in Ruhe (M1) | ✅ behoben (M1) |
| Beschädigte Schiffe | fahren langsamer | fahren langsamer (bis zur halben Fahrt, L1) | ✅ behoben (L1) |
| Bäume fällen, Aufstellung | Soldaten roden die Schusslinie frei und stellen sich in einer Reihe auf | Spielregeln da (M1: fällen, Reihe/Block), Knöpfe kommen mit U4 | 🟡 |
| Mehrere Einheiten wählen | Rahmen aufziehen, Gruppen, Patrouille | nur der Knopf „+N in der Nähe“; Schiffe nur einzeln | 🟡 |
| Ausmustern | per Knopf | Spielregel da (M1, ohne Sold), Knopf kommt mit U4 | 🟡 |
| Diplomatie | Handels- und Friedensvertrag; Krieg aus einem Anlass (Siedeln auf fremder Insel, Blockade) | nur Krieg und Frieden; die Gegner erklären Krieg nach Zeit, Stärke und Zufall | 🟡 |
| Krieg und Handel | Blockaden stören den Handel | kein Einfluss; Waffen sind sofort beim Händler zu kaufen | 🟡 |
| Heer in der Bilanz | sichtbar | im „Unterhalt“ versteckt | 🟡 |
| Gegner ohne Land | wird zum Piraten | sitzt für immer still herum und gilt nicht als besiegt | 🟡 |
| Vorwarnung vor Krieg | keine | 3 Minuten Vorwarnung mit Rat, was man bauen sollte | ⭐ |
| Nach dem Verlust von allem | Spiel verloren | neues Schiff und 40 Minuten Ruhe | ⭐ |

### 2.4 Bedienoberfläche im Vergleich zu 1602

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Baumenü | alle Kategorien und der Abriss-Hammer sind immer sichtbar | zeigt nur Nutzbares ⭐. Die Spalte war zu lang; seit U1 ist sie ab 8 Knöpfen zweispaltig (44 × 44, nur Symbol, Name oben im Baumenü), „Abreißen“ ist ein fester Knopf 💥 oben | ✅ behoben (U1) |
| Steuerfenster | Tipp auf ein Haus zeigt die Steuer der Stufe | fehlt (siehe 2.2) | ❌ |
| Kontor- und Lagerfenster | getrennte Ansichten | eine sehr lange Spalte; die Händlerliste steht vor Lager und Bilanz | 🟡 |
| Warenleiste oben | zeigt die wichtigen Werte | bis zu 23 Symbole (am Anfang nur die gerade nötigen) ohne Namen, nur 5–10 gleichzeitig sichtbar; seit U1 zeigt ein Verlauf am Rand das Weiterwischen an; leere Waren werden nicht rot | 🟡 |
| Schiff beladen | Laden je Ware, Routen | Einladen mit +10 / +50 / Max (U1), Ausladen nur „alles“ (jetzt ganz oben im Schiffsfenster) | 🟡 |
| Wohnhäuser bauen | ganze Wohnblöcke zügig | jedes Haus einzeln, 2 Tipps je Haus | 🟡 |
| Abreißen | einen Bereich aufziehen | Feld für Feld, Rückfrage bei jedem Gebäude | 🟡 |
| Kontor abreißen, Insel aufgeben | geht, wenn sonst nichts mehr auf der Insel steht | geht nie | 🟡 |
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
| Rückgängig | (in 1602: Spielstand laden) | zweimal tippen baut sofort; es gibt kein Rückgängig | ❌ |
| Zoomen mit einer Hand | – | Seit U1: Knöpfe + / − und Kompass 🧭 (antippen = Norden oben, lang drücken = zum Kontor), Doppeltipp zoomt, Mausrad zoomt zum Zeiger | ✅ behoben (U1) |
| Hochformat | – | das Spiel läuft hinter dem Hinweis weiter | 🟡 |
| Figuren antippen | – | beim Herauszoomen winzig; die Tippfläche wird in Spielfeldern gemessen statt in Fingerbreite | 🟡 |
| Start ohne Internet | – | früher Schriften von Google; seit U1 sind die Schriften eingebettet, das Spiel startet ohne Internet | ✅ behoben (U1) |
| Symbol auf dem Home-Bildschirm | – | fehlt | ❌ |
| Größe, Start, Hintergrund | – | 887 KB, Start in etwa 2,5 s; speichert beim Verlassen; der Ton startet nach der ersten Berührung | ✅ |

### 2.6 Grafik und Details

*Dreiecke* sind die kleinen Flächen, aus denen ein 3D-Modell besteht. Mehr Dreiecke bedeuten mehr Details.

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Details der Gebäude | handgezeichnet, sehr detailreich | beim Abgleich einfache Formen aus Code (etwa 150 Dreiecke je Gebäude). **Seit 31.10.2026:** 34 Gebäudearten als realistische Meshy-Modelle mit echten Oberflächen (Wohnhäuser etwa 7 000 Dreiecke, Einzelgebäude bis etwa 30 000); 14 weitere Modelle waren unbrauchbar und kommen später neu (Liste in `docs/OFFEN.md`), dort gelten bis dahin die Code-Modelle | 🟡 besser, noch nicht vollständig |
| Jedes Gebäude erkennbar | ja | Kirche, Hochschule, Theater, Schule, Wirtshaus, Kapelle, Betriebe, Plantagen, Werkstätten, Werft, Türme und Burgen haben jetzt eigene Meshy-Modelle; Badehaus, Marktplatz und 12 weitere noch ein Code-Modell | 🟡 |
| Fünf Haustypen | 5 | fünf verschiedene Häuser (seit G1 im Code, seit 31.10.2026 als Meshy-Modelle) | ✅ |
| Kontor I–IV | sichtbar größer | sehen gleich aus | ❌ |
| Stil (deine Regeln 2 und 6) | – | kantig („Low Poly“, also stark vereinfachte, kantige Formen); Bäume aus wenigen Kegeln und Kugeln | 🟡 |
| Rauchende Schornsteine | ja | der Rauch ist fertig programmiert, aber nicht angeschlossen | ❌ |
| Leben auf den Straßen | Marktkarren, Arbeiter, Tiere | Karren, Holzfäller, Jäger, Fischerboote und Tiere ✅ (Tiere laufen, bleiben stehen und grasen; Arbeiter gehen mit schwingenden Beinen; Karren, Boote und Schiffe gleiten ohne Sprünge); Bewohner in der Stadt fehlen (in modernen Anno-Teilen sind es viele) | 🟡 |
| Man sieht, wer arbeitet | an vielen Betrieben | nur an Mühle (dreht sich immer), Holzfäller, Jäger und Fischer | 🟡 |
| Felder und Weiden | sichtbar, wachsen und werden geerntet | unsichtbar (nur farbige Streifen am Hof) | ❌ |
| Bauen | das Gebäude steht sofort (soweit bekannt) | genauso | ✅ (Idee: kurze Bau-Animation) |
| Farbe des Besitzers | Fahnen in der Spielerfarbe | Fahne in der Besitzerfarbe auf Kontor, Marktplatz, Werften, Burgen, Festung, Türmen, Triumphbogen und Schiffen; alle anderen Gebäude tragen einen kleinen Wimpel in der Besitzerfarbe (01.11.2026; vorher waren die Fahnen der Gebäude durch einen Fehler schwarz) | ✅ |
| Landschaft | gezeichnete Kacheln | echte Höhen, Wind in Bäumen und Gras, Nebel über Unentdecktem | ⭐ |
| Berge | klar gezeichnet | verschwommen; verdecken Gebäude am Fuß des Berges | 🟡 |
| Nord- und Südinseln | im Süden Palmen und eigene Farben | sehen gleich aus | ❌ |
| Wasser | Wellen, Küste | schöne Farben und Schaum an der Küste ⭐; aber zu glatt, das Kielwasser ist einfach, am Kartenrand gibt es eine harte Kante | 🟡 |
| Licht und Himmel | – | echter Himmel und weiche Schatten ⭐; keine Wolkenschatten, Möwen sind nur zu hören, Schatten flimmern beim Verschieben | 🟡 |
| Wege | Feldweg und Pflaster sehen verschieden aus | flache, einfarbige Kacheln | 🟡 |
| Gebäude im Gelände | stehen im Boden | stehen auf sichtbaren Platten wie Kacheln eines Brettspiels | 🟡 |
| Menschen | kleine, lebendige Figuren | Soldaten sehr detailreich ⭐; Arbeiter haben jetzt Beine und gehen sichtbar, sind aber noch sehr einfache Figuren (aus Zylinder und Kugel) | 🟡 |
| Schiffe | gut zu unterscheiden | Masten, gewölbte Segel, Schaukeln, Untergang ⭐; Handels- und Kriegsschiff gleicher Größe sehen aber gleich aus, die Segel bewegen sich nicht | 🟡 |
| Kampf | kleine Bilder | Mündungsfeuer, Kugeln im Bogen, Rauch, Feuer, Lebensbalken, sinkende Schiffe | ⭐ |
| Rohstoffe sichtbar | nur Dekoration | Fischschwärme, Wild und fallende Bäume zeigen den echten Bestand | ⭐ |
| Katastrophen | Brände, Sensenmann über dem Haus, vertrocknete Felder | fehlen (es gibt die Ereignisse noch nicht) | ❌ |
| Wale, Delfine, Ruinen | ja (Wale und Delfine erst in der Erweiterung) | fehlen | ❌ |
| Modelle von Meshy | – | 34 Gebäudearten und 2 Schiffe (Handels- und Kriegsschiff, Piraten dunkel) im Spiel; die Mühle dreht ihre Flügel; Menschen, Tiere, Bäume und Bewegungen fehlen noch | 🟡 |

### 2.7 Geschwindigkeit und Flüssigkeit (Performance)

| Punkt | 1602 / Ziel | Neue Ufer | Status |
|---|---|---|---|
| Spielrechnung | flüssig auch bei 4-fachem Tempo | unter 1 ms je Schritt bei 570 Gebäuden; im großen Gefecht mit 115 Soldaten etwa 5 ms | ✅ |
| Speicher | stundenlang stabil | Speicherleck der Schiffsroute und Aufräumen bei „Neues Spiel“ behoben (R1). Meshy-Modelle werden erst geladen, wenn sie gebraucht werden, jede Datei nur einmal; Oberflächenbilder verkleinert (alle Modelle zusammen ≈ 227 statt ≈ 640 MB Grafikspeicher) | ✅ (iPhone-Test fehlt) |
| Bäume und Gras | nur zeichnen, was man sieht | die Pflanzen ganzer Inseln werden immer gezeichnet, 5- bis 8-mal mehr als nötig | 🟡 |
| Anpassung ans Gerät | – | automatische Qualität (Auflösung und Schatten passen sich der Bildzeit an), in Pause und Menü wird nur bei Änderung gezeichnet (R1) | ✅ (iPhone-Test fehlt) |
| Bauen im Wald, Erkunden, Wege bauen | nur die betroffene Stelle neu zeichnen | jedes Mal werden alle Pflanzen und Bodenfarben neu aufgebaut (20–45 ms, ein spürbarer Ruckler), auch wenn die Gegner bauen | 🟡 |
| Daten zur Grafikkarte | – | etwa 1,3 MB je Bild, auch wenn nichts passiert | 🟡 |
| Gefechte hinter Mauern | – | Soldaten suchen immer wieder Wege, die es nicht gibt | 🟡 |
| Große Stadt | – | jedes Gebäude ist ein eigener Befehl an die Grafikkarte; mit detailreichen Meshy-Modellen wird das riskant | 🟡 |
| Computergegner | – | alle denken im selben Augenblick (kleine Ruckler, am Anfang ein Stoß bis 89 ms) | 🟡 |
| Erster Gebrauch | – | Teile der Grafik werden erst beim ersten Bauen oder Kampf vorbereitet (kurzer Ruckler) | 🟡 |
| Automatisches Speichern | – | 1,2 MB alle 20 s, auch ohne Änderung; Fehler bleiben unbemerkt | 🟡 |
| Größe der App | klein | Spiel ≈ 1,2 MB (mit dem Modell-Lader) plus Meshy-Modelle ≈ 18 MB, die nur bei Bedarf nachgeladen werden | ✅ |
| Test auf dem iPhone | nötig | fehlt noch; bisher nur am PC gemessen | – |

### 2.8 Übersicht und Spielfluss

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Warnungen bei Problemen | Fragezeichen, Gesichter | Symbole über einzelnen Gebäuden ✅; aber keine Meldung bei Warenmangel, Hunger, Auszug oder Minus in der Kasse | 🟡 |
| Statistik | Fenster mit Bevölkerung, Waren und Bilanz | fehlt | ❌ |
| Bevölkerung im Überblick | Stimmung je Stufe | nur Zahlen je Stufe (alle Inseln zusammen); was fehlt, sieht man nur Haus für Haus | ❌ |
| Meldungen | Meldungszeile, Sprung zum Ort des Geschehens | kurze Einblendungen (höchstens 3, nach wenigen Sekunden weg), kein Verlauf, kein Sprung | ❌ |
| Übersichtskarte | immer am Rand sichtbar | nur eine große Karte als eigenes Fenster: hält das Spiel an, zeigt keine Inselnamen, kein Erz und kein Gold | 🟡 |
| Meine Schiffe und Inseln | schnell zu wählen, umbenennbar | keine Liste, kein Sprung, kein Umbenennen | ❌ |
| Spielstände | mehrere | nur einer. „Neues Spiel“ im Verloren-Fenster fragt seit U1 nach; ein unlesbarer Spielstand wird seit L1 gesichert statt überschrieben (Version 4 enthält die ganze Inselwelt); Fehler beim Speichern bleiben unbemerkt | 🟡 (mehrere Spielstände: Paket P1) |
| Einstellungen für ein neues Spiel | Schwierigkeit, Startbedingungen, Optionen | nur die Zahl der Gegner. Entschieden: Schwierigkeit leicht / normal / schwer wählbar (Paket P1) | 🟡 entschieden, noch offen |
| Spielstart | Schiff in einer unbekannten Welt | gleich ✅; aber kein Land in Sicht und kein Hinweis auf die Richtung | 🟡 |
| Anleitung | Lehrgang in mehreren Teilen | war ein langes Textfenster; seit U1 drei kurze Karten (Segeln, Kontor, Bauen) plus „Mehr Hilfe“, der Hauptknopf sitzt fest unten | ✅ behoben (U1) |
| Symbole über Gebäuden | ein Fragezeichen | 7 klare Symbole für die Ursache ⭐; aber ohne Dringlichkeit, in der Krise ein Haufen Symbole | 🟡 |
| Aufgaben | die Ziele lassen sich jederzeit anzeigen | streng nacheinander, nur eine sichtbar; „Wehrhaft“ verlangt die Burg schon vor den Bürgern und kann lange hängen | 🟡 |
| Erz, Gold, Fruchtbarkeit | Symbole auf entdeckten Inseln | nur im Insel-Fenster nach dem Antippen | 🟡 |
| Zeit | Pause, Tempo | Pause und 1x/2x/4x ✅; keine Anzeige der Spielzeit, die Pause ist kaum zu erkennen | 🟡 |
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
| Ureinwohner | Dörfer, Tausch Ware gegen Ware (etwa 1 : 1,5), Fluch bei Angriff | fehlen ganz | ❌ |
| Feuer | Brände springen über, die Feuerwehr löscht | fehlt | ❌ |
| Pest, Kriminalität | Arzt, Galgen | fehlen | ❌ |
| Dürre, Schatz, Vulkan | ja (Vulkan in der Erweiterung) | fehlen | ❌ |
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
2. **Der Wirtschaft fehlen die Stellschrauben von 1602:** kein einstellbarer Steuersatz, kein Bankrott, Hunger und Mangel haben kaum Folgen, Betriebe für Luxuswaren versorgen nur ¼ bis ⅓ so viele Bewohner. → L2, U2
3. **Computergegner:** Ihre Wirtschaft kam nicht in Gang und rutschte ins Minus (behoben in KI1), sie bleiben bei den Siedlern auf einer Insel, handeln nicht und sind im Krieg kaum eine Gefahr. → KI1, KI2, M2
4. **Handel:** Es gibt nur einen Sofort-Knopf am Kontor, keine Händlerschiffe mit Aufträgen und keine Handelsrouten. Wirtschaften mit mehreren Inseln, der Kern von 1602, wird so mühsam. → S2, U5
5. **Kein Überblick:** keine Statistik, keine Warnung bei Mangel, Meldungen verschwinden nach Sekunden, keine Übersichtskarte, keine Liste der Schiffe und Inseln. → S1, U2, U3
6. **Die Stadt-Grafik liegt unter 1602:** einfache Formen, 27 Gebäudearten ohne eigenes Aussehen, kein Rauch, keine Felder, keine Bewohner; Nord- und Südinseln sehen gleich aus. → G1, G2, G3, G3b, G4a (und Meshy)
7. **Ganze Bereiche von 1602 fehlen:** Ureinwohner, Feuer, Pest, Kriminalität, Dürre, Prachtbauten, Piratennest, Endwertung, Szenarien. → S3, S4, L3, M2, S5, F2
8. **Die Grafik-Leistung ist nicht abgesichert:** Die Pflanzen ganzer Inseln werden immer gezeichnet, Bauen im Wald ruckelt, die Grafik passt sich nicht ans Gerät an und zeichnet auch in der Pause voll weiter. → R1, R2
9. **Warenwege einfacher als in 1602:** Felder entstehen unsichtbar von selbst, Wald lässt sich nicht pflanzen, Rohstoffe „springen“ in die Werkstatt, Marktplätze bringen kaum etwas. → L2, L4
10. **Die Welt ist kleiner und gleichförmiger:** Inseln eine Größenklasse kleiner, keine Flüsse und keine Steppe, Start immer unten links. → L5

## 5. So geht es weiter

Die Schwächen sind auf 35 Arbeitspakete verteilt (die Buchstaben zeigen den Bereich: L = Spielregeln und Spielwelt, U = Oberfläche und Bedienung, KI = Computergegner, M = Kampf, S = neue Spielteile wie Statistik, Handel, Ereignisse, Ureinwohner und Endwertung, G = Grafik, R = Flüssigkeit der Grafik, P = Spielstart und Spielstände, A = Klänge, F = Feinschliff, D = Unterlagen). Zu jedem gibt es eine eigene Liste mit Einzelschritten und Dateien. Die Pakete laufen in vier Wellen. Innerhalb einer Welle können mehrere Helfer gleichzeitig arbeiten.

| Welle | Inhalt | Pakete |
|---|---|---|
| 1 – Fehler & Spielgefühl | Fehler beheben, Schiff wie gewünscht, Stolpersteine auf dem Handy weg, Wirtschaft der Gegner reparieren, Grafik-Leistung, Fehler an Gebäuden, Unterlagen bereinigen | L1 ✔, U1 ✔, KI1 ✔, R1 → R2, G1, D1 (diese Fassung) |
| 2 – Kern von 1602 | Steuern, Bankrott und Kosten; Statistik und Warnungen; Händlerschiffe und Routen; Kampfregeln; Gegner wachsen; die passenden Fenster; Gebäude neu gestalten; Rauch, Fahnen und Symbole; Plan für Meshy | L2, S1, S2, M1, KI2, U2–U5, G2, G3, G5a |
| 3 – fehlende Inhalte | Katastrophen, Ureinwohner, Endwertung, Prachtbauten, Felder, Förster und Anlieferung, Piratennest und Diplomatie, Spielstart und Spielstände, sichtbare Bewohner und Felder, Landschaft, Wasser und Licht, Klänge | S3, S4, S5, L3, L4, M2, P1, G3b, G4a, G4b, A1 |
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
| 1 | **Steuern wie 1602** | Ein Regler je Stufe mit den Höchstsätzen des Originals (Pioniere 48 %, Siedler 45 %, Bürger 38 %, Kaufleute 36 %, Aristokraten 35 %). Zu hohe Steuern machen unzufrieden bis zum Auszug. Flache Steuerkurve (Aristokrat etwa 1,4 × Pionier statt 6 ×). Die Gesamteinnahmen werden so eingestellt, dass das Spiel nicht schwerer wird. | L2, U2 | offen |
| 2 | **Wirtschaftstempo wie 1602** | Betriebe werden so beschleunigt, dass einer wieder 60 bis 100 % so viele Bewohner versorgt wie im Original (heute bei Luxuswaren nur ¼ bis ⅓). | L2 | offen |
| 3 | **Felder automatisch** | Eine Farm oder Plantage legt beim Bau automatisch sichtbare Felder an (5 Taler je Feld); sie reifen erst. Ein Feld-Werkzeug dient zum Nachbessern. | L4, G3b | offen |
| 4 | **Grafik** | Zuerst sichtbare Fehler im Code beheben (G1), dann eine Meshy-Probe mit 3 Modellen (Wohnhaus, Kontor, Schaf). Nach Freigabe werden alle Modelle mit Meshy erzeugt; im Code wird nur nachgebaut, was Meshy nicht liefert. Der Schlüssel `MESHY_API_KEY` kommt vom Nutzer in die Umgebungs-Einstellungen, nie in den Chat. | G1, G5a, G5b | Probe ist im Projekt (Haus, Kontor, Schaf); Freigabe und Einbau offen |
| 5 | **Schwierigkeit wählbar** | leicht / normal / schwer mit Startgeld 20 000 / 15 000 / 10 000. Standard „normal“: Gegner wachsen bis Kaufleute, besiedeln 2 bis 3 Inseln und greifen nach Vorwarnung an. Katastrophen standardmäßig „mild“. | P1, KI2, S3 | offen |
| 6 | **Inselgrößen wie 1602** | Fünf Größenklassen, größere Welt, beim Start wählbar. Erst nach der Arbeit an der Grafik-Leistung (R1, R2) und einem Test auf dem iPhone des Nutzers. | L5 | offen, zuletzt |

Bis zum Test auf dem iPhone bleibt die heutige Weltgröße (eine Größe, `WORLD_SIZES` in `src/world.ts`).
