# Anno 1602: Kolonie- und Wirtschaftsfakten (Quelle A)

Stand: 2026-10-30. Erstellt ausschließlich aus lokalen Textdateien (kein Internetabruf).
Die Angaben sind in eigenen Worten formuliert. Zahlen, Gebäude- und Warennamen sowie Regeln sind aus den Quellen übernommen.

---

## 0. Quellen, Kürzel und Markierungen

| Kürzel | Datei | Inhalt |
|---|---|---|
| TH-IN | tim_introduction.txt | Tim Howgego FAQ, Kap. 2 (Einführung, Versionen, Systemanforderungen) |
| TH-SI | tim_gameplay_setup_interface.txt | Kap. 3.2 (Schwierigkeit, Pause, Spielende, Balance-Ziel) |
| TH-ES | tim_gameplay_essential_concepts.txt | Kap. 3.1 (Grundkonzepte) |
| TH-RS | tim_gameplay_resources.txt | Kap. 3.3 (Rohstoffe, Erze, Inseln) |
| TH-CB | tim_gameplay_colony_buildings.txt | Kap. 3.4 (Koloniegebäude) |
| TH-CD | tim_gameplay_colony_development.txt | Kap. 3.5 (Entwicklung, Ereignisse) |
| TH-SCP | tim_strategies_colony_planning.txt | Kap. 5.1 (Kolonieplanung, Stadtdesign) |
| TH-SIP | tim_strategies_industry_planning.txt | Kap. 5.2 (Industrieplanung, Produktionsketten) |
| TH-SCM | tim_strategies_colony_management.txt | Kap. 5.3 (Steuern, Karren als Lager, Brände) |
| AI | ai_infos.txt | annoinfo.de, Infoseite (Spieldaten, Features, Versionen) |
| WK | wiki.txt | de.wikipedia, Artikel Anno 1602 |

Markierungen:

- **[belegt]**: Zahl oder Regel, die die Quelle als Tatsache angibt. Nicht markiert = belegt.
- **[Erfahrung]**: Forenbeitrag oder Einzelerfahrung, die Tim oder die Infoseite zitieren. Der Wert gilt nicht als gesichert.
- **[abgeleitet]**: aus Quellenzahlen gerechnet (z. B. Einwohner je Haus) oder aus ASCII-Plänen abgelesen (Gebäudegrößen).
- **[DE-Übers.]**: deutsche Entsprechung, die in keiner der Quellen steht. Vor Verwendung prüfen.

Deutsche Begriffe, die in AI oder WK stehen, sind direkt belegt. Dazu gehören: Lagerhaus, Fischerhütte, Holzfällerhütte, Pionier, Siedler, Bürger, Kaufleute, Aristokraten, Wirtshaus/Taverne, Schule, Kirche, Badehaus, Arztpraxis, Hochschule, Theater, Kathedrale, Schloss, Triumphbogen, Stoff, Alkohol, Tabak, Gewürze, Kakao, Kleidung, Schmuck, Holz, Erz, Werkzeuge, Nahrungsmittel, Freie Händler, Piraten, Ureinwohner, Dürre, Pest, Brände.

Der Begriff "Kontor" kommt in keiner Quelle vor. Die Quellen nennen das Gebäude durchgehend "Warehouse". Das deutsche Original dafür ist in AI als "Lagerhaus" belegt.

---

## 1. Grundkonzepte

| Konzept | Regeln und Zahlen | Quelle |
|---|---|---|
| Lagerhaus (Warehouse) | Das erste Lagerhaus einer Insel wird vom Schiff aus an der Küste gebaut. Dafür braucht man 6 Holz, 3 Werkzeuge und 100 Münzen. Das Schiff muss die Baustoffe an Bord haben. Normal gibt es pro Insel nur ein Lagerhaus. Ausbau: Lagerhaus II, III und IV werden nur über einem bestehenden Lager gebaut. Es gibt Ausnahmen (ehemalige Piratenstützpunkte). Beim Bau wird laut Erfahrung automatisch 1 t Nahrung eingelagert. | TH-ES 3.1.2; TH-CB 3.4.9 (Robitoby, Sandmonkey) [Erfahrung] |
| Lagerkapazität | Nicht in den Quellen genannt. | Lücke |
| Lager-Schalter "Waren an Bevölkerung" | Am Lagerhaus gibt es ein Symbol. Ist es durchgestrichen, bekommt die Bevölkerung keine Waren aus dem Lager. Wer Aufstiegswaren hat und nicht aufsteigt, prüft diesen Schalter zuerst. | TH-CD 3.5.2 |
| Lagerhaus-Einfluss | Die Einflussfläche des Lagerhauses ist fest. Docks vergrößern sie nicht. Schiffe brauchen für das Anlegen keine Docks. | TH-CB 3.4.10 |
| Marktplatz (Market place) | Erweitert das Siedlungsgebiet. Er wird am Rand des bestehenden Gebiets gebaut. Freies Land wird dadurch beansprucht. Gebiet anderer Spieler lässt sich nur übernehmen, wenn man deren Marktplätze, Lager und Militärtürme zerstört. Jeder Marktplatz bringt zwei Karren. Er gilt als vergleichsweise günstig im Unterhalt. Abreißen eines Marktplatzes gibt Gebiet wieder auf. | TH-ES 3.1.2, 3.1.8; TH-SCP; TH-CB 3.4.2 |
| Marktkarren und Fuhrmann (Market wagon, Teamster) | Der Marktkarren mit Fuhrmann wird im Normalfall nur für Handel mit Spielern oder Ureinwohnern auf derselben Insel gebraucht. Er hat 30 t Ladekapazität und kann als Lagerersatz dienen. Feinde können ihn nicht zerstören. Ein dort geparkter Karren verhindert laut Erfahrung, dass die KI an dieser Stelle baut. | TH-SCM 5.3.2; TH-SCP 5.1.1 [Erfahrung] |
| Karren (Transport) | Ein Karren startet vom Lager oder Marktplatz, holt Ware an einem Gebäude mit Straßenanschluss ab und bringt sie zurück. Produktionsgebäude haben begrenzten Speicher. Ist er voll, stoppt die Produktion. | TH-ES 3.1.8 |
| Straßen | Jedes Gebäude braucht mindestens eine Feldseite mit Straßenanschluss. Gebäude müssen nicht an der Straße ausgerichtet sein. Der Anschluss ermöglicht Karren und Feuerwehrwagen den Zugang. Straßenarten: Erdweg (am langsamsten), Pflasterweg/Steinweg (cobbles) und Platz (square, am schnellsten). Gepflasterte Wege sollen Karren um etwa 30 % beschleunigen (Gamestar, zitiert von Charlie) [Erfahrung]. Auf Plätzen dürfen Karren diagonal fahren [Erfahrung]. | TH-ES 3.1.8; TH-CB 3.4.7 |
| Ausnahmen beim Transport (ohne Karren) | Steinmetze laufen zum Steinbruch. Dabei transportieren Karren nur Ziegel vom Steinmetz, nicht Steine aus dem Steinbruch. Weber laufen zur Schaffarm. Die meisten Grundfarmen, Erzschmelzen und Werften holen ihre Güter ebenfalls ohne Straße. Überschüssige Ware muss trotzdem über eine Straße abtransportiert werden können. Fehlt diese, sammelt sich die Ware nicht im Lager. | TH-ES 3.1.8 |
| Brücken, Mauern, Flüsse | Flüsse lassen sich nur an geraden Abschnitten überbrücken, nicht an Ecken. Steinbrücken brennen nicht ab, Holzbrücken schon. Stadtmauern dürfen nur an der Küste über Flüsse führen. Wegen Vulkanausbrüchen werden Erd- und Pflasterwege zerstört. Plätze bleiben erhalten. | TH-CB 3.4.7, 3.4.8; [Erfahrung] Manny |
| Docks als Straße | Docks können als Straßenersatz dienen, etwa um Minen am Ufer zu erreichen. | TH-CB 3.4.10; TH-SIP 5.2.4 |
| Einflussbereich (Service area) | Jedes Gebäude hat einen Einflussbereich, der beim Bauen und Anklicken hervorgehoben wird. Produktionsgebäude brauchen ihre Rohstoffe im eigenen Einflussbereich oder über Marktplatz/Lager auf der Insel. Öffentliche Gebäude wirken umgekehrt: Nur Häuser im Einflussbereich profitieren, etwa vom Feuerwehrschutz. Zahlenangaben zu Radien fehlen. Qualitativ gilt: Kapelle hat einen großen Kreis, Taverne den kleinsten Radius der Stadtgebäude, Feuerwehr einen kleinen. | TH-ES 3.1.7; TH-SCP 5.1.3 |
| Bedarf (Needs) | Nahrung ist ein Grundbedarf. Fehlt sie, verhungern die Bewohner und werden unzufrieden. | TH-ES 3.1.5 |
| Wünsche (Demands) | Wünsche sind Waren und Gebäude für den Aufstieg in die nächste Stufe. Die aktuelle Stufe bleibt auch ohne Erfüllung der Wünsche zufrieden. Beispiel: Siedler wollen eine Taverne für den Aufstieg, brauchen sie aber nicht, um Siedler zu bleiben. | TH-ES 3.1.5 |
| Zufriedenheit | Unzufriedene Bewohner verlassen die Stadt, und die Häuser verfallen. Leicht verärgerte Bewohner werten ihre Häuser nicht auf. Zufriedene erlauben höhere Steuern und füllen den verfügbaren Wohnraum. Im Steuerfenster zeigen Gesichter den Zustand. Die Steuer soll so hoch sein, dass die Gesichter nicht wütend werden (wargamerit) [Erfahrung]. | TH-ES 3.1.5; TH-SCM 5.3.1 |
| Steuern | Steuern sind die Haupteinnahme. Der Satz wird pro Bevölkerungsstufe eingestellt (Klick auf ein Haus dieser Stufe). Die Höchstsätze stehen in Abschnitt 2. Die Steuer wird zusammen mit den Produktionskosten im Minutentakt abgerechnet (Berechnungszeitraum 1 Minute; bei Tempo F5 knapp 60 Sekunden). Die Finanzanzeige hinkt, da die KI Handelsvolumen in 10 Teile über 10 Zyklen verteilt und der Durchschnitt über 10 Minuten gebildet wird [Erfahrung] (Shark_Dus). | TH-ES 3.1.4; TH-SCM 5.3.1 |
| Münzen und Waren | Münzen sind ein einziger Kontostand pro Spieler. Waren sind inselgebunden. | TH-ES 3.1.4 |
| Brände | Häuser fangen eher Feuer, wenn die Aufwertung zu langsam läuft [Erfahrung] (Helen). Mit höheren Stufen sinkt die Gefahr, aber kein Haus ist immun. Brände greifen auf Nachbarhäuser über, auch auf höhere Stufen [Erfahrung] (Frieden). Feuerwehr braucht Straßenanschluss und Einflussbereich. Sie sollte nicht direkt neben Häusern oder Marktplätzen stehen [TH-CD 3.5.6; Erfahrung FrankB]. Ein brennendes Pionierhaus lässt sich für Holz abreißen und neu bauen [Erfahrung] (Domdom). | TH-CD 3.5.6; TH-SCM 5.3.3 |
| Krankheit (Pest) | Ein befallenes Haus zeigt eine Figur mit Sense. Gegenmittel ist die Arztpraxis (Doctor). Die Häuser müssen im Einflussbereich liegen. Eine Straße ist nicht zwingend. Arztpraxen brauchen 50 oder mehr Bürger. Die Pest kann vor diesem Entwicklungsstand auftreten. | TH-CD 3.5.5 |
| Dürre | Während einer Dürre sterben alle Ernten. Nachpflanzen ist nicht nötig, verhindern lässt sich die Dürre nicht. | TH-RS 3.3.8 |
| Bauen | Ein Gebäude braucht Bauplatz, Münzen, die Baustoffe im Lager der Insel (nicht im Schiff, außer beim ersten Lager) und die Bevölkerungsvoraussetzung. Gebaut werden kann nur im eigenen Gebiet. | TH-CB 3.4.1; TH-ES 3.1.3 |
| Abreißen | Mit dem Hammer im Baumenü. Ein Bereich lässt sich per Ziehen löschen. Ein Lagerhaus lässt sich nur abreißen, wenn zuvor alle Gebäude der Insel weg sind [Erfahrung] (Helen). | TH-CB 3.4.2 |
| Erträge | Primärproduktion (Ernte, Abbau) wird weiterverarbeitet. Die Endprodukte verbraucht die Bevölkerung oder das Militär. Ein Beispiel: Erzschmelzen brauchen Erz und Holz für Eisen. Eisen wird danach zu Werkzeugen oder Waffen. | TH-ES 3.1.9 |
| Unterhalt (Betriebskosten) | Alle Gebäude außer Häusern haben Betriebskosten. Sie lassen sich teilweise senken, indem man das Gebäude abschaltet. Schiffe und Einheiten kosten beim Bau Münzen. Militär hat Unterhalt in Münzen, der unter "Militärkosten" läuft und nicht unter "Betriebskosten". Schiffsreparaturen brauchen Stoff und Holz. | TH-ES 3.1.4 |
| Lagerbestand | Produktionsgebäude haben begrenzten Speicher. Ist er voll, stoppt die Produktion. Ein Fragezeichen über einem Gebäude heißt, dass es nicht produziert, obwohl es läuft. Die Ursachen: fehlende Rohstoffe, Wachstum fehlt (Wald, Vieh), ungünstiger Standort, erschöpfte Mine oder fehlende Pflanzung [TH-CD 3.5.1]. | TH-ES 3.1.8; TH-CD 3.5.1 |
| Handel | Mit Spielern, Freien Händlern und Piraten tauscht man Münzen gegen Waren. Mit Ureinwohnern tauscht man Ware gegen Ware ohne Münzen. Die Freien Händler haben unbegrenzt Werkzeuge, solange niemand selbst Werkzeuge herstellt. Dann verknappt sich ihr Angebot [TH-RS 3.3.1]. | TH-ES 3.1.4; TH-RS 3.3.1 |
| Bankrott | Laut Erfahrung wird der Bankrott zeitgesteuert ausgelöst. Danach erscheint eine Gefängnisszene (muke09) [Erfahrung]. | TH-CD 3.5.9 |
| Vergrabener Schatz | Ein gefundener Schatz bringt 1000 Münzen. Er taucht gelegentlich beim Bauen auf. | TH-CD 3.5.8 |

---

## 2. Bevölkerungsstufen

Die fünf Stufen beginnen mit dem Pionier. Die Stufe bestimmt die Art des Hauses, das man beim Neubau erhält. Alle Wohnungen brauchen Nahrung.

| Stufe (EN / DE) | Wünsche (Anzahl Waren) | Max. Steuersatz | Einkommen je Einwohner / je Haus | Einwohner je Haus [abgeleitet] | Aufstieg zur nächsten Stufe | Baumaterial je Hausaufwertung | Quelle |
|---|---|---|---|---|---|---|---|
| Pioneer / Pionier | keine (nur Nahrung) | 48 % (voll versorgt) | 1,95 / 3,9 | 2 | Stoff (Cloth) vorhanden; Kapelle und Marktplatz im Zugriff; Nahrung; nicht überbesteuert | Neubau kostet nur Holz [Erfahrung] | TH-ES 3.1.3; TH-SCM 5.3.1 |
| Settler / Siedler | 2 Waren. Eine davon ist Kleidung (Clothes). Die zweite ist laut Erfahrung Tabak oder Gewürze [Erfahrung] | 33 % mit 1 von 2 Waren; 45 % voll versorgt | 2,11 / 12,66 | 6 | Taverne (Wirtshaus) als Wunsch. Laut Erfahrung Taverne und Schule, wenn man aufsteigen will (DPT) | nicht angegeben (siehe Bürger) | TH-ES 3.1.5; TH-SCM 5.3.1; TH-SCP 5.1.1 [Erfahrung] |
| Citizen / Bürger | 4 Waren | 20 % mit 2 von 4; 33 % mit 3 von 4; 38 % voll versorgt | 2,44 / 36,6 | 15 | Kaufleute-Stufe nicht im Detail belegt. Goldschmied wird laut Erfahrung bei Kaufleuten frei [Erfahrung] | 3 t Werkzeuge pro Bürgerhaus [Erfahrung] (FrankB) | TH-SCM 5.3.1; TH-CD 3.5.5; TH-SCP 5.1.2 |
| Merchant / Kaufleute | 5 Waren | 24 % mit 3 von 5; 32 % mit 4 von 5; 36 % voll versorgt | 2,53 / 63,25 | 25 | Stufe nicht im Detail belegt | 6 t Werkzeuge pro Kaufmannshaus [Erfahrung] (FrankB) | TH-SCM 5.3.1; TH-SCP 5.1.3 |
| Aristocrat / Aristokraten | 6 Waren (inkl. Schmuck) | 26 % mit 4 von 6; 31 % mit 5 von 6; 35 % voll versorgt | 2,65 / 106 | 40 | Endstufe. Für den Aufstieg in dieser Stufe braucht man laut Erfahrung 1 t Schmuck (FrankB) | 9 t Werkzeuge pro Aristokratenhaus [Erfahrung] (FrankB) | TH-SCM 5.3.1; TH-RS 3.3.5 |

Zusatzangaben zur Stufenlogik:

- Die höchste Stufe kann 20-mal so viele Menschen beherbergen wie die niedrigste [belegt] (TH-ES 3.1.4). Das passt zu 40 gegen 2 Einwohner je Haus.
- Ein Haus der Stufe Aristokraten braucht 6 Waren. Ein Pionier braucht keine. Die Steuer je Stufe steigt, je mehr Wünsche erfüllt sind.
- Wer die Wünsche nicht erfüllt, verliert Einwohner durch Abwanderung. Die Höchststeuer sinkt dann auf die Werte der Teilversorgung.
- Stufenspezifische Warenlisten (welche Ware in welcher Stufe) und Verbrauchsraten stehen im Anhang "Population per Industry". Dieser Anhang fehlt in der Dateiliste.
- Der Aufstieg zum Bürger verlangt die Taverne. Laut TH-ES wünschen Siedler sie für den Aufstieg. Laut Erfahrung braucht man zusätzlich die Schule (DPT). Dazu gibt es keine offizielle Angabe.
- Im Ultimate-City-Design braucht man laut TH-SCP mehr als 300 Kaufleute, bis alle Pflichtgebäude verfügbar sind.

---

## 3. Gebäude

Größen sind als Quadrate angegeben. Die Quellen liefern nur selten Größen im Text. Die übrigen Größen stammen aus den ASCII-Plänen und sind mit [abgeleitet] markiert. Ein Haus belegt eine Feldeinheit. Radien sind in den Quellen nicht als Zahlen angegeben.

Freischaltung: Die Schwellen aus TH-CD, TH-SCP und TH-SIP sind Bevölkerungsschwellen oder Empfehlungen. Offizielle Freischaltwerte stehen im Anhang "Building and Industry Data", der nicht in der Dateiliste ist.

### 3.1 Logistik und Verwaltung

| Gebäude (EN / DE) | Zweck und Wirkung | Größe | Freischaltung | Kosten (Bau / Betrieb) | Quelle |
|---|---|---|---|---|---|
| Warehouse / Lagerhaus | Zentrales Lager der Insel, Startpunkt jeder Kolonie. Ausbau II bis IV über dem bestehenden Lager. | 3 x 2 [abgeleitet] | Erster Bau vom Schiff | Erstes Lager: 6 Holz, 3 Werkzeuge, 100 Münzen. Betrieb: nicht beziffert | TH-ES 3.1.2; TH-CB 3.4.9; TH-SIP (Plan) |
| Market place / Marktplatz | Gebiet erweitern. Zwei Karren je Marktplatz. Verbindet Produktion mit Lager. | nicht angegeben | Ab Bedarf an Gebiet | Betrieb: vergleichsweise günstig. Baukosten nicht genannt | TH-ES 3.1.2, 3.1.8; TH-SCP |
| Market wagon / Marktkarren | Mobiles Lager mit 30 t Kapazität, Handel auf derselben Insel. | nicht angegeben | Nach Bedarf | nicht genannt | TH-SCM 5.3.2 |
| Dock / Anlegestelle | Zugang zu Küstenminen und Fischerhütten. Straßenersatz. Gibt dem Lager keine größere Reichweite. | nicht angegeben | nicht genannt | nicht genannt | TH-CB 3.4.10 |
| Gallows / Galgen | Soll Räuber von den Karren fernhalten. Wirkung umstritten (siehe Abschnitt 7). | 1 x 1 [abgeleitet] | nicht genannt | nicht genannt | TH-CB 3.4.3; TH-SCP (Plan) |
| Fire department / Feuerwache | Löscht Brände in Häusern im eigenen Einflussbereich. Braucht Straßenanschluss. Der Einflussbereich ist klein. | 2 x 2 [abgeleitet] | nicht genannt | nicht genannt | TH-CD 3.5.6; TH-SCP 5.1.3 |
| Doctor / Arztpraxis | Heilt Pest in Häusern im Einflussbereich. Straßenanschluss nicht zwingend. | 2 x 2 [abgeleitet] | Ab 50 Bürgern | nicht genannt | TH-CD 3.5.5; TH-SCP (Plan) |

### 3.2 Wohnen

| Gebäude (EN / DE) | Zweck und Wirkung | Größe | Kapazität | Baukosten | Betrieb | Quelle |
|---|---|---|---|---|---|---|
| Pioneer house / Pionierhaus | Basis-Wohnraum. Wird nur mit Nahrung versorgt. | 1 x 1 [abgeleitet] | 2 Einwohner | nur Holz [Erfahrung] | keiner (Häuser haben keine Betriebskosten) | TH-ES 3.1.3, 3.1.4; TH-SCM |
| Settler house / Siedlerhaus | Stufe nach Pionier. Braucht 2 Waren. | 1 x 1 [abgeleitet] | 6 Einwohner | Aufwertungsbedarf siehe Abschnitt 2 | keiner | TH-SCM; TH-SCP |
| Citizen house / Bürgerhaus | Stufe nach Siedler. Braucht 4 Waren. | 1 x 1 [abgeleitet] | 15 Einwohner | 3 t Werkzeuge [Erfahrung] | keiner | TH-SCM; TH-SCP 5.1.2 |
| Merchant house / Kaufmannshaus | Stufe nach Bürger. Braucht 5 Waren. | 1 x 1 [abgeleitet] | 25 Einwohner | 6 t Werkzeuge [Erfahrung] | keiner | TH-SCM; TH-SCP |
| Aristocrat house / Aristokratenhaus | Höchste Stufe. Braucht 6 Waren. | 1 x 1 [abgeleitet] | 40 Einwohner | 9 t Werkzeuge [Erfahrung] | keiner | TH-SCM; TH-ES 3.1.4 |

Hinweis zur Wohnraumgröße: Die Stadtpläne zeigen Häuser als Einzelquadrate. Häuserblöcke werden als 2 x 2, 3 x 2 oder 4 x 2 angelegt (siehe Abschnitt 6).

### 3.3 Öffentliche Gebäude, Kultur und Zierde

| Gebäude (EN / DE) | Zweck und Wirkung | Größe | Freischaltung | Bedingung / Hinweis | Quelle |
|---|---|---|---|---|---|
| Chapel / Kapelle | Pioniere werden zu Siedlern, wenn Kapelle und Marktplatz verfügbar sind. Großer Einflussbereich. | 3 x 4 [abgeleitet] (Robbie47) | Früh | Wird durch die Kirche ersetzt, sobald diese im Einflussbereich steht. | TH-ES 3.1.3; TH-CB 3.4.6; TH-SCP |
| Church / Kirche | Ersetzt Kapelle im Einflussbereich. | 3 x 4 [abgeleitet] (Plan) | nicht genannt | Ältere öffentliche Gebäude im Einflussbereich sind danach entbehrlich. | TH-CB 3.4.6; TH-SCP (Plan) |
| Tavern / Taverne (Wirtshaus) | Alkoholwunsch. Für den Aufstieg vom Siedler zum Bürger. | 3 x 2 [abgeleitet] | Vor dem Bürger | Kleinster Einflussbereich unter den Stadtgebäuden. | TH-ES 3.1.5; TH-SCP (Plan) |
| School / Schule | Bildungsgebäude. Laut Erfahrung braucht man sie zum Aufstieg zum Bürger. | 3 x 3 [abgeleitet] (Robbie47) | nicht genannt | Ersetzt durch die Hochschule. | TH-SCM; TH-SCP; TH-CB 3.4.6 |
| College / Hochschule | Ersetzt die Schule im Einflussbereich. | 3 x 3 [abgeleitet] (Plan) | Ab Kaufleute-Stufe [abgeleitet] | nicht genannt | TH-CB 3.4.6; TH-SCP (Plan) |
| Bathhouse / Badehaus | Öffentliches Gebäude für die oberen Stufen. | 3 x 4 [abgeleitet] (Plan) | nicht genannt | nicht genannt | WK (Badehäuser); TH-SCP (Plan) |
| Theatre / Theater | Öffentliches Gebäude für die oberen Stufen. | 3 x 3 [abgeleitet] (Plan) | Ab Kaufleute-Stufe [abgeleitet] | nicht genannt | WK (Theater); TH-SCP (Plan, Robbie47) |
| Cathedral / Kathedrale | Nur einmal pro Spiel. Zeitweise höhere Steuern (laut Charlie maximal 30 Minuten). | nicht angegeben | nicht genannt | Nur eine Kathedrale | TH-CB 3.4.4, 3.4.5; WK |
| Palace / Schloss | Nur einmal pro Spiel. Zeitweise höhere Steuern (laut Charlie maximal 30 Minuten). | nicht angegeben | nicht genannt | Nur ein Schloss | TH-CB 3.4.4, 3.4.5; WK |
| Arch of Triumph / Triumphbogen | Monument nach dem Sieg über einen Gegner. Auch nach Piratensieg, wenn das Szenario Piraten als Gegner führt. | nicht angegeben | Nach Sieg | Im Normalfall höchstens drei Gegner (TH-CB 3.4.4) | TH-CB 3.4.4; WK |
| Gold statue / Goldstatue | Gibt es nach 30 Minuten Spielzeit bei normaler Geschwindigkeit und zufriedener Bevölkerung (Mircea) [Erfahrung]. | nicht angegeben | Mindestens Bürger-Stufe | nicht genannt | TH-CB 3.4.4 |
| Statues / Statuen | Beliebig viele. Laut Erfahrung eine Statue je Zufriedenheitspunkt (Eric Lorah) [Erfahrung]. | nicht angegeben | nicht genannt | nicht genannt | TH-CB 3.4.5 |
| Flowerpot avenue / Park | Dekorativ, Platz für Statuen (Robbie47) [Erfahrung]. | nicht angegeben | nicht genannt | nicht genannt | TH-SCP 5.1.2 |

### 3.4 Rohstoffgewinnung und Forst

| Gebäude (EN / DE) | Zweck und Wirkung | Größe | Freischaltung | Kosten / Betrieb | Quelle |
|---|---|---|---|---|---|
| Woodcutter / Holzfällerhütte | Liefert Holz. Laut Empfehlung drei Holzfäller früh. | nicht angegeben | Früh (Start) | nicht beziffert | AI; TH-SCP 5.1.1 |
| Forester's hut / Försterhütte | Pflanzt Bäume. Bei leerem Umfeld dauert der Start laut Zomby Woof 13 Minuten bei F5. | 2 x 2 [abgeleitet] (Plan) | Früh | nicht beziffert | TH-SIP (Plan); TH-SIP 5.2.1 |
| Fisher's hut / Fischerhütte | Liefert Nahrung. Eine Hütte ernährt laut Erfahrung rund 70 Einwohner. Effizienz 75 bis 100 %. Braucht mindestens 9 Fischfelder im Einzugsgebiet [Erfahrung] (Khang). Fischen geht nicht am Ufer oder im offenen Meer. | 1 x 1 [abgeleitet] (Plan) | Früh | 2 Fischerhütten kosten zusammen 6 Werkzeuge [Erfahrung] (Khang) | AI; TH-SIP 5.2.5; TH-RS 3.3.12 |
| Hunter's lodge / Jägerhütte | Liefert Wildfleisch aus Hirschen. Theoretisch bis 92 t, wenn 4 Hirsch-Respawn-Felder im Radius liegen [Erfahrung] (Khang). | nicht angegeben | nicht genannt | nicht genannt | TH-SIP 5.2.5 |
| Stonemason's hut / Steinmetz | Erzeugt Ziegel aus Steinen. Läuft zum Steinbruch. Zwei Steinmetze reichen für einen Steinbruch. | nicht angegeben | Mit Siedlern (laut Empfehlung ab 15 Siedlern) | nicht beziffert | TH-ES 3.1.8; TH-RS 3.3.1; TH-SIP 5.2.4; TH-SCP (Frieden) |
| Quarry / Steinbruch | Bau nur am Fuß eines mittleren oder großen Berges auf einer geraden Felsreihe. Der Standort liegt im Einflussbereich von Marktplatz oder Lager. | nicht angegeben | nicht genannt | nicht beziffert | TH-RS 3.3.1 |
| Iron mine / Eisenmine (klein) | Baut Eisenerz ab. Laut Erfahrung ab 120 Siedlern. | nicht angegeben | 120 Siedler [Erfahrung] (DPT) | nicht beziffert | TH-RS 3.3.1 |
| Deep iron mine / Tiefe Eisenmine | Baut den Rest eines Erzvorkommens ab, wenn die normale Mine erschöpft ist. | nicht angegeben | Bürger-Stufe [Erfahrung] (Stefanus Franzosus); 450 Bürger laut Zomby Woof [Erfahrung] | nicht beziffert | TH-RS 3.3.2, 3.3.3; TH-SCP 5.1.2 |
| Gold mine / Goldmine | Baut Gold ab. Gold erschöpft sich beim Abbau nicht. Mehrere Minen pro Vorkommen sind möglich. | nicht angegeben | nicht genannt | nicht beziffert | TH-RS 3.3.3, 3.3.5; TH-SIP 5.2.4 |
| Ore smelter / Erzschmelze (auch "Ore refinery") | Macht aus Erz und Holz Eisen. | 2 x 2 [abgeleitet] (Plan) | nicht genannt | nicht beziffert | TH-ES 3.1.9; TH-SIP (Plan) |
| Tool maker / Werkzeugmacher (auch "Tool smithy") | Macht aus 1 t Eisen 2 t Werkzeuge (Dread Pirate Terry) [Erfahrung]. | 2 x 2 [abgeleitet] (Plan) | nicht genannt | nicht beziffert | TH-SIP 5.2.4; TH-SIP (Plan) |
| Cannon foundry / Kanonengießerei | Produziert Kanonen. Verbraucht Eisen. Kanonen dienen als Baumaterial für bestimmte Gebäude. | 3 x 3 [abgeleitet] (Plan) | nicht genannt | nicht beziffert | TH-ES 3.1.3; TH-SIP 5.2.4; TH-SIP (Plan) |
| Armorer und Musket maker / Rüstungsschmied und Musketenmacher [DE-Übers.] | Werkstätten, die Eisen verarbeiten. | nicht angegeben | nicht genannt | nicht beziffert | TH-SIP 5.2.4 |

### 3.5 Landwirtschaft, Verarbeitung und Dienste

| Gebäude (EN / DE) | Zweck und Wirkung | Größe | Freischaltung | Kosten / Betrieb | Quelle |
|---|---|---|---|---|---|
| Grain farm / Getreidefarm | Liefert Getreide. Braucht laut Erfahrung eine Straße (DPT). | 2 x 2 [abgeleitet] (Plan) | Früh | nicht beziffert | TH-SIP (Plan); TH-SIP 5.2.5 |
| Windmill / Windmühle | Verarbeitet Getreide zu Mehl. Zwei Getreidefarmen je Windmühle. | 2 x 2 [belegt] (Text) | nicht genannt | nicht beziffert | TH-SIP 5.2.3 |
| Bakery / Bäckerei | Verarbeitet Mehl zu Brot. | 2 x 2 [abgeleitet] (Plan) | nicht genannt | nicht beziffert | TH-SIP (Plan) |
| Sheep farm / Schaffarm | Liefert Wolle. Weber holen die Wolle selbst ab. Straße nur für Überschuss nötig. | nicht angegeben | Früh | nicht beziffert | TH-ES 3.1.8; TH-SIP 5.2.7 |
| Weaver's hut / Weberei | Verarbeitet Wolle zu Stoff (Cloth). Eine Weberei kann die Wolle von zwei Schaffarmen verarbeiten [Erfahrung] (Robbie47). | nicht angegeben | Früh | nicht beziffert | TH-ES 3.1.7; TH-SCP 5.1.1 |
| Cattle farm / Viehfarm (Rinderzucht) | Erzeugt zwei Kühe. Jede weidet auf drei Feldern. Mit 20 Weidefeldern rund 92 % Effizienz [Erfahrung] (Khang). | 2 x 2 [abgeleitet] (Plan) | Früh | nicht beziffert | TH-SIP 5.2.5 |
| Butcher / Metzgerei | Verarbeitet Vieh zu Fleisch (Nahrung). | 2 x 2 [abgeleitet] (Plan) | Früh | nicht beziffert | TH-SIP 5.2.5 |
| Plantations / Plantagen (Tabak, Zuckerrohr, Baumwolle, Kakao, Gewürze, Weinreben) | Sonderkulturen. Erträge abhängig von der Eignung der Insel (Abschnitt 4). Bei Tabak, Zuckerrohr und Wein erfolgt die Verarbeitung im Verarbeitungsgebäude. | 2 x 2 [abgeleitet] (Plan) | Nach Erkundung | nicht beziffert | TH-RS 3.3.1; TH-SIP 5.2.6 |
| Vineyard / Winery / Winzerei | Macht aus Weinreben Wein. Eine Winzerei versorgt laut Neferankh 167 Einwohner aus 24 bis 25 Feldern. | nicht angegeben | nicht genannt | Unterhalt 35 Münzen [Erfahrung] (Neferankh) | TH-SIP 5.2.6 |
| Distillery / Brennerei | Macht aus Zuckerrohr Rum. Zwei Zuckerrohrplantagen (je 21 Felder) plus eine Brennerei versorgen laut Neferankh 334 Einwohner. | nicht angegeben | nicht genannt | Unterhalt 15 Münzen [abgeleitet] (aus der Summe 85 gegen zwei Plantagen mit je 35 Münzen) | TH-SIP 5.2.6 |
| Alcohol and tobacco processing / Verarbeitung (Tabak, Alkohol) [DE-Übers.] | Verarbeitungsgebäude im Plan ("Processing") für Tabak und Alkohol. | 2 x 2 [abgeleitet] (Plan) | nicht genannt | nicht beziffert | TH-SIP 5.2.3 |
| Baker, tobacconist, weaver, tailor, goldsmith / Bäcker, Tabakhändler, Weber, Schneider, Goldschmied [DE-Übers., außer Weber] | In der Stadt erlaubte Handwerksbetriebe (Robbie47). Der Goldschmied liefert Schmuck für Aristokraten. Er wird laut Erfahrung bei Kaufleuten frei [Erfahrung]. | nicht angegeben | nicht genannt | nicht beziffert | TH-SCP 5.1.2; TH-RS 3.3.5 |
| Shipyard / Werft (Schiffswerft) | Baut Schiffe. Braucht laut Text keine Straße für die Lieferung, Überschuss braucht Straße. | nicht angegeben | nicht genannt | nicht beziffert | TH-ES 3.1.8 |
| Watermill / Wassermühle (NINA) | Nur in der Feature-Liste der Erweiterung genannt. | nicht angegeben | NINA | nicht beziffert | TH-IN 2.4 (Shark_Dus) |

### 3.6 Betriebskosten (Zusammenfassung, soweit belegt)

| Gebäude | Betriebskosten | Quelle |
|---|---|---|
| Häuser (alle Stufen) | keine | TH-ES 3.1.4 |
| Alle übrigen Gebäude | Betriebskosten, die sich teilweise durch Abschalten senken lassen | TH-ES 3.1.4 |
| Winzerei | 35 Münzen | TH-SIP 5.2.6 (Neferankh) |
| Zuckerrohrplantage | 35 Münzen je Plantage [abgeleitet] | TH-SIP 5.2.6 (Neferankh) |
| Brennerei | 15 Münzen [abgeleitet] | TH-SIP 5.2.6 (Neferankh) |
| Marktplatz | vergleichsweise günstig | TH-SCP |
| Militär | Unterhalt in Münzen, unter "Militärkosten" | TH-ES 3.1.4 |

---

## 4. Rohstoffe und Inseln

### 4.1 Vorkommen und Eignung

| Thema | Regel | Quelle |
|---|---|---|
| Erkundung | Ein Schiff muss nahe an die Insel. Das Auge-Symbol startet die Erkundung. Der rote Balken muss voll sein. Erst danach zeigen sich Eignungen und Erzvorkommen. Bricht man die Erkundung ab, bietet das Spiel den Button später nicht mehr an. Laut Erfahrung kann die KI dann Vorkommen nutzen, die man nie gesehen hat [Erfahrung] (Lord Khang). | TH-ES 3.1.1; TH-RS 3.3.1 |
| Sonderkulturen | Kakao, Baumwolle, Gewürze, Zuckerrohr, Tabak und Weinreben brauchen eine Eignung. Der Mauszeiger zeigt die Prozentwerte, z. B. Kakao 100 %, Baumwolle 50 %. | TH-ES 3.1.1 |
| Grundkulturen | Getreide, Bäume und Vieh wachsen auf jeder Insel ohne Bodenanforderung. | TH-ES 3.1.1; TH-RS 3.3.6 |
| Eignung unter 100 % | Bei 50 % fallen die Hälfte der Felder aus. Bei Pflanzung auf schlechter Eignung stirbt laut Regel ein Anteil der Felder ab. Dieser Anteil folgt einem Muster, das sich auf der Insel wiederholt (Charlie) [Erfahrung]. Erfahrung: Pflanzt man 100 Felder einer 50-%-Kultur, wachsen rund 50. Mit einem Muster lassen sich laut DPT 60 % Ertrag erreichen [Erfahrung]. | TH-ES 3.1.1; TH-RS 3.3.8; TH-SIP 5.2.1 |
| Nord und Süd | Nordinseln eignen sich für Tabak, Weinreben und Zuckerrohr. Südinseln eignen sich für Kakao, Baumwolle und Gewürze. Erkennungszeichen laut Erfahrung: Palmen im Süden, Kiefern im Norden (anto) [Erfahrung]. | TH-RS 3.3.6 |
| Bäume auf Nord- und Südinseln | Die Wachstumsgeschwindigkeit ist gleich. Beide erreichen 90 bis 100 % (Zomby Woof) [Erfahrung]. | TH-SIP 5.2.1 |
| Fruchtbarkeit | Grüne Flächen sind fruchtbarer als braune Steppe oder Wüste. Auf Steppe oder Wüste wächst alles langsamer. Dunkelgrün ist laut Erfahrung 10 bis 15 % fruchtbarer (DPT). | TH-RS 3.3.10; TH-SIP 5.2.2 |
| Berge und Felsen | Nicht abtragbar. | TH-RS 3.3.11 |
| Erzvorkommen | Nur auf Inseln mit Bergen. Eisenerz ist mit Hämmern über dem Berg markiert, Gold ähnlich. | TH-ES 3.1.1; TH-RS 3.3.1 |
| Wald und Wild | Hirsche brauchen eine Mischung aus Bäumen und offenem Land. Zu viele Bäume töten sie [Erfahrung] (Eric Lorah). Hirsche sterben, wenn sie Tabak, Gewürze, Baumwolle oder Zuckerrohr fressen. Wein fressen sie ohne Schaden [Erfahrung] (Robitoby). | TH-RS 3.3.9 |
| Fischgründe | Fische leben in Flach- bis Tiefwasser. Die Zone geht von Flach- und Mittelwasser bis Mitte/Tief. Reines Tiefwasser, Ufer und Strand bieten keine Fische. | TH-RS 3.3.12 |
| Inselgrößen (Manfred) | large 100 x 90 (laryy.scp); big 70 x 60 (bigyy.scp); medium 50 x 52 (medyy.scp); small 40 x 40 (mityy.scp); little 30 x 30 (lityy.scp). | TH-RS 3.3.7 |
| Inselzahl | Über 300 Inseln (AI, Feature-Liste). | AI |
| Landschaftstypen | Die Inseln haben verschiedene Landschaftstypen (AI). Laut TH-RS gibt es Berge sowie Steppe und Wüste, die braun dargestellt werden. | AI; TH-RS 3.3.10 |

### 4.2 Erschöpfung

| Ressource | Regel | Quelle |
|---|---|---|
| Eisenerz | Erschöpft sich. Ein kleines Vorkommen hat 80 t, ein großes 240 t. Manche Vorkommen sind unerschöpflich. Auf einer Karte haben alle großen Minen denselben Typ. Eisen braucht man nur zum Bauen, deshalb darf das Vorkommen enden (Sir Henry). | TH-RS 3.3.2, 3.3.3 |
| Tiefe Eisenmine | Bei endlichem Vorkommen erschöpft sich die tiefe Mine nach 240 t, einschließlich der 80 t der kleinen Mine. Unendlich bleibt die Mine, wenn das Vorkommen unendlich ist. | TH-RS 3.3.3 (FrankB, Robitoby) |
| Gold | Erschöpft sich durch Abbau nicht. Gold braucht man auch nach dem Bauen. Auf einigen Karten gibt es keines (Fehler laut Günter). Ein Vorkommen gibt es meist mindestens eins. | TH-RS 3.3.3, 3.3.4 |
| Gold und Ureinwohner | Zerstört man die Ureinwohner einer Insel, kann das Goldvorkommen verschwinden. Laut Guardian gilt das nur für spätere Versionen. Die Erfahrung von robbie47 ist uneindeutig [Erfahrung]. | TH-RS 3.3.3 |
| Vulkane | In späteren Versionen sind Vorkommen in Vulkanen nicht abbaubar. Vulkanausbrüche gibt es in NINA "von Zeit zu Zeit". | TH-RS 3.3.3; TH-IN 2.4 |
| Holz | Förster pflanzen nach. Bäume brauchen Zeit: Bei leerem Umfeld dauert der Start des Försters 13 Minuten bei F5 (Zomby Woof). | TH-SIP 5.2.1 |
| Fische | Fischgründe müssen nachwachsen. Ohne mindestens 9 Felder wartet die Hütte oder überfischt, ohne zu produzieren [Erfahrung] (Khang). | TH-SIP 5.2.5 |
| Wild | Hirsche werden aus Waldfeldern nachgebildet, wenn Wald und freie Felder gemischt sind. Dann läuft der Jäger nahe 100 % [Erfahrung] (Robitoby, Jumpster). | TH-SIP 5.2.5 |
| Dürre | Trifft alle Ernten. Nicht zu verhindern. | TH-RS 3.3.8 |

---

## 5. Spieleinstellungen, Oberfläche und Spielmodi

### 5.1 Spielmodi und Schwierigkeit

| Thema | Regel | Quelle |
|---|---|---|
| Szenarien | Haben feste Ziele, oft Bevölkerungsziele. Das Spiel endet mit Zielerfüllung. | TH-SI 3.2.4 |
| Endlosspiel (Continuous play) | Keine festen Ziele. Der Spieler entscheidet, wann er aufhört. Eine Endwertung (Final Score) ist im Anhang beschrieben. Der Anhang fehlt in der Dateiliste. | TH-SI 3.2.4 |
| Endlos: Umfeld | Ureinwohner-Dörfer auf der Inselwelt. Piraten greifen je nach Schwierigkeit an. Brände, Dürre und Pest kommen vor. | WK; TH-SI 3.2.2 |
| Gegner | Im Endlosmodus lässt sich die Zahl der KI-Gegner nicht verringern. Normal gibt es höchstens drei Gegner (TH-CB 3.4.4). | TH-SI 3.2.2 |
| Schwierigkeit "leicht" (Easy) | 20 000 Startmünzen. Piraten gibt es in allen Stufen außer der leichtesten. | TH-SI 3.2.2 |
| Schwierigkeit "schwer" (Difficult) | 10 000 Startmünzen. Die schwerste Stufe hat 30 bis 50 % weniger Chance auf geeignetes Land und 75 % weniger Chance auf große Erzvorkommen (Quelle schreibt "endless?", also vermutlich unerschöpflich). Weniger Schätze. Mehr Piratenaktivität. | TH-SI 3.2.2 |
| Balance-Ziel (Gesamt) | Steuerertrag plus Handelsertrag, minus Produktionskosten, minus Militär, minus Warenkäufe. | TH-SI 3.2.7 (Shark_Dus) |
| Balance-Ziel (Handel) | Nur Handelsbewegungen (Käufe und Verkäufe) zählen. | TH-SI 3.2.7 |
| Ziele anzeigen | Optionsmenü, Buchstabe "A" (Assignment) über dem Diskettensymbol. | TH-SI 3.2.8 |

### 5.2 Oberfläche und Bedienung

| Thema | Regel | Quelle |
|---|---|---|
| Pause | Pause-Taste. Alt+Tab minimiert und pausiert. Das Fragezeichen öffnet die Statistik und pausiert ebenfalls. Shift+P öffnet ein Screenshot-Fenster, das die Sicht auf die Insel frei gibt (nicht in allen Versionen) [Erfahrung] (MWHC). | TH-SI 3.2.3 |
| Umbenennen | Stadt- oder Schiffsname anklicken, mit Rücktaste löschen, neu eingeben, Enter. | TH-SI 3.2.5 |
| Rückgängig | Nicht vorhanden. Man lädt einen Spielstand. | TH-SI 3.2.6 |
| Geschwindigkeit | Die Angaben zur Dauer beziehen sich auf Tempo F5. | TH-ES 3.1.4; TH-SCM 5.3.1 |
| Handbuch | Frühere Versionen mit gedrucktem Handbuch. Spätere Versionen (inkl. US-Version) mit "1602manu.pdf" auf der CD. | TH-SI 3.2.1 |
| Sprachen | Deutsch, Englisch, Französisch, Italienisch, Spanisch (Spanien), Polnisch, Niederländisch. | AI |

### 5.3 Versionen und Editionen

| Edition | Inhalt | Termin laut Quellen | Quelle |
|---|---|---|---|
| Anno 1602 (Hauptspiel) | Grundspiel. Deutsche Erstveröffentlichung. | 1997 (TH-IN) oder 31.03.1998 (WK, AI) | TH-IN 2.4; WK; AI (siehe Abschnitt 7) |
| Internationale Version | Englisch, Französisch, Niederländisch, Spanisch, Italienisch, Polnisch, Japanisch. | 1998 (Europa und Japan) | TH-IN 2.4 |
| NINA (Neue Inseln, Neue Abenteuer) | Erweiterung für die deutsche Version. Karteneditor, Wassermühle, Wal und Delfine, Vulkane, Verbesserung der KI, zusätzliche Szenarien. Unbenutzte Schiffe lassen sich versenken. Limit auf 33 Schiffe erhöht. Die Liste stammt von Shark_Dus. | 12.11.1998 (AI, WK) | TH-IN 2.4; AI; WK |
| Im Namen des Königs | Zweite deutsche Erweiterung. Eigene Programmdatei. Szenarien und Spielstände sind mit dem Rest von 1602 nicht kompatibel. Sir Henry bestätigt: nicht Teil der Königsedition. | 30.11.1998 (WK, AI) oder "9 Monate nach NINA" (TH-IN, Shark_Dus) | TH-IN 2.4, 2.6; WK; AI |
| Königsedition | Grundspiel, NINA und Patches. Laut TH-IN ohne Im Namen des Königs. | 1999 (TH-IN) oder 30.11.1998 (AI) | TH-IN 2.4; AI; WK |
| 1602 A.D. (Nordamerika, Australien) | Grundspiel, Erweiterung und Patches. | 2000 | TH-IN 2.4 |
| Gold Edition (International, UK/NL) | Grundspiel, Erweiterung und Patches. Kaum verbreitet. | 2000/2001 | TH-IN 2.4 |
| Anno History Collection / History Edition | Remaster mit 4K-Unterstützung, Borderless-Modus, Uplay-Multiplayer und Speicherkompatibilität. Bonusinhalte. | 25.06.2020 | AI; WK |

Umfang laut Quellen:

- Über 90 Gebäude, über 30 Berufsgruppen, über 300 Inseln, 5 Einführungsspiele (AI).
- NINA: 20 zusätzliche Szenarien in 6 Kampagnen, 7 neue Einzelspielerszenarien, 30 zusätzliche Mehrspielerszenarien (TH-IN, Shark_Dus). Laut AI "über 40 neue Szenarien und 200 Inseln" (Widerspruch, Abschnitt 7).
- Königsedition laut WK: über 100 Missionen (Einzel- und Mehrspieler).
- Im Namen des Königs: 27 Szenarien in 6 Kampagnen, 8 Einzelspieler, 5 Mehrspieler (Shark_Dus, TH-IN 2.6).

### 5.4 Systemanforderungen und Plattform

| Thema | Angabe | Quelle |
|---|---|---|
| Betriebssystem | Windows 95 oder 98. Mit Windows 2000 oder XP nach Anpassung lauffähig. | TH-IN 2.3; AI |
| Prozessor | Pentium 100 (AI: 100 MHz oder vergleichbar) | TH-IN 2.3; AI |
| Arbeitsspeicher | 16 MB | TH-IN 2.3; AI |
| Grafik | PCI-Grafikkarte mit 2 MB VRAM | TH-IN 2.3; AI |
| Festplatte | 85 MB (TH-IN) oder 160 MB (AI). Widerspruch. | TH-IN 2.3; AI |
| Sound | SoundBlaster oder kompatibel, DirectX 6 oder neuer | TH-IN 2.3; AI |
| CD-ROM | 4-fach | TH-IN 2.3; AI |
| Mehrspieler | Netzwerk (LAN, Internet) und Modem. AI: bis 4 Spieler über Netzwerk, 2 über Modem. | WK; AI |
| Patchen | Nur Anno 1602 patchen. Die Version 1602 A.D. nicht patchen, da sonst die meisten Szenarien verschwinden. | TH-IN 2.5 |
| Linux | Offiziell nicht unterstützt. Einzelspieler lässt sich laut Erfahrung mit Wine nutzen. Mehrspieler friert ein [Erfahrung] (cipher). | TH-IN 2.7 |
| Spielerzahl pro Insel | Laut Erfahrung etwa sieben Spieler (FrankB, unsicher) | TH-CB 3.4.9 |

---

## 6. Planungs-Faustregeln

Die Regeln stammen aus Tims Strategieteil und aus den Forenbeiträgen, die dort stehen. Sie sind keine offiziellen Spielregeln.

### 6.1 Start und Reihenfolge

| Thema | Faustregel | Status / Quelle |
|---|---|---|
| Erste Insel | Groß, mit Erz, Bergen für Steinbruch, Bäumen und mindestens einer 100-%-Kultur (Tabak oder Wein/Zuckerrohr). | TH-SCP 5.1.1 (Budgie, BigTiny, Charlie, Shark_Dus) [Erfahrung] |
| Lagerhaus | Nicht in die Bucht bauen, sondern an gerade Küste oder Halbinsel. Bucht erschwert Schiffsverkehr. | TH-SCP 5.1.1 (Charlie, Shark_Dus) [Erfahrung] |
| Reihenfolge (Frieden) | 1. Lager, Fischerhütte, 2 bis 3 Holzfäller, 1 bis 2 Marktplätze, Kapelle mit großem Einflussbereich. 2. Einige Häuser um die Kapelle, Pionier-Steuer maximal, Schaffarm und Weberei. 3. Höchstens 20 Häuser, Siedler kommen, Siedler-Steuer leicht erhöhen. 4. Ab 15 Siedlern: Steinmetz und Steinbruch, Feuerwache. 5. Ab 40 Siedlern: Alkohol herstellen, Siedler-Steuer deutlich erhöhen. 6. Keine Taverne und keine Schule, zweite Fischerhütte, warten bis 120 Siedler, dann Geld wird grün. 7. Werkzeugproduktion. | TH-SCP 5.1.1 [Erfahrung] |
| Frühe Häuserzahl | 20 Häuser sind laut Erfahrung eine "magische Zahl" für 120 Siedler (Budgie). Danach 10 bis 15 weitere Häuser, sobald Holz und Werkzeuge reichen (FrankB). | TH-SCP 5.1.1, 5.1.2 [Erfahrung] |
| Stadtgröße | Etwa 30 Häuser (FrankB). Mit 15 Bürgern je Haus ergibt das 450 Bürger (Zomby Woof). | TH-SCP 5.1.2 [Erfahrung] |
| Tempo | Nicht zu schnell aufsteigen, sondern Bevölkerung erst wachsen lassen (Ryan H). Die KI rückt nur langsam vor und stockt, wenn man nichts tut (Zomby Woof). | TH-SCP 5.1.1 [Erfahrung] |
| Steuern und Betriebskosten | Die Steuer sollte über den Betriebskosten liegen. Ist das nicht so, braucht man mehr Steuerzahler (Eric Lorah). | TH-SCP; TH-SCM 5.3.1 [Erfahrung] |
| Wünsche erfüllen | Nicht alle Wünsche sofort erfüllen. Taverne und Schule erst beim Aufstieg zum Bürger (DPT). Luxusgüter in einer großen Lieferung bereitstellen, damit mehr Einwohner gleichzeitig aufsteigen (Rendell). | TH-SCP 5.1.1; TH-SIP 5.2.1 [Erfahrung] |

### 6.2 Nahrung, Produktionsketten und Verhältnisse

| Thema | Faustregel | Zahl | Quelle |
|---|---|---|---|
| Nahrung Fischerhütte | Eine Fischerhütte ernährt rund 70 Einwohner. Zwei Fischerhütten reichen für etwa 140. | 70 und 140 | TH-SCP 5.1.1 (Frieden, FrankB, Raincat) [Erfahrung] |
| Nahrung Viehkombi | Zwei Viehfarmen mit einer Metzgerei ernähren rund 210 Einwohner (FrankB). Khang nennt rund 250 für eine Metzgerei allein [Erfahrung]. Die Werte stammen aus verschiedenen Setups. | 210 bzw. 250 | TH-SCP; TH-SIP 5.2.5 [Erfahrung] |
| Nahrungskosten | Viehkombi: 6,5 $ je t Nahrung bei 2,3 t je Zyklus. Getreidekombi: 11,7 $ je t bei 3 t je Zyklus. Viehkombi ist günstiger, Getreidekombi braucht mehr Platz (76 gegen 56 Felder). Bei 100 Feldern liefern beide 4 t, Kosten 625 gegen 986 [Erfahrung] (Charlie, Bjoern). | 6,5 / 11,7 $ je t | TH-SIP 5.2.5 |
| Getreidekombi | Vier Getreidefarmen liefern Getreide für zwei Windmühlen. Diese versorgen eine Bäckerei. Faustregel: zwei Erzeuger je Verarbeiter. | 4-2-1 | TH-SIP 5.2.3 |
| Viehkombi | Zwei Viehfarmen für eine Metzgerei. | 2-1 | TH-SIP 5.2.3, 5.2.5 |
| Fischen | Fischerhütten sind platzsparend und unabhängig von Dürre. Sie brauchen Uferplatz. | nicht gezählt | TH-SIP 5.2.5 (Neferankh, FrankB) [Erfahrung] |
| Alkohol | Zuckerrohr-Kombi (zwei Plantagen plus Brennerei): 334 Einwohner, 21 Felder je Plantage, 7,26 Einwohner je Feld. Winzerei: 167 Einwohner aus 24 bis 25 Feldern, 6,68 Einwohner je Feld. Unterhalt 85 Münzen gegen 35 Münzen. Rum kostet 28,3 $ je t, Wein 30,4 $ je t (Charlie). | 7,26 gegen 6,68 je Feld | TH-SIP 5.2.6 (Neferankh, Charlie) [Erfahrung] |
| Tuch | Auf 100 % Baumwolle Baumwollkombi (3,1 t je Zyklus, 22,6 $ je t). Auf 50 % Baumwolle Schaffarm (1,95 t je Zyklus, 10,3 $ je t). Die Schafkombi braucht mehr Platz. | 3,1 / 1,95 t; 22,6 / 10,3 $ | TH-SIP 5.2.7 (Charlie, Prince Eric) [Erfahrung] |
| Eisen-Verhältnis | Drei Erzminen versorgen zwei Schmelzen zu 100 %. Eine Mine mit einer Schmelze arbeitet zu etwa 80 %. Eine 100-%-Schmelze versorgt zwei Werkstätten. Empfehlung: 1 Mine, 1 Schmelze, 2 Werkzeugmacher. | 3 zu 2; 1 zu 1 (80 %); 1 zu 2 | TH-SIP 5.2.4 (DPT, Robitoby) [Erfahrung] |
| Steinbruch | Zwei Steinmetze reichen für einen Steinbruch. Drei rotieren, zwei sind immer aktiv (BigTiny). Vier sind möglich (tanner_85). | 2 bis 4 | TH-SIP 5.2.4 [Erfahrung] |
| Erz kaufen | Freie Händler verkaufen Erz für höchstens 45 Münzen je t (Budgie) [Erfahrung]. Werkzeuge kaufen für 70 bis 75 Münzen je t am Anfang. Kaufpreise um 105 sind zu hoch (Frieden). | 45; 70 bis 75 | TH-RS 3.3.1; TH-SCM 5.3.1 [Erfahrung] |

### 6.3 Städtebau und Gebäudeanordnung

| Thema | Faustregel | Quelle |
|---|---|---|
| Häuserblöcke | Häuser in 2 x 2 oder 4 x 2 Blöcken anordnen, damit Feuerwehrwagen jedes Haus erreichen (Helen, Robitoby). Der Block 3 x 3 der KI lässt den mittleren Platz unerreichbar. Zomby Woof nutzt 3 x 2 Blöcke mit Straßen dazwischen. | TH-SCP 5.1.2 [Erfahrung] |
| Stadtzentrum | Mitte frei lassen (z. B. 8 x 11 Quadrat, Immelman) und Häuser ringsum bauen. | TH-SCP 5.1.2 [Erfahrung] |
| Ultimate City | Öffentliche Gebäude für die oberen Stufen eng beieinander: Taverne, Arzt, Galgen, Hochschule, Theater, Kirche, Badehaus, Feuerwache, Marktplatz. Feuerwache und Marktplatz liegen am Rand. Taverne hat den kleinsten Radius unter den Stadtgebäuden. | TH-SCP 5.1.3 |
| Ultimate City, Plan | Die Pläne zeigen eine Kirche mit 3 x 4, eine Hochschule mit 3 x 3, ein Theater mit 3 x 3. Der zweite Plan kommt mit nur einer Taverne aus. | TH-SCP 5.1.3 |
| Industriestandort | Verarbeiter innerhalb eines Feldes vom Erzeuger platzieren, damit keine Straße nötig ist (Prinzip 3). | TH-SIP 5.2.3 |
| Marktplätze | So wenige wie möglich, aber nahe am Produktionsstandort. Ziel: Transport beschleunigen. | TH-SIP 5.2.2 (Robitoby, Slacky) [Erfahrung] |
| Standort Lagerhaus | Lagerhaus so platzieren, dass viele Schiffe gleichzeitig anlegen können (gerade Küste, Halbinsel). | TH-SCP 5.1.1 (Shark_Dus) [Erfahrung] |
| Gebäude ohne Ertrag | Ein Fragezeichen über einem Gebäude zeigt fehlende Rohstoffe, fehlende Wachstumsphase, ungünstigen Standort, erschöpfte Mine oder fehlende Pflanzung. | TH-CD 3.5.1 (Manfred) [Erfahrung] |
| Häuser auf Produktionsinseln | Nicht nötig. Die Produktionseffizienz hängt nicht von der Bevölkerung ab. Arbeiter zählen trotzdem zur Gesamtbevölkerung. | TH-CD 3.5.3 (Zomby Woof, Folgra, Shark_Dus) [Erfahrung] |
| Gebiet sichern | Nach der Besiedlung sofort ein Lager auf der zweiten Insel bauen, um die KI fernzuhalten (Lord Khang) [Erfahrung]. | TH-SCP 5.1.1 |

### 6.4 Gebäude-Beispiele mit Anzahl

| Thema | Faustregel | Quelle |
|---|---|---|
| Holzfäller | Drei Holzfäller in der Anfangsphase. | TH-SCP 5.1.1 (FrankB) [Erfahrung] |
| Schaffarm | Eine Schaffarm reicht anfangs. Ein Weber verarbeitet die Wolle zweier Schaffarmen. Weber kann bei Überschuss pausieren. | TH-SCP 5.1.1 (Robbie47) [Erfahrung] |
| Weinberg | Am Anfang nur eine Winzerei bauen (Robbie47). Die Brennerei-Kombi nutzt bei Platzmangel den Raum besser (Neferankh). | TH-SCP 5.1.1; TH-SIP 5.2.6 [Erfahrung] |
| Marktwagen | 30 t Werkzeuge im Marktwagen als Puffer. Bei Krise als Vorrat nutzen. | TH-SCM 5.3.2 (Budgie, draculitch) [Erfahrung] |
| Feuerwache | Nur sinnvoll, solange Pioniere und Siedler vorhanden sind (FrankB). Brennende Pionierhäuser abreißen ist billiger (Domdom). | TH-SCM 5.3.3 [Erfahrung] |
| Hausaufwertung | Bürgerhaus braucht 3 t Werkzeuge, Kaufmannshaus 6 t, Aristokratenhaus 9 t (FrankB). | TH-SCM 5.3.3 [Erfahrung] |
| Gallows | Umstritten (siehe Abschnitt 7). | TH-CB 3.4.3 |

---

## 7. Widersprüche zwischen den Quellen

| Thema | Quelle A | Quelle B | Einschätzung |
|---|---|---|---|
| Erscheinungstermin deutsche Version | TH-IN: 1997 | WK und AI: 31.03.1998 | Nicht auflösbar. WK und AI geben ein konkretes Datum. |
| Festplattenbedarf | TH-IN: 85 MB | AI: 160 MB | Nicht auflösbar. |
| Verkaufszahlen | TH-IN: über 1,7 Mio. weltweit | WK: über 2 Mio. bis Januar 2002 (1,7 Mio. Deutschland, 0,8 Mio. weltweit dazu). AI: über 2,7 Mio. weltweit bis 2004 | Zahlen weichen ab. Nicht Teil der Wirtschaftsmechanik. |
| Inhalt der Königsedition | TH-IN (Sir Henry): Grundspiel, NINA, Patches, ohne Im Namen des Königs | AI: Königsedition mit Im Namen des Königs als Titel. WK: Königsedition wiederveröffentlicht, Inhalt nicht genannt | TH-IN ist plausibler, da Sir Henry den Dateiunterschied beschreibt. |
| Erscheinungstermin Königsedition | TH-IN: 1999 | AI: 30.11.1998 | Widerspruch. |
| Erscheinungstermin Im Namen des Königs | TH-IN (Shark_Dus): 9 Monate nach NINA | WK und AI: 30.11.1998 (NINA: 12.11.1998) | Widerspruch: 9 Monate gegen 18 Tage. |
| NINA-Umfang | TH-IN (Shark_Dus): 20 Szenarien in 6 Kampagnen, 7 Einzelspieler, 30 Mehrspieler | AI: über 40 neue Szenarien und 200 Inseln. WK: Königsedition über 100 Missionen | Zahlen unterscheiden sich, weil unterschiedliche Bezugspunkte. |
| Steuersatz Bürger und Kaufleute | TH-SCM (Charlie, Robitoby): Bürger 38 %, Kaufleute 36 % voll versorgt | wargamerit: höchste Stufe für Bürger und Kaufleute 32 bis 36 % | Die Zahlen von Charlie und Robitoby stimmen überein. wargamerit ist Erfahrung. |
| Ernährung je Viehkombi | FrankB: rund 210 Einwohner | Khang: Metzgerei ernährt die ersten 250 | Verschiedene Setups. |
| Straßenbedarf Getreidefarm | TH-ES: die meisten Grundfarmen laufen ohne Straße | DPT: Getreidefarmen brauchen Straßen | Uneinheitlich. Bei Getreide ist die Straße laut DPT nötig. |
| Wirkung des Galgens | Eric Lorah: hält Räuber fern | FrankB und Carl: keine Wirkung, Räuber erscheint auch mit Galgen | Umstritten. |
| Gold und Ureinwohner | Guardian: nur spätere Versionen | robbie47: Gold verschwindet bei Zerstörung der Ureinwohner | Versionsabhängig, nicht geklärt. |
| Lagerhaus-Ausbau | TH-CB 3.4.9: normal ein Lager pro Insel | Robitoby: Lager II bis IV über einem bestehenden Lager | Kein Widerspruch: Lager II bis IV sind Ausbaustufen, keine zusätzlichen Lager. |
| Getreide oder Vieh | Robitoby: Getreidekombi ist effektiver | FrankB und Bjoern: Viehkombi ist günstiger | Bewertung, nicht Fakt. Die Zahlen von Bjoern sind konsistent. |
| Gebäudenamen | DPT: "Ore smelter", "Tool maker", "Armorer" | Charlie: "Ore refinery", "Tool smithy" | Namensvarianten für dieselben Gebäude. |
| Stufe für tiefe Eisenmine | DPT: kleine Mine ab 120 Siedlern | Zomby Woof: tiefe Mine braucht 450 Bürger. Stefanus: tiefe Mine ab Bürger-Stufe | Nicht eindeutig, ob 450 Bürger eine Bedingung oder nur der Bedarf sind. |

---

## 8. Lücken (aus den gewählten Quellen nicht belegbar)

- Baukosten der meisten Gebäude und Betriebskosten aller Gebäude: nur im Anhang "Building and Industry Data" (tim_appendices_building_industry_data.txt). Diese Datei ist nicht in der Dateiliste.
- Vollständige Warenlisten je Stufe und Verbrauchsraten: Anhang "Population per Industry" (tim_appendices_population_per_industry.txt).
- Lagerkapazität: in keiner Quelle genannt.
- Einflussradien als Zahlen: in keiner Quelle genannt.
- Freischaltungsschwellen für die meisten Gebäude: nur teilweise belegt. Anhang "Building and Industry Data" fehlt.
- Produktionseffizienz und Handelspreise im Detail: Anhänge "Production Efficiency" und "AI Trade Prices" (nicht in der Dateiliste).
- Endwertung (Final Score): Anhang (nicht in der Dateiliste).
- Militär, Schiffe, Piraten, Ureinwohner, Handel und Diplomatie: eigene Kapitel (nicht in der Dateiliste).
- Gebäudegrößen: nur aus ASCII-Plänen abgeleitet. Vor dem Einsatz in der Praxis prüfen.
- Straßenraster 6 x 6: in den Quellen nicht gefunden. Belegt sind 2 x 2, 3 x 2, 4 x 2 Blöcke und ein 8 x 11 freies Zentrum.
- Der Begriff "Kontor" ist in keiner Quelle vorhanden. Im Text steht "Warehouse" (Lagerhaus).
- Deutsche Gebäudenamen: die meisten sind [DE-Übers.] und in keiner Quelle belegt.
- Produktionsraten einzelner Rohstoffe (Holz, Ziegel, Werkzeuge je Zyklus): nicht genannt.
