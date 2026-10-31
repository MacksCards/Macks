# Offene Punkte gegenüber dem Vorbild (Stand 31.10.2026, nach Welle 1)

Was noch fehlt, damit „Neue Ufer“ den ganzen Umfang von 1602 hat (Regel 4/11). Grundlage: der 1:1-Abgleich (`docs/ABGLEICH-1602.md`, Einzelbefunde in `docs/recherche/abgleich-befunde.json`). Die Kürzel sind Arbeitspakete (Plan: `docs/recherche/abgleich-plan.json`): L = Spielregeln und Spielwelt, U = Oberfläche und Bedienung, KI = Computergegner, M = Kampf, S = neue Spielteile, G = Grafik, R = Leistung der Grafik, P = Spielstart und Spielstände, A = Klänge, F = Feinschliff, D = Unterlagen. Die prüfbaren Anforderungen stehen in `docs/ANFORDERUNGEN.md`.

## Erledigt seit dem Abgleich (Welle 1)
- **L1:** Lager-voll-Fehler (Ware ging verloren), Tore im Wegenetz (kleines Tor neu, Stadttor 4 Steine), Schiffskurs bei Tipp auf Land, beschädigte Schiffe langsamer, Heimatinsel mit sicherem Erz und Pflanze auf 100 %, Gold-Garantie, tiefe Erzmine endet, Kanonengießerei ab 400 Bürgern, Spielstand Version 4, Andockstellen für die nächsten Spielteile.
- **U1:** Oberfläche in Bausteine geteilt, Handy-Sofortfixes (Knöpfe unten erreichbar, Knöpfe mindestens 44 px, Zoom-Knöpfe und Kompass, Gesten, eingebettete Schriften, Hinweisleiste oben).
- **KI1:** Wirtschaft der Computergegner repariert (Wege, Nahrung, Kasse, Rechenzeit).
- **Davor:** Tiere und Arbeiter mit Beinen, Grasen, flüssige Schiffe und Fischerboote, Wege und Mauern per Tippen.

## Kampf (Regel 1 – Kernbestandteil)
- Umgesetzt: siehe ANFORDERUNGEN K1–K8.
- **M1:** Kampfregeln wie 1602 (Logik): weiße Flagge, Fehlschüsse mit ausgeglichenem Schaden, Kanonen setzen Gebäude in Brand (wirkt mit S3), Arzt heilt Soldaten, Soldaten ausmustern, Bäume fällen, Aufstellung in Reihe und Block, Patrouille, Piraten fliehen bei Schaden, bessere Wegsuche im Gefecht.
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
- **G1/G2:** Alle Gebäudearten sichtbar unterscheidbar (heute haben 27 von 52 nur ein einfaches Platzhalter-Modell), fünf Haustypen statt drei, Kontor I–IV sichtbar verschieden.
- **G3:** Rauch aus Schornsteinen (fertig programmiert, nicht angeschlossen), Fahnen in der Spielerfarbe, kurze Bau-Animation, bessere Warnsymbole.
- **G3b:** Bewohner in der Stadt, sichtbare Arbeiter an allen Betrieben, sichtbare Felder und Weiden.
- **G4a/G4b:** Landschaft (Berge schärfer, Nord- und Südinseln verschieden), Wasser, Licht, Schiffe (Segel bewegen sich), Wale und Delfine (nur in der Erweiterung des Originals), Ruinen.
- **G5a/G5b:** Realistische Modelle von Meshy für alle Gebäude, Figuren, Tiere, Schiffe, Bäume. Die Probe mit Wohnhaus, Kontor und Schaf liegt im Projekt (Wohnhaus etwa 15 600 und Kontor etwa 29 500 Dreiecke, das ist über dem Richtwert von 12 000 in `docs/GRAFIK.md`); Freigabe durch den Nutzer und der Schlüssel `MESHY_API_KEY` in den Umgebungs-Einstellungen stehen aus.
- **R1/R2:** Speicherleck der Schiffsroute, Anpassung ans Gerät (Qualität, Akku, Pause), nur Sichtbares zeichnen, nur Geändertes neu bauen. Danach ein Test auf dem iPhone des Nutzers (bisher nur am PC gemessen).

## Klänge
- **A1:** Klänge für Gebäude und Schiffe, Musikstücke; Ton und Musik abschaltbar (Regel 12).

## Antworten des Nutzers
- Die sechs Fragen aus dem Abgleich sind beantwortet (31.10.2026, siehe `CLAUDE.md` und `docs/ABGLEICH-1602.md`, Abschnitt 6). Offen sind: Freigabe der Meshy-Probe, der Schlüssel `MESHY_API_KEY` und der erste Test auf dem iPhone.
