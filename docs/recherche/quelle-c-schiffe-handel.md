# Quelle C: Schiffe, Handel, Piraten, Ureinwohner (Anno 1602)

Stand: 30.10.2026. Erstellt aus lokal gespeicherten Texten, ohne Internetzugriff.

Hauptquelle ist Tim Howgego, englische Fan-Anleitung (FAQ/Strategy Guide). Die Abschnittsnummern (z. B. 3.8.2) beziehen sich darauf.

## 0. Quellenlage und Konventionen

- **Schiffsdaten fehlen in den sechs Pflichtdateien.** Die Schiffstabellen (Kosten, Laderaum, Kampfwerte, Tempo) stehen im Anhang `tim_appendices_military_data`. Die Werft- und Kontordaten stehen im Anhang `tim_appendices_building_industry_data` und zusätzlich in `giga.txt`. Ich habe die Tabellen aus den .html-Dateien ausgelesen, weil die .txt-Fassung die Spalten verschiebt. Alle Werte stammen aus den Quellen.
- **Deutsche Namen:** Warennamen aus `ai_ketten.txt` (Annoinfo-Produktionsketten) und `giga.txt`. Gebäudenamen aus `giga.txt`. Triumphbogen aus `wiki.txt`. Freie Händler und Einheimische aus `ai_infos.txt`.
- **Deutsche Schiffsnamen sind in keiner Quelle belegt.** Ich verwende Arbeitsnamen (markiert mit "Arbeitsname").
- **Währung:** `giga.txt` und `ai_ketten.txt` nennen "Credits". Tim nennt die Währung "coin". Im Dokument steht "Credits". Die Vorgängernotiz 03 nennt "Taler", was in keiner Quelle steht.
- **Einheiten:** Gewichte in Tonnen (t). Zeiten in Sekunden (laut Tabellenhinweis). Das Tempo hat nur einen Index (siehe 1.2).
- **Quellenkürzel:**
  - TSh = `tim_gameplay_ships`
  - TTD = `tim_gameplay_trade_diplomacy`
  - TPN = `tim_gameplay_pirates_natives`
  - TSPN = `tim_strategies_pirates_natives_strategies`
  - TST = `tim_strategies_trade_strategies`
  - TAIP = `tim_appendices_ai_trade_prices`
  - TMIL = `tim_appendices_military_data` (Anhang, Schiffstabellen)
  - TBLD = `tim_appendices_building_industry_data` (Anhang, Werften und Kontore)
  - TCB = `tim_gameplay_colony_buildings`
  - TMU = `tim_strategies_military_units`
  - GIGA = `giga.txt`
  - AK = `ai_ketten.txt`
  - WIKI = `wiki.txt`
  - AI = `ai_infos.txt`
- **Widersprüche** sind mit **[WIDERSPRUCH]** markiert und in Abschnitt 6 zusammengefasst. **Lücken** stehen in Abschnitt 7.

---

## 1. Schiffe

### 1.1 Schiffstypen: Kosten, Freischaltung, Material, Bauzeit

| Typ (Arbeitsname) | Kosten (Credits) | Freischaltung (Bevölkerung) | Holz | Stoff | Kanonen-Wert (TMIL) | Laderaum (t) | Bauzeit kleine Werft / große Werft (s) |
|---|---|---|---|---|---|---|---|
| Kleines Handelsschiff | 400 | 120 Siedler | 25 | 3 | 6 | 200 | 120 / 65 |
| Großes Handelsschiff | 520 | 500 Kaufleute | 45 | 5 | 10 | 300 | – / 105 |
| Kleines Kriegsschiff | 600 | 120 Siedler | 32 | 4 | 8 | 150 | 150 / 100 |
| Großes Kriegsschiff | 900 | 500 Kaufleute | 60 | 7 | 14 | 400 | – / 140 |
| Piratenschiff (nur Gegner) | nicht angegeben | nicht anwendbar | – | – | 10 (Maximum, siehe 1.2) | nicht angegeben | nicht anwendbar |

Die Bauzeit "–" bedeutet in TMIL, dass für diesen Werft-Typ keine Bauzeit angegeben ist. Die Quelle sagt dies nicht ausdrücklich als "nicht baubar" (siehe 6, Punkt 3).

Erläuterungen:
- Schiffe lassen sich erst ab der genannten Bevölkerungsstufe bauen. Sie können aber auch ohne diese Stufe von anderen Spielern gekauft werden (TMIL, Fußnote).
- Die Spalte "Kanonen-Wert" führt die Tabelle unter "Cannon". Ob dies Baukosten oder Kapazität ist, ist unklar (siehe 6, Punkt 4).
- Der Laderaum in Tonnen ist die Gesamtladung des Schiffs (TMIL, Spalte "Cargo"). Die Anzahl der Laderäume ist nur für das Kleine Kriegsschiff belegt: drei (TST 5.4.2). Große Schiffe haben mehr Laderäume (TMU, TSh 3.8.2). Eine Zahl dazu fehlt.
- Die Bauzeit "120 / 65" bedeutet: kleine Werft 120 s, große Werft 65 s (TMIL, Fußnote).

### 1.2 Kampfwerte und Tempo

| Typ | Lebenspunkte | Stärke | Schussintervall (s) | Reichweite (Felder) | Kanonen | Tempo leer / voll |
|---|---|---|---|---|---|---|
| Kleines Handelsschiff | 50 | 4 | 2 | 7–8 | 6 | 100 / 60 |
| Großes Handelsschiff | 80 | 4 | 1 | 7–8 | 10 | 80 / 48 |
| Kleines Kriegsschiff | 65 | 4 | 2 | 7–8 | 8 | 110 / 66 |
| Großes Kriegsschiff | 120 | 7,0 | 2 | 7–8 | 14 | 120 / 72 |
| Piratenschiff | 95 | 4 | 1 | 7–8 | 10 (Maximum) | 90 / 54 |

- Das Tempo ist ein Index. Ein leeres Kleines Handelsschiff hat den Wert 100 (TMIL).
- Das Schussintervall ist die Zeit zwischen zwei Schüssen in Sekunden (TMIL).
- Die Piraten-Kanonenzahl (10) ist laut Falke ein Maximum. Sie hängt vom Szenario ab (TMIL, Fußnote; TMU, Frieden).
- Das Großes Kriegsschiff ist das schnellste Schiff, leer und voll (TMIL, TMU).
- Das Großes Handelsschiff ist das langsamste Schiff (TMU, Eric Lorah).
- Beladung verlangsamt Schiffe. Ein kleines Schiff mit 200 t fährt merklich langsamer, ein großes Kriegsschiff mit 200 t kaum (TMU, Waywardsoul und Robitoby).

### 1.3 Werften (kleine und große)

| Merkmal | Kleine Werft | Große Werft |
|---|---|---|
| Freischaltung | 120 Siedler (TBLD, GIGA, TSh 3.8.2) | 500 Kaufleute (TBLD, GIGA, TSh 3.8.2) |
| Kosten (Credits) | 1100 | 2800 |
| Holz | 12 | 25 |
| Ziegel | 3 | 63 |
| Werkzeug | 8 | 10 |
| Betriebskosten | 100/20 | 150/30 |
| Größe | 3×3 | 4×4 |
| Einflussbereich (TBLD, Spalte "Coverage") | 13 | 17 |
| Baut | Kleine Schiffe. Die Tabelle nennt für große Schiffe hier keine Bauzeit (siehe 6, Punkt 3). | Alle Schiffe |

Regeln zum Bau:
- Ein Schiff wird an der Werft bestellt. Das Material wird danach automatisch herangeschafft (TSh 3.8.2).
- Die Werft braucht einen Marktplatz in ihrem Einflussbereich (TSh 3.8.2).
- Die Große Werft baut kleine Schiffe deutlich schneller: Handelsschiff 120 s auf 65 s, Kriegsschiff 150 s auf 100 s (TMIL).
- Trick (FrankB, TSh 3.8.2): Ein Großes Kriegsschiff wird im Bau-Menü der Großen Werft ausgewählt, aber nicht bestätigt. Danach wird es an der Kleinen Werft bestellt. Der Bau dauert dort länger. Dafür muss eine Große Werft existieren. **[WIDERSPRUCH]** Die Tabelle gibt für große Schiffe an der kleinen Werft keine Bauzeit an (siehe 6, Punkt 3).
- Große Schiffe brauchen 500 Kaufleute (TMIL). Die Große Werft hat dieselbe Freischaltung (TBLD).

### 1.4 Anzahl, Kauf und Verkauf, Reparatur, Bewaffnung

**Schiffsanzahl**
- Die normale Obergrenze liegt bei 33 Schiffen (TSh 3.8.5, Eric Lorah).
- Die UK-Version erlaubt 20 Schiffe. Laut AnnoDan1602 gilt die Grenze von 20 auch für die deutsche Originalversion (TSh 3.8.5). **[WIDERSPRUCH]** (siehe 6, Punkt 2.)
- Jeder Triumphbogen erhöht die Grenze um ein Schiff (Worker72, TSh 3.8.5). Ein Triumphbogen entsteht nach dem Sieg über einen Gegner. Bei Piratensieg gibt es ihn nur, wenn das Szenario Piraten als Gegner führt (TCB 3.4.4, Mircea).
- Erobert man eine Werft, während dort ein Schiff fertig wird, gehört dieses Schiff dir (Zomby Woof, TSh 3.8.5).

**Schiffe von Mitspielern kaufen**
- Ein Verkaufsangebot wird durch ein Warnsymbol unten links angezeigt. Ein Klick führt zum Schiff. Kaufen geht durch Anklicken, wenn du das Geld hast (TSh 3.8.3, Alaskan).
- Die KI verkauft nur, wenn sie genug Holz und sonst nichts zu tun hat (FrankB, TSh 3.8.3).

**Schiffe verkaufen**
- Die KI kauft ein Schiff, wenn sie kein Schiff und keine Werft hat (Falke, TSh 3.8.4).
- Robbie47: Man versenkt das letzte Schiff und zerstört die Werft, baut dann ein Schiff und bietet es an. Die KI kauft es dann. **[WIDERSPRUCH]** Eric Lorah sagt, die KI kauft gegen KI-Gegner kaum Schiffe (siehe 6, Punkt 8).

**Reparatur**
- An der Werft gibt es einen Reparatur-Knopf. Ein gelber Rand zeigt, dass die Reparatur läuft. Es wird nur ein Schiff gleichzeitig repariert (TSh 3.8.6, Render).
- Die Reparatur braucht Holz und Stoff. Der Marktplatz liefert sie. Ein Marktplatz direkt neben der Werft spart Zeit (TSh 3.8.6).
- Hilfreich ist: freier Weg zum Markt oder Kontor, Werft im Einflussbereich des Schiffs, genug Holz und Stoff auf der Insel (Worker72, TSh 3.8.6).
- Die weiße Flagge kann während des gesamten Aufenthalts im Trockendock gehisst bleiben (Terry, TSh 3.8.6).
- Die Materialmenge pro Reparatur ist nicht angegeben (siehe 7).

**Bewaffnung**
- Kanonen werden als Fracht aus dem Kontor aufs Schiff geladen. Das Schiff wird im Kampfmenü gewählt. Eine Kanone im Laderaum wird angeklickt, dann ist sie montiert.
- Demontage: das große Kanonensymbol im oberen Teil des Schiffsmenüs (TSh 3.8.7).
- Neue Schiffe sind unbewaffnet. Nur KI-Spieler rüsten sie aus, und dann nur mit einer Kanone (TSh 3.8.7).

**Sonstiges**
- Gesunkene Schiffe: Die Ladung schwimmt, lässt sich aber nicht bergen. Ein Klick zeigt Name, Ladung und Route (Jochen Bauer, TSh 3.8.8).
- Piraten oder Kaperei durch Spieler gibt es nicht (TSh 3.8.8).
- Meeresbewohner (Wale, Delfine, Oktopus) sind reine Dekoration (TSh 3.8.9).
- Freie Händler können nicht angegriffen werden (TSh 3.8.10).

### 1.5 Handelsrouten (Auto-Handel)

**Einrichtung** (Stefanus Franzosus, TTD 3.6.1)
1. Schiff wählen.
2. Auto-Handel-Symbol in der Seitenleiste anklicken.
3. Einen der Balken mit zwei blauen Flächen anklicken.
4. Die Insel wählen, mit der gehandelt wird.
5. Waren auswählen. Ein Pfeil nach rechts bedeutet Laden, ein Pfeil nach links bedeutet Entladen.
6. Im zweiten Balken die Heimatinsel wählen.
7. Dieselben Waren mit umgekehrtem Pfeil einstellen.
8. Unten auf "Auto-Handel starten" klicken.

- Die Route wird im Schiffsmenü mit dem Symbol mit rotem Kreuz gestartet. Dasselbe Symbol pausiert sie (Budgie, TTD 3.6.1).

**Regeln**
- Pro Gut wird höchstens 100 t pro Ladevorgang geladen. Die Grenze gilt für die Summe über alle Inseln. Zwei Ladeinseln mit je 100 t Nahrung ergeben also insgesamt 100 t (FrankB, TTD 3.6.1; Zomby Woof, TST 5.4.2).
- Das Schiff lädt verschiedene Waren in verschiedene Laderäume. Beim Entladen schaut es laderaumweise nach. Es sucht nicht im nächsten Laderaum nach derselben Ware (Neferankh, TTD 3.6.1).
- Empfohlen wird, in derselben Reihenfolge zu entladen, in der beladen wurde (Neferankh, TTD 3.6.1).
- Drei Ladeinseln und eine Entladeinsel sind möglich (PacificSeaMonger, TTD 3.6.1).
- Problem: Produziert eine Ladeinsel stark, füllen sich die Laderäume, ohne dass entladen wird (Neferankh, TTD 3.6.1).
- Ein Kleines Kriegsschiff hat nur drei Laderäume. Eine vierte Ware verschwand aus dem Lager, aber nicht aus dem Schiff (Zomby Woof, TST 5.4.2).
- Hub-Insel: Waren von weit entfernten Inseln werden auf halbem Weg in ein Lager abgeladen. Ein zweites Schiff bringt sie zum Hauptsitz. Das sorgt für einen Puffer bei Dürre (FrankB, TST 5.4.2).
- Kleine Schiffe bringen Waren vom Ende zur nächsten Insel mit gleichem Produkt. Große Schiffe übernehmen die Strecke zum Hauptsitz (Stormbringer, TST 5.4.2).
- Route an Feinden vorbei: über eine befreundete Insel führen, dort nichts laden. Oder unbewaffnete Schiffe fahren lassen, sie kämpfen nicht (FrankB, TST 5.4.2). Oder die störenden Feindtürme zerstören (Sir Henry, TST 5.4.2).

**Warnmeldung "Check your trade routes"** (Robbie47, TTD 3.6.2)
- Mögliche Ursachen: (A) falsche Pfeile, zum Beispiel nur Laden und nie Entladen, (B) das Ziellager ist voll, (C) der Käufer kauft gerade nicht, (D) das Ladelager ist leer, (E) der Lieferant verkauft gerade nicht.
- Die Meldung erscheint beim ersten und beim dritten vergeblichen Versuch eines Schiffs (Manfred, TTD 3.6.2).

### 1.6 Seekampf-Regeln

- Piraten sind feindlich, solange sie nicht bestochen sind. Andere Spieler greifen nur bei triftigem Grund an (TTD 3.6.8).
- Bewaffnete Schiffe fangen Kämpfe an. Unbewaffnete Schiffe fahren ihre Route weiter. FrankB rüstet seine Schiffe deshalb am Anfang ab (FrankB, TSPN 5.5.2).
- Die weiße Flagge hisst man mit der Taste W (FrankB, TSPN 5.5.2).
- Wird die weiße Flagge gehisst, bevor der Pirat das Schiff erreicht, gibt es keinen Kampf. Es wird nichts geraubt, und das Piratenschiff zieht nach einiger Zeit ab (sb4x4, TSPN 5.5.2).
- Die weiße Flagge bleibt nach einem Neustart des Spiels nicht gespeichert (FrankB, TSPN 5.5.2).
- Hat der Pirat keine Insel, auf der er das Diebesgut abliefern kann, schießt er nur, ohne etwas zu nehmen (FrankB, TSPN 5.5.2).
- Ein Schiff mit 4 Kanonen unterliegt einem Piraten (BBDevo, TSPN 5.5.2).
- Schwer beschädigte Piraten sind langsam und lassen sich leicht umfahren. Piraten reparieren ihre Schiffe nie (Robbie47 und Eric Lorah, TSPN 5.5.2).
- Ein versenkter Pirat wird durch ein neues Schiff ersetzt (Manfred, TSPN 5.5.2).
- Blockade: Mit Kriegsschiffen nicht näher als 3 Felder an das Lager einer KI heranfahren. Sonst erklärt die KI den Krieg (Guardian, TTD 3.6.8).
- Klick auf ein KI-Kriegsschiff im Kampfmodus kann den Krieg auslösen (FrankB, TTD 3.6.8).
- Patrouille: Sie verläuft nur zwischen dem Startpunkt und einem gesetzten Punkt. Die KI kann um Inseln kreisen, der Spieler nicht (Zomby Woof, TSh 3.8.11).
- Eskorte: Es gibt keine automatische Eskorte. Schiffe mit stark unterschiedlicher Geschwindigkeit verpassen einander. Lösung: nur große Kriegsschiffe als Frachter verwenden (Robitoby, TSh 3.8.11).

---

## 2. Handel

### 2.1 Kontor (Lagerhaus) und Handelskapazität

"Kontor" ist die deutsche Bezeichnung des Warehouse (GIGA).

| Stufe | Freischaltung | Kosten | Holz | Ziegel | Werkzeug | Betrieb | Lager (t) | Max. Ankaufsgüter | Max. Verkaufsgüter | Größe | Einflussbereich |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kontor I | keine | 100 | 6 | – | 3 | 15/15 | 30 | 4 | 3 | 2×3 | 16/6 |
| Kontor II | 30 Siedler | 180 | 7 | – | 3 | 15/15 | 50 | 7 | 4 | 2×3 | 16/6 |
| Kontor III | 100 Bürger | 250 | 4 | 6 | 4 | 15/15 | 75 | 8 | 6 | 2×3 | 16/6 |
| Kontor IV | 250 Kaufleute (TBLD) | 250 | 4 | 10 | 5 | 15/15 | 100 | 11 | 8 | 2×3 | 16/6 |

Quellen: Lager und Handelsgrenzen aus TTD 3.6.7. Kosten und Baustoffe aus TBLD und GIGA. Die Spalte "Einflussbereich" hat in TBLD zwei Werte (16/6). Die Bedeutung des zweiten Werts ist unklar. **[WIDERSPRUCH]** GIGA nennt Kontor IV bei 250 Bürgern, TBLD bei 250 Kaufleuten (siehe 6, Punkt 9).

Regeln:
- Das erste Kontor einer Insel wird von einem Schiff an der Küste aus gebaut. Das Schiff muss das nötige Material an Bord haben (TCB 3.4.9).
- Kontor II bis IV entstehen nur über einem bestehenden Kontor (Robitoby, TCB 3.4.9).
- Normalerweise gibt es nur ein Kontor pro Insel. Ausnahme: Nach der Zerstörung eines Piratenlagers kann man an derselben Stelle ein eigenes Kontor bauen (joe_44850 und Günter, TCB 3.4.9).
- Beim Bau eines Kontors wird automatisch 1 t Nahrung eingelagert (Sandmonkey, TCB 3.4.9).
- Die Obergrenze für Parteien auf einer Insel liegt laut FrankB bei sieben. Das ist unsicher (TCB 3.4.9).
- Piers und Docks sind zum Anlegen am Kontor nicht nötig (Lord Khang, TCB 3.4.10).

### 2.2 Marktwagen (Handel auf der eigenen Insel)

- Pro Kontor ist ein Marktwagen möglich (TTD 3.6.4). Er kann nicht entfernt werden, sobald er platziert ist (TTD 3.6.3).
- Marktwagen handeln nur auf derselben Insel: mit anderen Spielern, Ureinwohnern oder KI-Gegnern (Günter, TTD 3.6.3).
- Trick für mehrere Marktwagen auf einer Insel: Kontor bauen, Fuhrmann mit Marktwagen erzeugen, Kontor abreißen, neues Kontor bauen. Die Anzahl hängt von der Inselgröße ab, weil jedes neue Kontor außerhalb der Reichweite des vorigen liegen muss (Günter, TTD 3.6.4).
- Ein Marktwagen kann auch als Lagerraum dienen (Günter, TTD 3.6.3).

### 2.3 Kauf- und Verkaufseinstellungen am Kontor

- Man legt am Kontor fest, was man kauft und verkauft. Der schwarze Balken zeigt die Menge. Die Farbe des Pfeils entspricht der Preislinie (BigTiny, TTD 3.6.5).
- Die Verkaufsmenge setzt man knapp unter den Bestand (Waywardsoul, TST 5.4.1).
- Verkaufsüberschuss statt Produktionsstopp: Man verkauft den Überschuss, solange er Abnehmer findet (Eric Lorah, TST 5.4.1).
- Findet ein Gut keinen Käufer, muss man den Verkaufspreis senken (Eric Lorah, TST 5.4.1).

### 2.4 Freie Händler

- **Erscheinen:** **[WIDERSPRUCH]** FrankB sagt, sie erscheinen beim ersten Kontor. Sie kommen zum Kontor, bewegen sich aber erst, wenn ein zweites Kontor existiert (KI-Kontore zählen mit). Budgie sagt, sie erscheinen erst beim zweiten Kontor (TTD 3.6.5).
- In manchen Szenarien erscheinen sie nie. Das ist eine Szenario-Einstellung und kein Normalzustand (TTD 3.6.5).
- **Was sie verkaufen:** Nur Waren, die Spieler produziert haben. Ausnahmen: Werkzeug und Erz sind immer verfügbar, sobald ein Spieler Erz abbaut. Eisenerz ist außerhalb der Karte unbegrenzt (Shark_Dus und FrankB, TTD 3.6.6).
- Alle anderen Waren kaufen sie nur, wenn jemand sie an sie verkauft (FrankB, TTD 3.6.6).
- **Preise:** Verkauft man direkt an die KI, erzielt man einen höheren Preis als bei Freien Händlern. Kauft man direkt bei Piraten oder der KI, zahlt man deutlich weniger als bei Freien Händlern (Dietl, TST 5.4.1).
- Angebot und Nachfrage: Wenn alle Erz kaufen, verkaufen Freie Händler an den höchsten Bieter zuerst (Robbie47, TST 5.4.1).
- Freie Händler nehmen große Mengen ab, wenn die KI-Inseln wenig zu höherem Preis verkaufen. Das gilt aber nur, solange die Ware anderswo gefragt ist (Robbie47, TST 5.4.1).
- Werkzeug am Anfang: Der Kaufpreis lässt sich auf etwa 70–75 drücken. Später muss man auf etwa 105 erhöhen, dann verkauft jeder. Mehr als 105 bringt nichts (Günter, TST 5.4.1).
- Kauft man Waren bei Freien Händlern und verkauft sie gewinnbringend an die KI, kann man in der Geldnot Werkzeug weiterverkaufen (Günter, TST 5.4.1).
- Die KI verkauft manchmal eine Ware, etwa Gewürze zu 30, und will sie sofort zu 45 zurück (Budgie, TST 5.4.1). Das passt zu den Preisen in 2.5 (Gewürze: KI verkauft 30, KI kauft 45).

### 2.5 Preise der KI (ohne Freie Händler)

Die Tabelle stammt von Charlie (anno-zone), zitiert in TAIP. Die Spalte "KI kauft" ist der Preis, den du bekommst, wenn du an die KI verkaufst. Die Spalte "KI verkauft" ist der Preis, den du zahlst, wenn du bei der KI kaufst. Die Produktionskosten stammen aus derselben Quelle.

Die Spalte "Marge" ist eine eigene Berechnung: KI-Kaufpreis minus Produktionskosten. Bei Produktionsspannen wird die Spanne angezeigt. Die Einheit ist in TAIP nicht genannt. Vermutlich ist es Credits pro t.

| Ware (Original) | Deutsch | KI kauft (Verkaufspreis für dich) | KI verkauft (Kaufpreis für dich) | Produktionskosten | Marge (berechnet) |
|---|---|---|---|---|---|
| Alcohol | Alkohol | 60 | 40 | 28–31 | 29–32 |
| Bricks | Ziegel | 33 | 22 | 1,7 | 31,3 |
| Cannon | Kanone | 375 | 250 | 112 | 263 |
| Cattle | Rinder | 7 | 5 | 2,2 | 4,8 |
| Cloth | Stoff | 37 | 25 | 11–22 | 15–26 |
| Clothes | Kleidung | 150 | 100 | 16–27 | 123–134 |
| Cocoa | Kakao | 37 | 25 | 25 | 12 |
| Flour | Mehl | 7 | 5 | 5,1 | 1,9 |
| Food | Nahrung | 19 | 13 | 2,5–11,9 | 7,1–16,5 |
| Gold | Gold | 525 | 350 | 80 | 445 |
| Grain | Getreide | 3 | 2 | 1,7 | 1,3 |
| Iron | Eisen | 97 | 65 | 58 | 39 |
| Jewellery | Schmuck | 675 | 450 | 76 | 599 |
| Muskets | Musketen | 187 | 125 | 98 | 89 |
| Ore | Erz | 67 | 45 | 43 | 24 |
| Spices | Gewürze | 45 | 30 | 25 | 20 |
| Sugarcane | Zuckerrohr | 22 | 15 | 10,9 | 11,1 |
| Swords | Schwerter | 135 | 90 | 85 | 50 |
| Tobacco | Tabak | 26 | 17 | 18,4 | 7,6 |
| Tobacco products | Tabakwaren | 75 | 50 | 47 | 28 |
| Tools | Werkzeug | 105 | 70 | 45 | 60 |
| Wood | Holz | 22 | 15 | 1,8 | 20,2 |
| Wool | Wolle | 18 | 12 | 2,6–8,1 | 9,9–15,4 |

Beobachtung (berechnet): Bei fast allen Waren verkauft die KI für etwa zwei Drittel (Verhältnis 0,65 bis 0,71) des Preises, zu dem sie kauft. Die Spreizung ist also ähnlich, auch wenn die absoluten Beträge stark streuen.

### 2.6 Handelsverträge, Krieg, Frieden, Bündnis

- **Krieg und Frieden:** Gute Gelegenheit zum Angriff sei, wenn du etwa 700 bis 800 Kaufleute hast, dann sind die Bürger leicht zufriedenzustellen und du brauchst wenige Handelsschiffe. Die Wirtschaft sollte stabil sein. Während des Krieges kann man Handelsschiffe zurück in den Heimathafen holen, bis die KI-Flotte versenkt ist (FrankB, TST 5.4.3).
- **Gewinnen und Anfangen:** Wer eine Schlacht sicher gewinnt, sollte sie beginnen. Der Gewinn erweitert das Gebiet (vipris, TST 5.4.3). Manche lassen die KI am Leben und verkaufen ihr Waren für Geld (Robitoby, TST 5.4.3).
- **Verträge mit der KI:** Die KI kann mit dem Spieler einen Friedensvertrag und einen Handelsvertrag haben. Helen berichtet, dass bei ihr zu viel gezahltes Geld den Friedens- und den Handelsvertrag brach. Sie zahlte deshalb gerade so viel, dass beides bestehen blieb. Die Schwelle ist nicht angegeben (siehe 7).
- **Entwicklungszahlungen an die KI:** Terry wollte der KI mit 100.000 "einen Schub" geben. Bei 70.000 war sie beleidigt. Schließlich akzeptierte sie zwei Zahlungen zu je 60.000, dazwischen Warenverkauf (TST 5.4.4).
- **Bündnisse:** Ureinwohner und KI können nie echte Verbündete sein. Sie sind nur Handelspartner. Greift jemand dich an, schauen sie zu (Terry, TST 5.4.4).
- **KI untereinander:** KI-Spieler haben keine Verträge untereinander und kämpfen nie gegeneinander. Die einzige Ausnahme sind Piraten, die KI und Ureinwohner angreifen können (FrankB, TST 5.4.4).

### 2.7 Verhalten der Computergegner (KI)

**Kriegsauslöser**
- Eigene Siedlung auf einer KI-Insel. Umgekehrt gilt dasselbe: Siedelt die KI auf deiner Insel, herrscht Krieg (FrankB, TTD 3.6.8).
- Ein Soldat auf einer KI-Insel, auch wenn dort zwei KI-Spieler siedeln (FrankB, TTD 3.6.8).
- Die KI braucht eine Insel, weil ihre Bevölkerung zu groß ist (FrankB, TTD 3.6.8).
- Findet die KI keine passende Insel (mit 100 % eines fehlenden Guts), siedelt sie auf deiner Insel. Sie erklärt dir sofort den Krieg (FrankB, TTD 3.6.8).
- Blockade des KI-Lagers: näher als 3 Felder heranfahren (Guardian, TTD 3.6.8).
- Szenarien können einen Krieg bei einer bestimmten Stufe festlegen (Aristokraten) und/oder wenn die KI unter ein bestimmtes Niveau fällt (FrankB, TTD 3.6.8).

**Pazifismus- und Neid-Regler** (nur Szenario-Editor, auch im Standardspiel beobachtbar; Neferankh, TTD 3.6.8)
- Linker Regler (Pazifismus): Stellt man ihn ganz nach oben, wird die KI aggressiv, sobald ihre Bevölkerung unter Aristokraten fällt. In einem Szenario "vom Start weg" ist sie sofort aggressiv. Ganz unten wird sie nie aggressiv, sobald sie Siedler-Häuser hat.
- Rechter Regler (Neid): Je höher, desto länger braucht die KI, um neidisch zu werden. Je mehr Rot, desto aggressiver.
- Aggressionszeichen des Spielers: Soldaten bauen, auf einer KI-Insel siedeln, Soldaten auf einer KI-Insel landen.

**Verhalten im Handel**
- Die KI will oft alles kaufen (sb4x4, TST 5.4.1).
- Ein unbewaffnetes Schiff, das bei einem KI-Lager lädt, wird laut Folga nicht angegriffen. Das gilt nur, solange man nicht alle Zugänge zum Hafen blockiert (TTD 3.6.8).

---

## 3. Piraten

### 3.1 Herkunft und Spielarten

Drei Spielarten (Frieden, TSPN 3.7.1):
1. Spiele ohne Piraten.
2. Spiele mit Piraten, die man endgültig besiegen kann. Dazu müssen Schiffe und Stadt besiegt sein. Danach kommen keine neuen Piraten mehr.
3. Spiele mit Piraten, die man nicht besiegen kann. Sie erscheinen immer wieder "aus dem Nichts" und siedeln auf freien Inseln, wenn sich dort eine passende Stelle findet.

- Manche Piraten haben kein Nest. Sie kommen am Anfang von außerhalb der Karte und verschwinden auch wieder dorthin (Shark_Dus, TSPN 3.7.1).
- Ein KI-Schiff wird zum Piraten, wenn es nicht genug Material hat, um ein Kontor zu bauen, oder keine passende Siedlungsstelle findet (Neferankh, TSPN 3.7.1). Das ist unsicher ("wenn ich mich recht erinnere").
- Piraten greifen laut TTD 3.6.8 immer an, außer man hat sie bestochen.

### 3.2 Piratenlager (Kontor) und Nest

- Das Piratenlager ist ein Kontor der Piraten. Am Anfang gibt es manchmal keines. Später findet man es auf einer Insel (TSPN 3.7.2).
- Zerstören: Erst die Piratentürme auf der Insel entfernen. Dann die Nahrungsquelle der Piraten zerstören, also Fischer- und Jägerhütten. Danach verschwindet das Lager mit dem Nest sofort. Ein eigenes Kontor kann an dieser Stelle gebaut werden (Günter, TCB 3.4.9).
- Wenn die Nahrungsquelle noch steht, bleibt das Lager nach dem Einsturz erhalten (Günter, TCB 3.4.9).

### 3.3 Bestechung (Schutzgeld) der Piraten

**Ablauf** (Dread Pirate Terry, TSPN 3.7.2)
1. Mit einem unbewaffneten Schiff zum Piratenlager fahren. Bewaffnete Schiffe werden beschossen.
2. Den Piraten anklicken. Es erscheint die Auswahl: Schutz kaufen oder Bestechung, damit sie einen anderen Spieler belästigen.
3. Um sich zu entwaffnen, Kanonen in den Laderaum legen oder vollständig abladen.

**Preis**
- Die Quellen nennen **keinen festen Betrag**. Die Höhe hängt vom eigenen Geld ab (FrankB, TSPN 5.5.2). Die Vorgängernotiz 03 nennt "ca. 700, später 1400 Taler". Dafür gibt es in den Quellen keine Grundlage (siehe 6, Punkt 5).
- Höhere Zahlungen helfen nicht, wenn du auf der Pirateninsel siedelst oder dort Soldaten hast. Dann schießen sie trotzdem (FrankB, TSPN 5.5.2).

**Dauer und Ausnahmen**
- Die Schutzzahlung hält nicht ewig, sondern nur eine Zeit lang (Frieden, TSPN 3.7.2). Wenn sie aufgebraucht ist, greifen Piraten wieder an (Arcturis, TSPN 5.5.2).
- Andere KI-Spieler können Piraten zahlen, damit sie dich angreifen. Ein Deal hält nur, bis jemand ein besseres Angebot macht (Terry, TSPN 5.5.2).
- Bestechung klappt nicht, wenn du auf derselben Insel wie die Piraten siedelst (FrankB, TSPN 3.7.2).

**Lebensmittel als Alternative**
- Mit einem unbewaffneten Schiff Nahrung bei den Piraten kaufen. Danach greifen sie nicht mehr an. Das sei günstiger als Schutzgeld (Anno Online, TSPN 5.5.2).
- Das funktioniert nur, wenn die Piraten mindestens eine Fischerhütte haben (FrankB, TSPN 5.5.2).
- Automatische Route mit Nahrungskauf bei den Piraten, jedes Mal ein paar Tonnen (Manfred, TSPN 5.5.2).

**Ware als Geschenk**
- Piraten lassen sich auch mit Ware ruhig stellen: Alkohol, Gewürze oder Ziegel wirken. Man stellt ein Schiff mit wenig Ladung und weißer Flagge vor den Hafen (mamayourpeoplearehungry, TSPN 5.5.2).
- Nach einem Raub, zum Beispiel 1 t Alkohol, kann man später das Doppelte zurückkaufen. Das besänftigt die Piraten (FrankB, TSPN 5.5.2). Das ist ein Weg, Waren zu bekommen, die man sonst nicht produzieren könnte.
- Piraten verkaufen gestohlene Ware billiger als die KI (Helen, TSPN 5.5.2).

### 3.4 Angriffe und Raub

- Piraten rauben Fracht. Sie sind nicht auf normale Fracht beschränkt. Sie können auch Bodeneinheiten auf dem Schiff rauben. Kanonen an Deck nehmen sie laut Günter nicht (TSPN 3.7.3).
- Angriffsablauf: Es erscheint ein kurzes Video. Ein Klick beendet es. Mit der Leertaste springt man zum Ort des Angriffs. Mit der Taste W hisst man die weiße Flagge oder versucht zu fliehen. Während des Videos läuft der Angriff weiter (FrankB, TSPN 5.5.2).
- Ein Schiff mit 4 Kanonen unterliegt einem Piraten (BBDevo, TSPN 5.5.2).
- Piraten schießen nur, wenn sie keine Insel haben, auf der sie die Beute abliefern können (FrankB, TSPN 5.5.2).

### 3.5 Schiffsdaten der Piraten

Siehe 1.2. Das Piratenschiff hat 95 Lebenspunkte, Stärke 4, Schussintervall 1 s, Reichweite 7–8 Felder, bis zu 10 Kanonen (Maximum, szenarioabhängig) und Tempo 90 leer / 54 voll (TMIL).

### 3.6 Strategien gegen Piraten (Zusammenfassung der Quellen)

- **Bestechen** früh, bevor man mit Militär beschäftigt ist, oder wenn man etwas anderes zu tun hat (FrankB, TSPN 5.5.2).
- **Nicht versenken:** Ein versenkter Pirat wird ersetzt. Ein schwer beschädigter Pirat ist langsam und lässt sich umfahren (Robbie47 und Manfred, TSPN 5.5.2).
- **Unbewaffnet fahren:** Unbewaffnete Schiffe fahren ihre Route weiter. Bewaffnete beginnen einen sinnlosen Kampf (FrankB, TSPN 5.5.2).
- **Kleine Ladungen:** Kleine Ladung auf Auto-Route fährt schneller als Piraten. Volle Schiffe werden eingeholt und versenkt (Neferankh, TSPN 5.5.2).
- **Weiße Flagge vor Eintreffen:** Verhindert den Kampf und den Raub (sb4x4, TSPN 5.5.2).
- **Scheinflotte:** Eine kleine Gruppe leerer Schiffe mit weißer Flagge in einer entlegenen Ecke der Karte hielt die Piraten beschäftigt (Terry, TSPN 5.5.2).
- **Weiße Flagge auf neuen Schiffen:** Wer neue Schiffe bauen will, hisst auf jedem frisch gebauten Schiff die weiße Flagge (Mircea, TSPN 5.5.2).
- **Piraten gegen KI einsetzen:** Piraten lassen sich auch benutzen, um KI-Gegner zu beschäftigen (rayser, TSPN 5.5.2).

### 3.7 Besiegen der Piraten

- Piraten besiegt man, indem man ihre Schiffe, Türme und Lager beseitigt. Ohne Nahrungsquelle verschwindet das Lager (siehe 3.2, Günter).
- Ein Sieg über Piraten kann einen Triumphbogen bringen, wenn das Szenario sie als Gegner führt (Mircea, TCB 3.4.4).
- Kommen die Piraten wieder, hängt das vom Szenario ab (Arcturis, TSPN 5.5.2).

---

## 4. Ureinwohner (Einheimische)

### 4.1 Vorkommen

- Im Endlosspiel leben auf der Inselwelt einige Dörfer der Ureinwohner (WIKI). `ai_infos.txt` nennt sie "Einheimische".
- Ein Dorf liegt auf einer Insel. Die Quellen beschreiben keine Anzahl.

### 4.2 Handel

- Man klickt die Häuptlingshütte an. Dort sieht man die Waren, die die Ureinwohner interessieren (FrankB, TPN 3.7.5).
- Liegt die markierte Fläche teilweise im Meer, fährt man mit dem Schiff dorthin und handelt direkt. Sonst braucht man ein Kontor auf der Insel, einen freien Weg zum Dorf und einen Marktwagen (FrankB, TPN 3.7.5).
- Der Handel beruht auf Tausch (TPN 3.7.5).
- **Verhältnis:** Manny nennt 1 : 1,5. Für 10 t Stoff oder Alkohol gibt es 15 t Ureinwohnerware. Eine Lieferung von 1 t wird auf 2 t aufgerundet. Das ergibt 2 t statt 1,5 t. Tim schreibt dazu "25 % mehr". Rechnerisch sind es 33 % mehr. **[WIDERSPRUCH]** (siehe 6, Punkt 7.)
- Ggcourt: Man bietet 1 t und verlangt 5 t. Das bringt oft 2 t für 1 t eigener Ware. Das braucht Zeit, lohnt sich aber.
- Robbie47: Die Ureinwohner geben doppelt so viel Zigarren oder Gewürze wie Stoff oder Alkohol. Die Zigarren sind vermutlich Tabakwaren. **[WIDERSPRUCH]** (siehe 6, Punkt 7.)
- Auf 50-%-Inseln brauchen die Dörfer gleich viel Stoff und Alkohol, bieten aber weniger Waren an (Robbie47, TST 5.4.1).
- Handel mit automatischen Routen geht auch mit Einzelpaketen zu 1 t (TST 5.4.1).

### 4.3 Missionen

- In den Quellen gibt es keine Missionen der Ureinwohner. Diese Lücke ist in Abschnitt 7 vermerkt.

### 4.4 Konflikte und Auslöser

- Ureinwohner greifen selten an. Meist provoziert man sie, indem man Militäreinheiten in ihre Siedlung bewegt (TTD 3.6.8).
- Versehentlich ausgelöst wird der Krieg, wenn man auf Hütten, Bäume oder Menschen schießt (FrankB, TTD 3.6.8).
- Ein Marktwagen im Kampfmodus, der beim Handeln zu nah an die Häuptlingshütte klickt, löst Krieg aus (Eric Lorah, TTD 3.6.8).
- Wer in Ureinwohnerland auf Bäume schießt, wird als Angreifer gesehen. Die Ureinwohner handeln dann nicht mehr (Wargamerit, TTD 3.6.8).
- Wer einen Stamm angreift, für den handelt danach niemand auf der Karte mehr mit dir (Robbie47, TPN 3.7.5 und TPN 5.5.1).
- Ureinwohner laufen durch die Stadt, wenn sie nahe genug an ihrem Dorf liegt. Das ist normal (Zomby Woof, TPN 3.7.6).

### 4.5 Folgen der Zerstörung eines Dorfes (Flüche)

- Zerstörst du ein Dorf, verhängt der Medizinmann (Tim: "medicine-man"; deutsche Bezeichnung nicht belegt) einen Fluch. Die Folgen sind häufigere Dürren, Brände und Seuchen. Außerdem kann man nicht mehr mit den Ureinwohnern handeln. Goldvorkommen unter Kontrolle der Ureinwohner werden zerstört (Zomby Woof, TPN 3.7.4). **[WIDERSPRUCH]** Robbie47 nennt Dürren und Vulkanausbrüche (siehe 6, Punkt 6).
- Der Häuptlingsfluch zerstört die Goldmine der Insel dauerhaft. Dort wird nie wieder Gold gefördert (Robbie47, TSPN 5.5.1).
- Flüche halten nicht ewig, sondern ungefähr 15 bis 20 Minuten Spielzeit (Joe Cool, TPN 3.7.4).

### 4.6 Vertreibung und Ausrottung

- Die Quellen beschreiben nur die vollständige Zerstörung eines Dorfs. Dabei werden alle Bewohner getötet, und es folgen die Flüche (4.5). Eine Vertreibung ohne Zerstörung nennen sie nicht.
- Robbie47 kämpft nie gegen die Ureinwohner. Begründung: Nach dem Krieg handelt niemand mehr mit einem, und die Flüche sind schädlich. Aus wirtschaftlicher Sicht ist der Handel mit ihnen günstig (TSPN 5.5.1).
- CGAD1 zerstört ein Dorf, wenn es im Weg steht und man es nicht braucht. Am Anfang sind Dörfer nützlich (TSPN 5.5.1).

---

## 5. Handels-Faustregeln (kurz)

1. **Monopol auf Alkohol und Gold:** Diese Waren bringen gute Preise (Shark_Dus, TST 5.4.1).
2. **Direkt an die KI verkaufen und bei der KI kaufen:** Das ist günstiger als bei Freien Händlern (Dietl, TST 5.4.1).
3. **Werkzeug:** Früh bei 70–75 kaufen. Ab etwa 105 zahlt ohnehin jeder. Mehr als 105 bringt nichts (Günter, TST 5.4.1).
4. **Überschuss verkaufen:** Produktion nicht stoppen, sondern Überschuss anbieten (Eric Lorah, TST 5.4.1).
5. **Verkaufsmenge knapp unter den Bestand setzen:** So werden Freie Händler angelockt (Waywardsoul, TST 5.4.1).
6. **Routen:** Pro Gut höchstens 100 t. Kleine Schiffe für kurze Strecken, große für lange. Hub-Insel als Zwischenlager nutzen (TTD 3.6.1 und TST 5.4.2).
7. **Kleine Ladung auf Auto-Route:** Kleine Schiffe sind schnell und entkommen Piraten (Neferankh, TSPN 5.5.2).
8. **Ureinwohner:** 1 t anbieten, 5 t verlangen. Einzellieferungen nutzen die Rundung aus (Ggcourt und Manny, TST 5.4.1).
9. **Ureinwohner nie angreifen:** Der Handel endet dauerhaft (TPN 3.7.5 und TSPN 5.5.1).
10. **Piraten:** Früh bestechen oder Nahrung kaufen. Nicht versenken, sondern beschädigen (TSPN 5.5.2).
11. **Krieg erst ab stabiler Wirtschaft,** etwa ab 700 bis 800 Kaufleuten (FrankB, TST 5.4.3).
12. **Keine Blockade auf unter 3 Feldern:** Das löst den Krieg aus (Guardian, TTD 3.6.8).
13. **Kaufpreis-Faustregel (berechnet):** Die KI verkauft für etwa zwei Drittel des Preises, zu dem sie kauft. Gewinn entsteht vor allem bei Gold, Schmuck, Kanone und Kleidung (siehe 2.5).

---

## 6. Widersprüche

| Nr. | Thema | Aussage A (Quelle) | Aussage B (Quelle) | Einordnung |
|---|---|---|---|---|
| 1 | Erscheinen Freier Händler | Beim ersten Kontor, bewegen sich aber erst mit einem zweiten (FrankB, TTD 3.6.5) | Erst beim zweiten Kontor (Budgie, TTD 3.6.5) | Ungeklärt. Version oder Szenario könnten eine Rolle spielen. |
| 2 | Schiffsobergrenze | 33 Schiffe (Eric Lorah, TSh 3.8.5) | 20 Schiffe in der UK-Version, laut AnnoDan1602 auch in der deutschen Originalversion (TSh 3.8.5) | Versionsabhängig. Die 20 gelten für die UK-Version sicher. |
| 3 | Große Schiffe an der kleinen Werft | Tabelle: keine Bauzeit angegeben ("–", TMIL) | Trick mit Bau an der Kleinen Werft, dauert länger (FrankB, TSh 3.8.2) | Der Trick wird beschrieben. Die Tabelle zeigt dafür keinen Wert. Die Angabe ist unvollständig, nicht zwingend falsch. |
| 4 | Kanonen-Spalte bei Schiffen | Spalte "Cannon" wie bei Türmen als Baukosten lesbar (TMIL) | Kanonen werden beim Bau nicht automatisch montiert (TSh 3.8.7) | Ob der Bau Kanonen verbraucht, ist aus den Quellen nicht klar. |
| 5 | Kosten für Bestechung der Piraten | Kein fester Betrag, abhängig vom eigenen Geld (FrankB, TSPN 5.5.2) | ca. 700, später 1400 Taler (Vorgängernotiz 03, nicht aus Tim) | Die Notiz 03 ist durch keine Quelle belegt. |
| 6 | Folgen eines Dorf-Fluchs | Dürren, Brände, Seuchen (Zomby Woof, TPN 3.7.4) | Dürren und Vulkanausbrüche (Robbie47, TSPN 5.5.1) | Die Quellen sind uneinheitlich. |
| 7 | Tauschverhältnis mit Ureinwohnern | 1 : 1,5 (Manny, TST 5.4.1) | Doppelt (Robbie47, TSPN 5.5.1), 2 : 1 (Ggcourt, TST 5.4.1) | Die Quellen sind uneinheitlich. Manny rechnet außerdem falsch: 2 t statt 1,5 t sind 33 % mehr, nicht 25 %. |
| 8 | Schiffskauf durch die KI | Kauft, wenn sie kein Schiff und keine Werft hat (Falke, TSh 3.8.4) | Kauft nach Versenkung des letzten Schiffs und Zerstörung der Werft (Robbie47, TSh 3.8.4). Eric Lorah hält Kauf für unwahrscheinlich (TSh 3.8.4). | Die Bedingungen unterscheiden sich. Eric Lorah meint wohl den Normalfall. |
| 9 | Kontor IV und 250er-Gebäude | Kontor IV, Hochschule, Goldschmied, Platz II und III: 250 Kaufleute (TBLD) | Dieselben Gebäude: 250 Bürger (GIGA) | Die Quellen widersprechen sich. TBLD ist ausführlicher, deshalb ist die Angabe dort als wahrscheinlicher zu werten. |
| 10 | Kanonengießerei | 400 Bürger (TBLD, Tabelle 1; GIGA) | 300 Kaufleute (TBLD, Tabelle 3, Voraussetzungen) | Intern widersprüchlich in TBLD. Mehrheit: 400 Bürger. |
| 11 | Vorgängernotiz 03 | Schwertschmiede ab 150 Bürgern, Kanonengießerei ab 250 Kaufleuten, Musketenbauer und große Burg ab 500 Kaufleuten, Feuerwehr ab 50 Pionieren | Schwertschmiede ab 200 Siedlern, Kanonengießerei ab 400 Bürgern (oder 300 Kaufleuten laut TBLD Tab. 3), Musketenbauer und große Burg ab 400 Kaufleuten, Feuerwehr ab 15 Siedlern (TBLD, GIGA) | Die Notiz 03 weicht bei fünf Punkten ab und sollte korrigiert werden. |

## 7. Lücken

Folgendes steht nicht in den Quellen:

- **Laderäume** der Schiffe außer dem Kleinen Kriegsschiff (3 Laderäume).
- **Reparatur:** Holz- und Stoffmenge pro Reparatur sowie Reparaturdauer.
- **Bestechung der Piraten:** konkrete Beträge und Zeitdauer.
- **Ureinwohner:** Missionen, vollständige Liste der Wunschwaren pro Dorf, genaue Anzahl und Lage der Dörfer.
- **Freie Händler:** keine Preise, nur Regeln zum Angebot.
- **Einheit der Preise:** Tim nennt keine Einheit. Vermutlich Credits pro Tonne.
- **Vertragsdauer und Tribute:** keine Zahlen zu Friedensdauer, Handelsvertragsdauer oder den Schwellen für "zu viel" oder "zu wenig" Zahlung.
- **Deutsche Namen:** Schiffstypen, Piratenlager (Nest), Marktwagen, Fuhrmann, Häuptling, Medizinmann, Pazifismus- und Neid-Regler. Nur die in Abschnitt 0 belegten Namen sind gesichert.
- **Kontor-Einflussbereich:** Die Bedeutung des zweiten Wertes (16/6) ist unklar.
- **Spalte "Stock"** in TBLD ist uneinheitlich (Lagerkapazität bei Kontoren, Ausgangsmenge bei Produktionsgebäuden).
- **Obergrenze der Parteien pro Insel:** nur FrankBs unsichere Angabe ("ich glaube sieben").
- **Piratenschiffe:** keine Kosten, keine Bauzeit.
- **Einheiten:** Schussintervall in Sekunden (TMIL), Tempo ohne Einheit.

**Hinweis zur Vollständigkeit:** Die sechs Pflichtdateien sind vollständig gelesen. Zusätzlich habe ich `tim_appendices_military_data`, `tim_appendices_building_industry_data`, `tim_gameplay_colony_buildings` und `tim_strategies_military_units` gezielt ausgewertet (Tabellen komplett, Textpassagen gezielt). `giga.txt` ist vollständig gelesen. `ai_infos.txt`, `wiki.txt` und `ai_ketten.txt` habe ich nur nach den benötigten Begriffen durchsucht, nicht vollständig gelesen.
