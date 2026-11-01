# Offene Punkte gegenüber dem Vorbild (Stand 01.11.2026, nach Welle 1 und den Meshy-Modellen)

Was noch fehlt, damit „Neue Ufer“ den ganzen Umfang von 1602 hat (Regel 4/11). Grundlage: der 1:1-Abgleich (`docs/ABGLEICH-1602.md`, Einzelbefunde in `docs/recherche/abgleich-befunde.json`). Die Kürzel sind Arbeitspakete (Plan: `docs/recherche/abgleich-plan.json`): L = Spielregeln und Spielwelt, U = Oberfläche und Bedienung, KI = Computergegner, M = Kampf, S = neue Spielteile, G = Grafik, R = Leistung der Grafik, P = Spielstart und Spielstände, A = Klänge, F = Feinschliff, D = Unterlagen. Die prüfbaren Anforderungen stehen in `docs/ANFORDERUNGEN.md`.

## Erledigt seit dem Abgleich (Welle 1)
- **L1:** Lager-voll-Fehler (Ware ging verloren), Tore im Wegenetz (kleines Tor neu, Stadttor 4 Steine), Schiffskurs bei Tipp auf Land, beschädigte Schiffe langsamer, Heimatinsel mit sicherem Erz und Pflanze auf 100 %, Gold-Garantie, tiefe Erzmine endet, Kanonengießerei ab 400 Bürgern, Spielstand Version 4, Andockstellen für die nächsten Spielteile.
- **U1:** Oberfläche in Bausteine geteilt, Handy-Sofortfixes (Knöpfe unten erreichbar, Knöpfe mindestens 44 px, Zoom-Knöpfe und Kompass, Gesten, eingebettete Schriften, Hinweisleiste oben).
- **KI1:** Wirtschaft der Computergegner repariert (Wege, Nahrung, Kasse, Rechenzeit).
- **G1:** Fünf verschiedene Hausstufen, Rauchpunkte an den Schornsteinen, weicherer Look, keine Bodenplatten mehr.
- **R1/R2:** Speicherleck der Schiffsroute behoben, „Neues Spiel“ räumt auf, Qualität passt sich dem Gerät an, in Pause und Menü weniger Zeichnen, Pflanzen und Boden zeichnen nur Sichtbares und bauen nur Geändertes neu. (Der Test auf dem iPhone des Nutzers steht noch aus.)
- **G5a/G5b (Meshy):** Probe vom Nutzer am 31.10.2026 freigegeben, Entscheidung „Wichtigste ~50 jetzt“. 48 Modelle erzeugt, 14 davon waren nur Bruchstücke und wurden wieder entfernt, nach der Prüfung vom 01.11.2026 drei weitere (Erzmine – galt auch für Tiefe Erzmine und Goldmine –, Hochschule, Rumbrennerei). Die Hochschule wurde am 01.11.2026 neu erzeugt (vollständiges Dach, geprüft) und ist wieder im Spiel; im Spiel sind 30 Gebäudearten (alle fünf Hausstufen, öffentliche Gebäude, Betriebe, Plantagen, Werkstätten, Werften, Türme, Burgen, Festung, Triumphbogen) und 2 Schiffe (Handels- und Kriegsschiff, Piraten dunkel).
- **Nacharbeit an den Meshy-Modellen (01.11.2026):** Oberflächenbilder fürs iPhone verkleinert (Grafikspeicher aller Modelle ≈ 227 statt ≈ 640 MB), Modelle werden erst geladen, wenn sie gebraucht werden (jede Datei nur einmal), unvollständige Modelle werden automatisch erkannt, Fahne bzw. Wimpel in der Besitzerfarbe auf allen Meshy-Gebäuden (auch die Fahnen der Code-Modelle zeigen jetzt die richtige Farbe statt Schwarz), Mühle dreht wieder ihre Flügel, Werften zeigen zum Wasser.
- **Nacharbeit nach der Prüfung (01.11.2026):** drei kaputte Modelle entfernt (siehe G5c); Holzturm nicht mehr höher als das Kontor (Höchsthöhe je Grundfläche); fest eingebaute rote Fahnen an Kontor und Festung entfernt, nach der zweiten Prüfung auch das rote Wandbanner der Burg (gilt für die Große Burg), die Fahne auf dem Theater und die rot-weiß-blauen Wimpel des Kriegsschiffs (das Kontor trägt die Fahne in Besitzerfarbe jetzt an seinem eigenen Mast); lose Einzelteile neben Schule und Weingut entfernt; alle Fahnen und Wimpel gemeinsam gezeichnet (Zeichenaufrufe in der Test-Stadt 198 → 113); bei „Neues Spiel“ wird der Grafikspeicher nicht mehr gebrauchter Modelle freigegeben; weniger unnötige Neuaufbauten beim Laden und beim Aufstieg (Test: 84 → 42 bzw. 106 → 19); Marktplatz-Code-Modell realistisch (gepflasterter Platz, Steinbrunnen, Holzstände mit Leinenplanen in verblichenen Erdtönen, Obst, Fisch, Brot, Tuch, Fässer, Säcke, Handkarren), auch Weberei-Tücher gedeckt statt knallbunt.
- **Bedienung nach der Prüfung (01.11.2026):** Infofenster mit fester Fußleiste – Abreißen, Bewaffnen, Ausbilden, Schiff bestellen, Kontor ausbauen, Alles ausladen, Kontor gründen und Soldaten an Land setzen sind ohne Wischen erreichbar (852 × 393 und 667 × 375 gemessen); „Einladen“ am Schiff ist einklappbar (anfangs zu); die Bedürfnisse im Haus stehen zweispaltig, „Aufstieg zu …“ ist ohne Wischen zu sehen. Das Startschiff liegt 10 bis 13 Felder vor der Heimatküste, die Startkamera zeigt Schiff und Land zugleich. Weg-Werkzeug meldet „Schon mit dem Weg verbunden ✓“ statt „Kein Durchgang“. Zweispaltiges Baumenü behält die Beschriftung (12 px, „Werkstatt“ statt „Werkstätten“).
- **Davor:** Tiere und Arbeiter mit Beinen, Grasen, flüssige Schiffe und Fischerboote, Wege und Mauern per Tippen.

## Kampf (Regel 1 – Kernbestandteil)
- Umgesetzt: siehe ANFORDERUNGEN K1–K10.
- **M1 (Logik erledigt, 01.11.2026, ANFORDERUNGEN K10):** weiße Flagge (mit Knopf im Schiffsfenster, sobald Piraten gesichtet sind oder Krieg herrscht, und weißem Tuch am Mast), Händler und Ureinwohner nie Ziel von Piraten/KI (Ureinwohner nur auf Befehl, mit Rückfrage), Piraten fliehen unter 30 %, Bäume fällen, Aufstellung Reihe/Block, Ausmustern, Patrouille, Arzt (Heilung 1/s, kein Sold; sonst 0,03/s), Selbst-Ausbessern nur bis 75 %, Kanonen setzen Holzgebäude in Brand, Meldungen mit Ort, Fehlschüsse mit ausgeglichenem Schaden (Holzturm ≈ 6, Steinturm ≈ 8 Kanonierschüsse), Zufall über g.rng(), sparsame Wegsuche (Gebiete, Sperre nach vergeblicher Suche, kleinere Suche für selbst gewählte Ziele, Höchstzahl je Rechenschritt; großes Gefecht im Mittel ≈ 1 ms, Spitzen 4–12 statt 30–60 ms). Test: `scripts/kampf-test.ts`. **Noch offen dazu:** Bedienung für Bäume fällen, Reihe/Block, Ausmustern und Patrouille (Paket U4 – die Logik dafür steht: `orderFell`, `orderMove(…, 'reihe' | 'block')`, `dismiss`, `patrol`/`stopPatrol` in `src/combat.ts`); der Arzt ist erst baubar, wenn S3 ihn freigibt; Brand wirkt erst mit S3 (`events.ignite`); ein Angriff auf Ureinwohner macht das Dorf erst mit S4 feindlich; Gebäude über 75 % lassen sich noch nicht ausbessern.
- **M2:** Piratennest (zerstörbar), Piraten gegen andere bestechen oder mit Nahrung beruhigen, Handelsvertrag mit den Computergegnern, Tribut; Krieg aus Anlass und „Gegner ohne Land wird Pirat“ sind noch keinem Paket fest zugeordnet (KI2 oder M2 klären).
- **KI2:** Computergegner wachsen bis Kaufleute, besiedeln 2 bis 3 Inseln, bauen Burgen und Waffenketten, eigene Persönlichkeit, Handel und eigene Schiffe, Angriff mit Vorwarnung.
- **U4:** Kämpfen mit dem Finger (Rahmen und Gruppen, Reihe/Block, Ausmustern, Bäume fällen, mehrere Schiffe wählen, Patrouille).

## Handel & Welt
- **S2:** Freies Händlerschiff, das Kontore anläuft (Aufträge mit Ware, Menge, Preis; Plätze je Kontorstufe), Handelsrouten für Schiffe (automatisch laden und löschen), Handel mit Computergegnern.
- **U5:** Bedienung dazu (Kontor-Aufträge, Routen, Laden je Ware und Ausladen je Ware).
- **S4:** Ureinwohner-Dörfer mit Tauschhandel und Fluch.
- **S5:** Punkte und Endwertung, Rangliste (ein Sieg beendet heute das Spiel nicht).
- **F2:** Szenarien (Hauptspiel etwa 26).

## Wirtschaft (Entscheidungen des Nutzers, 31.10.2026)
- **L2:** Steuersatz einstellbar je Stufe (Höchstsätze 48/45/38/36/35 %), flache Steuerkurve (Aristokrat etwa 1,4 × Pionier), zu hohe Steuern führen zum Auszug; Bankrott; Betrieb abschalten (Unterhalt aktiv/ruhend); Baumaterial an Bewohner sperren; Hausstufen können absteigen; Kontor abreißen, wenn sonst nichts mehr auf der Insel steht; Angleichen der kleinen Zahlen an das Original (Kapelle, Jagdhütte, Fleischerei); Wirtschaftstempo so, dass ein Betrieb wieder 60 bis 100 % der Bewohner des Originals versorgt.
- **U2:** Fenster für Steuern, Bilanz, Statistik, Bevölkerung.
- **S1:** Statistik (Erzeugung und Verbrauch je Ware, Verlauf), Kassenbuch, Warnungen bei Mangel, Hunger, Auszug, Minus.
- **L4:** Felder legt der Bau automatisch an (sichtbar, 5 Taler je Feld, reifen erst, Feld-Werkzeug zum Nachbessern); Förster pflanzt Wald; Rohstoffe werden von Karren angeliefert statt zu „springen“; Warum Marktplätze heute kaum etwas bringen, ist ein Nebenpunkt von L2 (Abholradius der Marktkarren: Kontor 8, Marktplatz 12 statt des ganzen Gebiets).

## Stadt
- **S3:** Ereignisse wie 1602: Feuer (Feuerwehr), Pest (Arzt), Kriminalität (Galgen), Dürre, Schatz; Standard „mild“. Feuerwehr, Arzt und Galgen sind als Gebäude vorbereitet und bis dahin ausgeblendet.
- **L3:** Plätze I–III, Zierbaum, Denkmal, Palast, Kathedrale; Anlegesteg; Holz- und Steinbrücken über Flüsse (Flüsse gibt es erst mit L5).
- **L5:** Inselwelt wie 1602 (fünf Größenklassen, Formen, Flüsse, Steppe) – als Letztes, nach der Leistungsarbeit (R1, R2) und einem Test auf dem iPhone. Dazu die Prüfung der Grundflächen (Wohnhaus 1 Feld? längliche Gebäude mit Drehen-Knopf): Vorgabe in `docs/ABGLEICH-1602.md`, Abschnitt 2.1a.
- Webstube und Weberei getrennt (derzeit eine Weberei, bewusste Vereinfachung).

## Oberfläche und Übersicht
- **U3:** Meldungsverlauf mit Sprung zum Ort, dauernd sichtbare Übersichtskarte (mit Inselnamen, Erz, Gold), Liste „Meine Schiffe und Inseln“ mit Umbenennen, Warenleiste mit roten leeren Waren, Anzeige der Spielzeit und deutliche Pause, Pfeil zur nächsten unentdeckten Insel beim Start (Hinweis zur Richtung).
- **U4:** Rückgängig nach dem Bauen, Wohnblöcke zügig bauen, Bereich abreißen.
- **P1:** Spielstart mit Schwierigkeit (leicht/normal/schwer, Startgeld 20 000/15 000/10 000), mehrere Spielstände, Fehler beim Speichern sichtbar.
- **F1:** Bilder der Gebäude im Baumenü, Warensymbole, Symbol auf dem Home-Bildschirm.

## Grafik
- **G2:** Kontor I–IV sichtbar verschieden; die übrigen Gebäudearten ohne Meshy-Modell (siehe G5c) bis dahin als gut unterscheidbare Code-Modelle.
- **G3:** Rauch aus Schornsteinen (fertig programmiert, nicht angeschlossen), kurze Bau-Animation, bessere Warnsymbole. (Fahnen in der Spielerfarbe: erledigt.)
- **G3b:** Bewohner in der Stadt, sichtbare Arbeiter an allen Betrieben, sichtbare Felder und Weiden.
- **G4a/G4b:** Landschaft (Berge schärfer, Nord- und Südinseln verschieden), Wasser, Licht, Schiffe (Segel bewegen sich), Wale und Delfine (nur in der Erweiterung des Originals), Ruinen.
- **G5c – 16 Modelle neu erzeugen, wenn wieder Meshy-Guthaben da ist:** Marktplatz, Badehaus, Jagdhütte, Fleischerei, Schneiderei, Goldschmied, Kakaoplantage, Baumwollplantage, Gewürzplantage, Weberei, Werkzeugschmiede, Schwertschmiede, Büchsenmacher, Steinbruch, **Erzmine** (nur Bruchstücke; dient auch Tiefer Erzmine und Goldmine), **Rumbrennerei** (offener Kasten ohne Dach, schwebende Teile). Neuversuche am 01.11.2026 verworfen: Marktplatz (zweimal – Häusergruppe bzw. nur Brunnen; ein flacher Platz bräuchte eine Ausnahme bei der Höhenprüfung), Erzmine (Fels nur eine dünne Wand). Restguthaben danach: 30 Punkte. Keine fest eingebauten roten oder blauen Fahnen (Spielerfarben). Auftrag an Meshy jeweils: *ein vollständiges, geschlossenes Gebäude als ein Objekt* (keine einzelnen Teile, kein Boden, keine Umgebung). Jedes Modell vor dem Einbau ansehen; danach `node scripts/modell-texturen.mjs` (Bildgrößen fürs iPhone, siehe `docs/GRAFIK.md`). Bis dahin gelten die Code-Modelle.
- **G5d:** Figuren (Bewohner, Arbeiter, Soldaten), Tiere und Bäume von Meshy; große Handels- und Kriegsschiffe mit eigenem Modell (heute dasselbe Modell wie das kleine).
- **iPhone-Test:** Bildrate, Grafikspeicher und Akku auf dem iPhone des Nutzers messen (bisher nur am PC; Messanzeige mit `?debug` in der Adresse).

## Klänge
- **A1:** Klänge für Gebäude und Schiffe, Musikstücke; Ton und Musik abschaltbar (Regel 12).

## Antworten des Nutzers
- Die sechs Fragen aus dem Abgleich sind beantwortet (31.10.2026, siehe `CLAUDE.md` und `docs/ABGLEICH-1602.md`, Abschnitt 6). Die Meshy-Probe ist freigegeben (31.10.2026, „Wichtigste ~50 jetzt“). Offen ist der erste Test auf dem iPhone.
