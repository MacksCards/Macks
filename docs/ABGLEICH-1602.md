# Abgleich mit 1602: „Neue Ufer“, Stand 31.10.2026

*Alle Einzelbefunde mit Belegen und Umsetzungsvorschlägen: `docs/recherche/abgleich-befunde.json`. Die Umsetzung läuft in Arbeitspaketen (siehe Abschnitt „Arbeitspakete“ bzw. docs/OFFEN.md).*

**Zeichen in den Tabellen:** ✅ wie in 1602 · 🟡 anders oder nur teilweise · ❌ fehlt · ⭐ besser als 1602 · **Fehler** = funktioniert nicht richtig

**Grundlage:** die Inhaltsliste von 1602 (docs/1602-INHALT.md mit den Recherchen), der Programmcode und viele Tests: Simulationen über mehrere Spielstunden, Hunderte Zufallswelten und Browser-Tests im iPhone-Querformat (852 × 393 Punkte, mit Touch). Was du bewusst anders willst, zählt nicht als Mangel: Schweinezucht statt Rinderfarm, Steine statt Ziegel, eine Weberei, die Brauerei und das schnellere Spiel.

---

## 1. Kurzfazit

**Passt schon alles 1:1? Noch nicht.**

- **Die Zahlen stimmen sehr gut.** Bei allem, was schon im Spiel ist, entsprechen Kosten, Unterhalt, Reichweiten, Freischaltungen, Verbrauch, Kampfwerte, Schiffe und Preise zu über 90 % dem Original.
- **Der Spielablauf ist erst gut zur Hälfte da.** Es fehlen wichtige Stellschrauben (Steuersatz, Bankrott) und ganze Bereiche (Ureinwohner, Katastrophen, Handelsrouten, Prachtbauten, Endwertung). Die Computergegner sind noch schwach.
- **Die Grafik ist gemischt.** Landschaft, Wasser und Kampf sind schon schöner als in 1602. Die Gebäude der Stadt liegen dagegen noch *unter* dem Niveau von 1602.

| Bereich | Nähe zu 1602 (Schätzung) | Warum |
|---|---|---|
| Spielumfang & Inhalt | ≈ 65 % | Stufen, Waren, Ketten, Gebäudezahlen, Schiffe und Militär sind 1:1 da. Es fehlen Ureinwohner, Katastrophen, Prachtbauten, Handelsrouten, Endwertung und Szenarien. |
| Wirtschaft | ≈ 55 % | Kein Steuersatz, kein Bankrott, Häuser verfallen nie. Ein Betrieb versorgt nur ¼ bis ⅓ so viele Bewohner wie in 1602. Handel nur per Sofort-Knopf. Fehler bei vollem Lager. |
| Krieg | ≈ 65 % | Kampfwerte und Eroberung sind 1:1. Aber die Gegner sind kaum eine Bedrohung, es gibt kein Feuer, kein Piratennest und keine Auswahl mehrerer Einheiten, und Tore trennen das Wegenetz. |
| Bedienoberfläche | ≈ 55 % | Die Infos sind klarer als in 1602. Steuerfenster, Statistik, Meldungsverlauf, Übersichtskarte und Schiffsliste fehlen; das Baumenü passt nicht auf den Bildschirm. |
| Bedienung auf dem Handy (gemessen am Ziel) | ≈ 65 % | Gute Grundlage. Aber mehrere wichtige Knöpfe liegen unter dem Bildrand, die Hinweisleiste schluckt Tipps, es gibt kein Rückgängig. Schiff-auf-Land ist nur halb gelöst. |
| Grafik & Details (Ziel: schöner als 1602) | ≈ 45 % | Landschaft, Wasser und Kampf ⭐. Die Gebäude sind noch einfache Formen, es gibt keinen Rauch, keine Felder und keine Bewohner. |
| Performance (gemessen am Ziel) | ≈ 70 % | Die Spielrechnung ist sehr sparsam. Die Grafik zeichnet zu viel, es gibt ein Speicherleck und keine Anpassung ans Gerät. Noch nie auf einem echten iPhone gemessen. |
| Übersicht & Spielfluss | ≈ 50 % | Die Infos zu einzelnen Gebäuden sind ⭐. Das Gesamtbild fehlt: Statistik, Warnungen, Ziele, mehrere Spielstände. |
| Inselwelt, Computergegner, Ereignisse | ≈ 35 % | Der Weltgenerator ist sehr verlässlich. Aber die Wirtschaft der Gegner bricht ein und sie bleiben klein; Ureinwohner und alle Katastrophen fehlen. |
| **Gesamt** | **≈ 55 %** | |

Die Prozente sind eine grobe Schätzung: Wie viel vom Spielgefühl von 1602 ist in diesem Bereich schon da? Wichtige Punkte zählen mehr.

> **Dein Beispiel: Schiff auf eine Insel tippen.** Seit dem letzten Stand fährt das Schiff bei einem Tipp auf Land an die Küste, aber nicht ganz so, wie du es willst:
> - Es fährt zum Küstenwasser, das dem angetippten Punkt am nächsten liegt. Tippst du mitten auf eine Insel, kann es deshalb um die halbe Insel fahren.
> - Tippst du auf ein eigenes Gebäude, wird das Gebäude ausgewählt, statt hinzusegeln.
> - Findet es zu genau diesem Punkt keinen Weg, bleibt es stehen.
> - Im Nebel verrät die Meldung „Kurs zur Küste“, dass dort Land ist.
>
> **Das wird zuerst behoben (Pakete L1 und U1):** Das Schiff fährt in Tipp-Richtung, so weit es kommt, und hält an der zugewandten Küste. Nur wenn das nicht geht, fährt es zur nächsten erreichbaren Küste.

**Schon besser als 1602:** Rohstoffe, die sichtbar nachwachsen. Klare Info-Fenster („was fehlt und warum“). Wege per Tippen mit automatischem Umweg. Eine faire Vorwarnung vor Kriegen. Weiterspielen nach einer Niederlage. Landschaft, Wasser und Kampfgrafik.

**Ehrlicher Hinweis:** Alle Zeiten wurden auf einem PC gemessen, mit Ersatz-Grafik. Auf dem iPhone dauern die Rechnungen etwa 2- bis 3-mal so lange. Ein Test auf deinem iPhone fehlt noch.

---

## 2. Punkt für Punkt

### 2.1 Spielumfang & Inhalt

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Fünf Bevölkerungsstufen | Pioniere bis Aristokraten; je Stufe sind Waren und Gebäude Bedingung | gleich; Bedingungen und Schwellen gelten wie im Original je Insel | ✅ |
| Waren | 23 Waren | alle 23 | ✅ |
| Verbrauch | Werte des Originals | genau Original × 8 (das Spiel läuft schneller) | ✅ bewusst schneller |
| Zahlen der Gebäude | rund 60 Gebäude mit Kosten, Unterhalt, Reichweite, Freischaltung | rund 45 Gebäude mit genau diesen Zahlen. Kleinigkeiten weichen ab: Kanonengießerei erst ab 300 Kaufleuten (Original: 400 Bürger, zusammen mit dem Kanonier), Reichweite Kapelle 9 statt 8 und Jagdhütte 7 statt 8, der Steinbruch kostet Unterhalt | 🟡 fast gleich |
| Grundfläche der Gebäude | viele Gebäude länglich (z. B. Marktplatz 4 × 3); das Wohnhaus belegt vermutlich nur 1 Feld (Quelle unsicher) | alle Gebäude quadratisch, Wohnhaus 2 × 2. Falls das Original 1 Feld hat, versorgen Kapelle & Co. nur ein Viertel so viele Häuser | 🟡 prüfen |
| Freischalt-Reihenfolge | 30 Pioniere bis 600 Aristokraten | gleich | ✅ |
| Schiffe | 5 Typen, Laderaum, Kanonen, höchstens 20 | gleich, dazu +1 je Triumphbogen | ✅ |
| Kontor I–IV | 30 / 50 / 75 / 100 t Lager | gleich | ✅ |
| Feuerwehr, Arzt, Galgen | Schutz gegen Feuer, Pest und Verbrechen | fehlen (zusammen mit den Katastrophen, siehe 2.9) | ❌ |
| Prachtbauten | Palast, Kathedrale, Denkmal, Zierbaum | fehlen; nach dem Theater haben Aristokraten kaum noch Ziele | ❌ |
| Plätze, Brücken, Anlegesteg | Plätze I–III, Holz- und Steinbrücken über Flüsse, Steg | fehlen; nur Feldweg und Pflasterweg, keine Flüsse | ❌ |
| Ureinwohner | Dörfer, Tauschhandel, Fluch | fehlen (siehe 2.9) | ❌ |
| Punkte und Endwertung | Punkte für Einwohner, Kasse und Siege; Endwertung | fehlen; ein Sieg beendet das Spiel nicht, er schaltet nur den Triumphbogen frei | ❌ |
| Szenarien | 26 Szenarien (+20 in der Erweiterung) | keine; nur das freie Spiel mit 24 Aufgaben | ❌ |
| Mehrspieler, Karteneditor | ja (Editor in der Erweiterung) | fehlen, und sie stehen nicht als bewusste Abweichung in den Unterlagen | ❌ |
| Rohstoffe wachsen nach | Wald nur über den Förster, Bestände unsichtbar | Bäume, Fische, Wild und Weide verbrauchen sich sichtbar und wachsen nach; Nachbarn teilen sich den Rohstoff; beim Bauen zeigt eine Skala die Ergiebigkeit | ⭐ |
| Hilfe für Einsteiger | Handbuch | 24 Aufgaben mit Belohnung führen durch alle Ketten | ⭐ |

### 2.2 Wirtschaft: Zufriedenheit, Steuern, Bilanz, Kosten, Handel

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Steuersatz | je Stufe einstellbar (Höchstsätze 48 % bis 35 %), Gesichter zeigen die Stimmung; das wichtigste Werkzeug fürs Geld | fest, kein Regler | ❌ |
| Steuer je Einwohner | flach: ein Aristokrat zahlt etwa 1,4-mal so viel wie ein Pionier | steil: 6-mal so viel. Pioniere zahlen die Hälfte des Originals, Aristokraten mehr als das Doppelte (nirgends begründet) | 🟡 |
| Hunger und Unzufriedenheit | Hunger macht unzufrieden, Bewohner ziehen aus, das Haus verfällt | Zufriedenheit, Steuer und Aufstieg sinken. Aber ab den Siedlern zieht wegen Hunger allein niemand aus, und Häuser steigen nie ab | 🟡 |
| Bankrott | lange tief im Minus (etwa −10 000 Taler): Spiel verloren | Schulden haben keine Folgen außer einer roten Zahl und gesperrten Käufen | ❌ |
| Einwohner je Betrieb | z. B. Weberei-Kette 283, Weingut 167, Schneiderei 457 Einwohner | nur ¼ bis ⅓ davon: Der Verbrauch ist 8-mal so schnell, die Herstellung nur 2- bis 3-mal. Man braucht etwa 3-mal so viele Betriebe | 🟡 |
| Unterhalt im Betrieb und in Ruhe, Betrieb abschalten | ja (z. B. Weingut 35 im Betrieb, 15 in Ruhe) | ein fester Betrag, nichts lässt sich abschalten; Werften zahlen nur den Ruhebetrag | 🟡 |
| Baumaterial an Bewohner sperren | Schalter am Kontor | fehlt; das Lager kann dabei sogar unter null fallen | ❌ |
| Lager voll | der Betrieb hält an, nichts geht verloren | **Fehler:** Karren liefern weiter, die Ware verschwindet still, und der Betrieb meldet weiter „arbeitet“ | 🟡 Fehler |
| Lager und Freischaltungen je Insel | ja | gleich | ✅ |
| Kosten für den Haus-Aufstieg | Tabelle | gleich | ✅ |
| Marktkarren | holen im Umkreis von 6 Feldern ums Kontor ab; Marktplätze nahe den Betrieben beschleunigen den Transport | sichtbare Karren ✅, auf Pflaster schneller ✅. Sie holen aber im ganzen Gebiet (16 Felder) ab, deshalb bringen Marktplätze dafür kaum etwas | 🟡 |
| Felder | einzeln um Farm oder Plantage angelegt (5 Taler), müssen reifen | jede freie Wiese im Umkreis zählt unsichtbar und sofort reif als Feld und zugleich als Weide | 🟡 |
| Wald pflanzen | der Förster pflanzt neu | niemand pflanzt; gerodeter Wald kommt nie zurück (die Unterlagen behaupten fälschlich „gleicher Effekt“) | 🟡 |
| Rohstoffe zu den Werkstätten | Karren liefern an; der Weber holt die Wolle direkt beim Nachbarn | Rohstoffe „springen“ ohne Weg aus dem Lager in die Werkstatt; der Standort spielt keine Rolle | 🟡 |
| Erz | Vorkommen 80 oder 240 t; die tiefe Mine baut den Rest ab | die normale Mine stimmt; die tiefe Mine fördert endlos | 🟡 |
| Wachstum | allmählich | ein Haus kann in unter 5 Minuten zur vollen Aristokratenvilla werden | 🟡 |
| Freier Händler | kommt mit dem Schiff und handelt nach deinen Aufträgen (Ware, Menge, Preis); Zahl der Plätze je Kontorstufe; verkauft nur, was jemand hergestellt hat (Ausnahme: Werkzeug, Erz) | Sofort-Knopf ±5 t am Kontor, feste Preise, verkauft alles, auch Kanonen und Schmuck | 🟡 |
| Handelsrouten | Schiffe fahren automatisch zwischen Kontoren | fehlen; Einladen nur von Hand in 10-t-Schritten, Ausladen nur „alles“ | ❌ |
| Handel mit Computergegnern | direkt, günstiger als beim Händler; Handelsvertrag | fehlt | ❌ |
| Bilanz | Einnahmen und Ausgaben nach Arten | nur „Steuern“ und „Unterhalt“ (die Kosten des Heeres sind darin versteckt), kein Handel, kein Verlauf | 🟡 |
| Waren-Statistik | Erzeugung und Verbrauch je Ware | fehlt; Raten stehen nur einzeln am Betrieb | ❌ |
| Händlerpreise | Preistabelle | etwa 90 % davon, Kauf zu Verkauf etwa 3 : 2 | ✅ |
| Preis für Frieden und für Schutz vor Piraten | richtet sich nach dem Vermögen | gleich | ✅ |
| Gewinn einer Aristokratenstadt | etwa 32 % | etwa 32 % | ✅ |
| Startgeld | 20 000 (leicht) bis 10 000 (schwer) | 8 000, dazu 25 800 aus den Belohnungen der Aufgaben | 🟡 |

### 2.3 Krieg und seine Auswirkungen

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Kampfwerte | Soldaten, Türme, Burgen, Schiffe | 1:1 übernommen | ✅ |
| Gefechte | der Turm schießt zuerst; ein Steinturm braucht etwa 8 Kanoniertreffer | passt im Test; zusätzlich gehen 15–25 % der Schüsse daneben (steht nicht in den Unterlagen) | ✅ |
| Deckung | Kanoniere und Musketiere schießen nicht durch Wald | gleich | ✅ |
| Seeschlacht, Truppentransport, Eroberung | fällt Kontor oder Marktplatz, wechselt die Insel den Besitzer | gleich und funktioniert (im Test fiel ein KI-Kontor samt 48 Gebäuden) | ✅ |
| Triumphbogen | nach einem Sieg | gleich, dazu +1 Schiff | ✅ |
| Computergegner im Krieg | bauen Burgen, Waffenketten und Flotten und greifen an | nur 2–4 Soldaten; Krieg erst nach etwa 90 Minuten und nur bei klarer Überlegenheit; Angriffe sind selten | 🟡 schwach |
| Mauern und Tore | das Tor sitzt im Weg, Karren fahren hindurch | **Fehler:** Das Tor trennt das Wegenetz und lässt sich nicht auf einen Weg setzen. Das kleine Tor fehlt, das Stadttor kostet 3 statt 4 Steine | 🟡 Fehler |
| Kanonen setzen in Brand, Feuerwehr | ja | Flammen gibt es nur als Bild, ohne Wirkung | ❌ |
| Arzt heilt Verwundete | ja | Soldaten heilen überall im eigenen Gebiet von selbst | ❌ |
| Piraten | Nest auf einer Insel (lässt sich zerstören), Bestechung gegen andere, Nahrung als Geschenk | Schiffe tauchen per Zufall auf und haben keine Heimat; man kann nur Schutz kaufen | 🟡 |
| Weiße Flagge | friedliche Fahrt | fehlt | ❌ |
| Beschädigte Schiffe | fahren langsamer | fahren mit voller Fahrt | ❌ |
| Bäume fällen, Aufstellung | Soldaten roden die Schusslinie frei und stellen sich in einer Reihe auf | fehlt | ❌ |
| Mehrere Einheiten wählen | Rahmen aufziehen, Gruppen, Patrouille | nur der Knopf „+N in der Nähe“; Schiffe nur einzeln | 🟡 |
| Ausmustern | per Knopf | fehlt; der Sold läuft ewig weiter | ❌ |
| Diplomatie | Handels- und Friedensvertrag; Krieg aus einem Anlass (Siedeln auf fremder Insel, Blockade) | nur Krieg und Frieden; die Gegner erklären Krieg nach Zeit, Stärke und Zufall | 🟡 |
| Krieg und Handel | Blockaden stören den Handel | kein Einfluss; Waffen sind sofort beim Händler zu kaufen | 🟡 |
| Heer in der Bilanz | sichtbar | im „Unterhalt“ versteckt | 🟡 |
| Gegner ohne Land | wird zum Piraten | sitzt für immer still herum und gilt nicht als besiegt | 🟡 |
| Vorwarnung vor Krieg | keine | 3 Minuten Vorwarnung mit Rat, was man bauen sollte | ⭐ |
| Nach dem Verlust von allem | Spiel verloren | neues Schiff und 40 Minuten Ruhe | ⭐ |

### 2.4 Bedienoberfläche im Vergleich zu 1602

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Baumenü | alle Kategorien und der Abriss-Hammer sind immer sichtbar | zeigt nur Nutzbares ⭐. Aber die Spalte ist zu lang: Militär und Abreißen liegen unter dem Bildrand, ohne Hinweis | 🟡 Fehler |
| Steuerfenster | Tipp auf ein Haus zeigt die Steuer der Stufe | fehlt (siehe 2.2) | ❌ |
| Kontor- und Lagerfenster | getrennte Ansichten | eine sehr lange Spalte; die Händlerliste steht vor Lager und Bilanz | 🟡 |
| Warenleiste oben | zeigt die wichtigen Werte | 23 Symbole ohne Namen, nur 5–10 sichtbar, kein Hinweis aufs Weiterwischen; leere Waren werden nicht rot | 🟡 |
| Schiff beladen | Laden je Ware, Routen | Einladen in 10-t-Schritten, Ausladen nur „alles“ | 🟡 |
| Wohnhäuser bauen | ganze Wohnblöcke zügig | jedes Haus einzeln, 2 Tipps je Haus | 🟡 |
| Abreißen | einen Bereich aufziehen | Feld für Feld, Rückfrage bei jedem Gebäude | 🟡 |
| Kontor abreißen, Insel aufgeben | geht, wenn sonst nichts mehr auf der Insel steht | geht nie | 🟡 |
| Wege und Mauern | mit der Maus ziehen | Start, Ziel, ✓; mit automatischem Umweg und Kostenanzeige | ⭐ |
| Haus- und Betriebs-Info | Gesichter und Fragezeichen | sagt im Klartext, was fehlt und warum | ⭐ |
| Hinweis auf Freischaltungen | (im Handbuch) | Schloss-Karte „ab N …“ ⭐, aber ohne deinen Stand („du hast 23“) und ohne „NEU“-Marke | 🟡 |
| Texte | – | teils veraltet („Weg mit dem Finger ziehen“, „Schiff: tippe aufs Meer“) | 🟡 |
| Bilder im Baumenü | Bilder der Gebäude | Emoji | 🟡 |

Statistik, Meldungen, Übersichtskarte, Schiffsliste und Spielstände stehen in 2.8.

### 2.5 Bedienung auf dem Handy

| Punkt | 1602 / Ziel | Neue Ufer | Status |
|---|---|---|---|
| Schiff: Tipp auf eine Insel (dein Beispiel) | „fährt in die Richtung, so weit es kann“ | fährt an die Küste, aber an die, die dem Tipp am nächsten liegt (eventuell um die halbe Insel). Tipp auf ein eigenes Gebäude wählt das Gebäude aus. Gibt es keinen Weg, gibt es kein Ersatzziel. Im Nebel verrät die Meldung, dass dort Land ist | 🟡 |
| Kerbe (Notch) und Home-Balken | – | werden überall beachtet; im Hochformat erscheint ein Hinweis | ✅ |
| Wischen, Zoomen, Drehen | – | ein Finger schiebt (baut nie aus Versehen), zwei Finger zoomen und drehen ✅. Aber der Zoom wandert etwas weg, schon eine kleine Fingerdrehung dreht die Karte, und die Karte gleitet nach dem Wischen nicht nach | 🟡 |
| Wichtige Knöpfe erreichbar | alles ist sichtbar | „Alles ausladen“, „Los geht's“ und „Schließen“ der Weltkarte liegen unter dem Bildrand, ebenso Militär und Abreißen | 🟡 Fehler |
| Infofenster | am Rand | nimmt ⅓ der Breite ein und verdeckt oft das gewählte Objekt | 🟡 |
| Hinweisleiste beim Bauen | – | sitzt mittig unten und schluckt Tipps genau dort, wo man bauen will | 🟡 |
| Größe von Knöpfen und Schrift | Apple empfiehlt 44 Punkte je Knopf | Knöpfe 34–40, kleinste Schrift 10 px | 🟡 |
| Rückgängig | (in 1602: Spielstand laden) | zweimal tippen baut sofort; es gibt kein Rückgängig | ❌ |
| Zoomen mit einer Hand | – | nur mit zwei Fingern; keine Knöpfe + / −, kein Knopf für Norden | ❌ |
| Hochformat | – | das Spiel läuft hinter dem Hinweis weiter | 🟡 |
| Figuren antippen | – | beim Herauszoomen winzig; die Tippfläche wird in Spielfeldern gemessen statt in Fingerbreite | 🟡 |
| Start ohne Internet | – | wartet auf die Schriften von Google | 🟡 |
| Symbol auf dem Home-Bildschirm | – | fehlt | ❌ |
| Größe, Start, Hintergrund | – | 887 KB, Start in etwa 2,5 s; speichert beim Verlassen; der Ton startet nach der ersten Berührung | ✅ |

### 2.6 Grafik und Details

*Dreiecke* sind die kleinen Flächen, aus denen ein 3D-Modell besteht. Mehr Dreiecke bedeuten mehr Details.

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Details der Gebäude | handgezeichnet, sehr detailreich | noch einfache Formen aus Code: im Schnitt etwa 150 Dreiecke, erlaubt wären 12 000 | 🟡 unter 1602 |
| Jedes Gebäude erkennbar | ja | 27 von 52 Gebäudearten haben kein eigenes Aussehen (die Kirche sieht aus wie ein Wohnhaus) | ❌ |
| Fünf Haustypen | 5 | **Fehler:** nur 3 sichtbar; Kaufleute und Aristokraten wohnen in Bürgerhäusern | 🟡 Fehler |
| Kontor I–IV | sichtbar größer | sehen gleich aus | ❌ |
| Stil (deine Regeln 2 und 6) | – | kantig („Low Poly“, also stark vereinfachte, kantige Formen); Bäume aus wenigen Kegeln und Kugeln | 🟡 |
| Rauchende Schornsteine | ja | der Rauch ist fertig programmiert, aber nicht angeschlossen | ❌ |
| Leben auf den Straßen | Marktkarren, Arbeiter, Tiere | Karren, Holzfäller, Jäger, Fischerboote und Tiere ✅; Bewohner fehlen (in modernen Anno-Teilen sind es viele) | 🟡 |
| Man sieht, wer arbeitet | an vielen Betrieben | nur an Mühle (dreht sich immer), Holzfäller, Jäger und Fischer | 🟡 |
| Felder und Weiden | sichtbar, wachsen und werden geerntet | unsichtbar (nur farbige Streifen am Hof) | ❌ |
| Bauen | das Gebäude steht sofort (soweit bekannt) | genauso | ✅ (Idee: kurze Bau-Animation) |
| Farbe des Besitzers | Fahnen in der Spielerfarbe | nur bei Militär, Schiffen und am Rand des Gebiets; jedes Kontor trägt eine blaue Fahne, auch das der Gegner | 🟡 |
| Landschaft | gezeichnete Kacheln | echte Höhen, Wind in Bäumen und Gras, Nebel über Unentdecktem | ⭐ |
| Berge | klar gezeichnet | verschwommen; verdecken Gebäude am Fuß des Berges | 🟡 |
| Nord- und Südinseln | im Süden Palmen und eigene Farben | sehen gleich aus | ❌ |
| Wasser | Wellen, Küste | schöne Farben und Schaum an der Küste ⭐; aber zu glatt, das Kielwasser ist einfach, am Kartenrand gibt es eine harte Kante | 🟡 |
| Licht und Himmel | – | echter Himmel und weiche Schatten ⭐; keine Wolkenschatten, Möwen sind nur zu hören, Schatten flimmern beim Verschieben | 🟡 |
| Wege | Feldweg und Pflaster sehen verschieden aus | flache, einfarbige Kacheln | 🟡 |
| Gebäude im Gelände | stehen im Boden | stehen auf sichtbaren Platten wie Kacheln eines Brettspiels | 🟡 |
| Menschen | kleine, lebendige Figuren | Soldaten sehr detailreich ⭐; Arbeiter sehen aus wie Holzfiguren | 🟡 |
| Schiffe | gut zu unterscheiden | Masten, gewölbte Segel, Schaukeln, Untergang ⭐; Handels- und Kriegsschiff gleicher Größe sehen aber gleich aus, die Segel bewegen sich nicht | 🟡 |
| Kampf | kleine Bilder | Mündungsfeuer, Kugeln im Bogen, Rauch, Feuer, Lebensbalken, sinkende Schiffe | ⭐ |
| Rohstoffe sichtbar | nur Dekoration | Fischschwärme, Wild und fallende Bäume zeigen den echten Bestand | ⭐ |
| Katastrophen | Brände, Sensenmann über dem Haus, vertrocknete Felder | fehlen (es gibt die Ereignisse noch nicht) | ❌ |
| Wale, Delfine, Ruinen | ja | fehlen | ❌ |
| Modelle von Meshy | – | Anschluss nur für Gebäude (getestet); Menschen, Tiere, Schiffe, Bäume und Bewegungen fehlen noch; die Liste der Modelle hat Lücken | 🟡 |

### 2.7 Performance

| Punkt | 1602 / Ziel | Neue Ufer | Status |
|---|---|---|---|
| Spielrechnung | flüssig auch bei 4-fachem Tempo | unter 1 ms je Schritt bei 570 Gebäuden; im großen Gefecht mit 115 Soldaten etwa 5 ms | ✅ |
| Speicher | stundenlang stabil | **Fehler:** Solange ein Schiff mit Kurs ausgewählt ist, belegt jedes Bild neuen Speicher der Grafikkarte und gibt ihn nie frei (Speicherleck). „Neues Spiel“ räumt nicht alles auf | 🟡 Fehler |
| Bäume und Gras | nur zeichnen, was man sieht | die Pflanzen ganzer Inseln werden immer gezeichnet, 5- bis 8-mal mehr als nötig | 🟡 |
| Anpassung ans Gerät | – | keine: immer volle Auflösung und Schatten. Auch in Pause und Menü wird voll weitergezeichnet (kostet Akku, macht warm) | ❌ |
| Bauen im Wald, Erkunden, Wege bauen | nur die betroffene Stelle neu zeichnen | jedes Mal werden alle Pflanzen und Bodenfarben neu aufgebaut (20–45 ms, ein spürbarer Ruckler), auch wenn die Gegner bauen | 🟡 |
| Daten zur Grafikkarte | – | etwa 1,3 MB je Bild, auch wenn nichts passiert | 🟡 |
| Gefechte hinter Mauern | – | Soldaten suchen immer wieder Wege, die es nicht gibt | 🟡 |
| Große Stadt | – | jedes Gebäude ist ein eigener Befehl an die Grafikkarte; mit detailreichen Meshy-Modellen wird das riskant | 🟡 |
| Computergegner | – | alle denken im selben Augenblick (kleine Ruckler, am Anfang ein Stoß bis 89 ms) | 🟡 |
| Erster Gebrauch | – | Teile der Grafik werden erst beim ersten Bauen oder Kampf vorbereitet (kurzer Ruckler) | 🟡 |
| Automatisches Speichern | – | 1,2 MB alle 20 s, auch ohne Änderung; Fehler bleiben unbemerkt | 🟡 |
| Größe der App | klein | 887 KB, davon etwa 65 KB ungenutzt | ✅ |
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
| Spielstände | mehrere | nur einer. „Neues Spiel“ im Verloren-Fenster löscht ohne Rückfrage; Fehler beim Speichern bleiben unbemerkt | 🟡 |
| Einstellungen für ein neues Spiel | Schwierigkeit, Startbedingungen, Optionen | nur die Zahl der Gegner | 🟡 |
| Spielstart | Schiff in einer unbekannten Welt | gleich ✅; aber kein Land in Sicht und kein Hinweis auf die Richtung | 🟡 |
| Anleitung | Lehrgang in mehreren Teilen | ein langes Textfenster; „Los geht's“ liegt unter dem Rand | 🟡 |
| Symbole über Gebäuden | ein Fragezeichen | 7 klare Symbole für die Ursache ⭐; aber ohne Dringlichkeit, in der Krise ein Haufen Symbole | 🟡 |
| Aufgaben | die Ziele lassen sich jederzeit anzeigen | streng nacheinander, nur eine sichtbar; „Wehrhaft“ verlangt die Burg schon vor den Bürgern und kann lange hängen | 🟡 |
| Erz, Gold, Fruchtbarkeit | Symbole auf entdeckten Inseln | nur im Insel-Fenster nach dem Antippen | 🟡 |
| Zeit | Pause, Tempo | Pause und 1x/2x/4x ✅; keine Anzeige der Spielzeit, die Pause ist kaum zu erkennen | 🟡 |
| Insel prüfen | Schiff hinfahren, warten, bis der Balken am „Auge“ voll ist | einfach antippen | ⭐ (einfacher) |
| Beim Bauen | der Einflussbereich wird gezeigt | Begründung im Klartext, Radius, Skala für die Ergiebigkeit, fremdes Gebiet wird abgedunkelt | ⭐ |

### 2.9 Inselwelt, Computergegner, Ereignisse

| Punkt aus 1602 | 1602 | Neue Ufer | Status |
|---|---|---|---|
| Zufällige Inselwelt mit Nebel | ja | ja, sehr verlässlich: in 300 Testwelten immer alle Pflanzen und Erz, Gold in 97 %, keine Mini-Inseln | ⭐ |
| Inselgrößen | 5 Größenklassen bis etwa 100 × 90 Felder | 3 Klassen, jede eine Klasse kleiner (die größte etwa 60 × 60) | 🟡 |
| Inselformen und Gelände | viele Formen, Flüsse, Steppe, große Berge | rundliche Formen mit zufälligem Rand; keine Flüsse, keine Steppe; kleine Berge | 🟡 |
| Klima Nord/Süd | eigene Fruchtbarkeit je Pflanze | gleich (zum Aussehen siehe 2.6) | ✅ |
| Erste Insel | groß, mit Erz und einer Pflanze, die zu 100 % wächst | nicht garantiert: 8 % ohne Erz, 14 % ohne Pflanze mit 100 %; in 3 % der Welten gibt es gar kein Gold | 🟡 |
| Computergegner: Wirtschaft | ihre Städte laufen über Stunden | **Fehler:** Wege nicht angeschlossen, Hunger, Pleite; nach 2 Stunden sind fast alle im Minus | 🟡 Fehler |
| Computergegner: Wachstum | alle 5 Stufen, mehrere Inseln | bleiben bei den Siedlern, auf einer Insel und mit 9 Gebäudearten | 🟡 |
| Computergegner: Wahl der Insel | – | sichern sich in den ersten 1–3 Minuten die großen Inseln | 🟡 |
| Computergegner: Handel und Schiffe | handeln und fahren eigene Schiffe | handeln nie mit dir; ihre Schiffe stehen nach der Gründung still | ❌ |
| Computergegner: Charakter | eigene Persönlichkeit, richten ihr Tempo nach dem Spieler | nur Name und Farbe | ❌ |
| Computergegner gründen | – | zuverlässig und nach denselben Regeln wie du | ✅ |
| Ureinwohner | Dörfer, Tausch Ware gegen Ware (etwa 1 : 1,5), Fluch bei Angriff | fehlen ganz | ❌ |
| Feuer | Brände springen über, die Feuerwehr löscht | fehlt | ❌ |
| Pest, Kriminalität | Arzt, Galgen | fehlen | ❌ |
| Dürre, Schatz, Vulkan | ja (Vulkan in der Erweiterung) | fehlen | ❌ |
| Abwechslung | Kartengrößen, Optionen | Start immer unten links, die Mischung der Inseln ist immer gleich, und die Namen verraten die Inselgröße | 🟡 |

---

## 3. Stärken: was schon gut oder besser ist

- **Zahlen wie im Original:** rund 45 Gebäude mit genauen Kosten, Unterhalt, Reichweiten und Freischaltungen. Dazu Verbrauch je Stufe, Kosten für den Haus-Aufstieg, Kontor I–IV, alle Schiffe, alle Kampfwerte und die Händlerpreise.
- **Der Kern von 1602 steht:** fünf Stufen mit denselben Bedingungen, alle 23 Waren und Ketten, Lager und Freischaltungen je Insel. Eine Aristokratenstadt trägt sich wie im Original (etwa 32 % Gewinn).
- **Kampf nah am Original:** Gefechte rechnen wie in 1602, Wald gibt Deckung. Es gibt Seeschlachten, Truppen an Bord, Eroberung über Kontor oder Marktplatz, Krieg und Frieden, Schutz vor Piraten nach Vermögen und den Triumphbogen.
- ⭐ **Lebendige Rohstoffe:** Bäume fallen und wachsen nach. Fischgründe, Wild und Weide haben sichtbare Bestände. Zu dicht gebaute Betriebe teilen sich den Rohstoff, und beim Bauen zeigt eine Skala, wie ergiebig der Platz ist.
- ⭐ **Klare Infos:** Haus- und Betriebs-Info sagen im Klartext, was fehlt und warum. Warnsymbole nennen die Ursache, und beim Bauen begründet das Spiel jedes „Geht nicht“. 24 Aufgaben führen durch alle Ketten.
- ⭐ **Gute Grundlage fürs Handy:** Kerbe und Home-Balken werden beachtet, ein Finger schiebt ohne Bauen aus Versehen, Wege baut man per Tippen mit Umweg-Suche. Vor teuren Schritten kommt eine Rückfrage, beim Verlassen pausiert und speichert das Spiel.
- ⭐ **Fairer Ablauf:** 3 Minuten Vorwarnung vor Kriegen mit Rat, nach einem Totalverlust ein Rettungsschiff und 40 Minuten Ruhe; Piraten rauben, statt zu versenken.
- **Verlässliche Inselwelt:** in 300 Testwelten immer alle Pflanzen und Erz, Gold in 97 %, keine Mini-Inseln, Inselinfo per Antippen (⭐).
- **Schöne Teile der Grafik:** Berge und Täler, Wind in Bäumen und Gras, Schaum an der Küste, Nebel über Unentdecktem, echter Himmel und weiche Schatten. Burgen, Soldaten und Kampfeffekte sind sehr detailreich. Schiffe schaukeln, bekommen Schlagseite und sinken.
- **Schlanke Technik:** Die ganze App hat 887 KB und startet in etwa 2,5 s. Die Spielrechnung ist sparsam, und der Speicher bleibt bis auf einen Fehler stabil. Wenn die Grafik auf dem iPhone kurz ausfällt, kommt sie wieder. Der Anschluss für Meshy-Gebäude funktioniert.

## 4. Größte Schwächen: was zuerst angehen

1. **Fehler und Stolpersteine im Spielgefühl:**
   - Ein volles Lager vernichtet Ware, Tore trennen das Wegenetz, die Schiffsroute füllt den Speicher der Grafikkarte, und die Hausstufen 4 und 5 sehen aus wie Stufe 3.
   - Militär, Abreißen, „Alles ausladen“ und „Los geht's“ liegen unter dem Bildrand, und die Hinweisleiste schluckt Tipps.
   - Schiff-auf-Land ist nur halb gelöst.

   → L1, U1, R1, G1
2. **Der Wirtschaft fehlen die Stellschrauben von 1602:** kein Steuersatz, kein Bankrott, Hunger und Mangel haben kaum Folgen, Betriebe versorgen nur ¼ bis ⅓ so viele Bewohner. → L2, U2
3. **Computergegner:** Ihre Wirtschaft bricht ein (Fehler), sie bleiben bei den Siedlern auf einer Insel, handeln nicht und sind im Krieg kaum eine Gefahr. → KI1, KI2, M2
4. **Handel:** Es gibt nur einen Sofort-Knopf am Kontor, keine Händlerschiffe mit Aufträgen und keine Handelsrouten. Wirtschaften mit mehreren Inseln, der Kern von 1602, wird so mühsam. → S2, U5
5. **Kein Überblick:** keine Statistik, keine Warnung bei Mangel, Meldungen verschwinden nach Sekunden, keine Übersichtskarte, keine Liste der Schiffe und Inseln. → S1, U2, U3
6. **Die Stadt-Grafik liegt unter 1602:** einfache Formen, 27 Gebäudearten ohne eigenes Aussehen, kein Rauch, keine Felder, keine Bewohner; Nord- und Südinseln sehen gleich aus. → G1, G2, G3, G3b, G4a (und Meshy)
7. **Ganze Bereiche von 1602 fehlen:** Ureinwohner, Feuer, Pest, Kriminalität, Dürre, Prachtbauten, Piratennest, Endwertung, Szenarien. → S3, S4, L3, M2, S5, F2
8. **Die Grafik-Leistung ist nicht abgesichert:** Die Pflanzen ganzer Inseln werden immer gezeichnet, Bauen im Wald ruckelt, die Grafik passt sich nicht ans Gerät an und zeichnet auch in der Pause voll weiter. → R1, R2
9. **Warenwege einfacher als in 1602:** Felder entstehen unsichtbar von selbst, Wald lässt sich nicht pflanzen, Rohstoffe „springen“ in die Werkstatt, Marktplätze bringen kaum etwas. → L2, L4
10. **Die Welt ist kleiner und gleichförmiger:** Inseln eine Größenklasse kleiner, keine Flüsse und keine Steppe, Start immer unten links. → L5

## 5. So geht es weiter

Die Schwächen sind auf 35 Arbeitspakete verteilt. Zu jedem gibt es eine eigene Liste mit Einzelschritten und Dateien. Die Pakete laufen in vier Wellen. Innerhalb einer Welle können mehrere Helfer gleichzeitig arbeiten.

| Welle | Inhalt | Pakete |
|---|---|---|
| 1 – Fehler & Spielgefühl | Fehler beheben, Schiff wie gewünscht, Stolpersteine auf dem Handy weg, Wirtschaft der Gegner reparieren, Grafik-Leistung, Fehler an Gebäuden, Unterlagen bereinigen | L1, U1, KI1, R1 → R2, G1, D1 |
| 2 – Kern von 1602 | Steuern, Bankrott und Kosten; Statistik und Warnungen; Händlerschiffe und Routen; Kampfregeln; Gegner wachsen; die passenden Fenster; Gebäude neu gestalten; Rauch, Fahnen und Symbole; Plan für Meshy | L2, S1, S2, M1, KI2, U2–U5, G2, G3, G5a |
| 3 – fehlende Inhalte | Katastrophen, Ureinwohner, Endwertung, Prachtbauten, Felder, Förster und Anlieferung, Piratennest und Diplomatie, Spielstart und Spielstände, sichtbare Bewohner und Felder, Landschaft, Wasser und Licht, Klänge | S3, S4, S5, L3, L4, M2, P1, G3b, G4a, G4b, A1 |
| 4 – Feinschliff | Meshy-Modelle im Spiel, Inselgrößen und Flüsse, Bilder der Gebäude und App-Symbol, Szenarien, Unterlagen nachziehen | G5b, L5, F1, F2, D2 |

Damit sich die Helfer nicht gegenseitig stören:

- **Andockstellen (Paket L1):** Neue Spielteile (Ereignisse, Statistik, Händler, Punkte, Ureinwohner) bekommen je eine eigene Datei, die an einer festen Stelle im Spiel eingehängt wird. Neue Gebäude stehen schon vorbereitet in der Datentabelle und erscheinen erst, wenn ihr Spielteil fertig ist (Regel 8).
- **Bausteine der Oberfläche (Paket U1):** Die große Datei der Oberfläche wird zerlegt. Jedes Fenster bekommt eine eigene Datei mit eigener Gestaltung.
- Wo zwei Pakete dieselbe Datei brauchen, wartet das eine auf das andere; das ist in der Liste vermerkt. Die Unterlagen ändern nur D1 (jetzt) und D2 (am Ende).
- Jedes Paket endet mit Typprüfung, Bau und Browser-Test. Danach prüft der unabhängige Prüf-Agent gegen ANFORDERUNGEN.md.

**Was du beitragen kannst:**

- die sechs Fragen beantworten,
- den Meshy-Schlüssel bereitstellen, wenn Meshy loslegen soll,
- nach Paket R1 einmal auf deinem iPhone spielen. Mit „?debug“ in der Adresse erscheint eine kleine Anzeige, wie lange ein Bild braucht.

## 6. Deine Entscheidungen (Kurzfassung)

1. **Steuern wie in 1602**, also ein Regler je Stufe und eine flache Steuerkurve? Empfehlung: ja.
2. **Wirtschaftstempo angleichen:** die Betriebe schneller machen, damit einer wieder ähnlich viele Bewohner versorgt wie in 1602? Empfehlung: ja.
3. **Felder:** Die Farm legt beim Bau sichtbare Felder an, man kann nachbessern. Empfehlung: ja.
4. **Grafik:** zuerst eine Meshy-Probe mit 3 Modellen? Empfehlung: ja (dafür brauchen wir den Schlüssel).
5. **Stärke der Gegner und Schwierigkeit beim Start wählbar?** Empfehlung: ja, Standard „normal“, Katastrophen „mild“.
6. **Inselgrößen wie in 1602?** Empfehlung: ja, aber erst nach der Arbeit an der Grafik-Leistung und einem Test auf dem iPhone.

Bis du antwortest, planen wir mit der Empfehlung.
