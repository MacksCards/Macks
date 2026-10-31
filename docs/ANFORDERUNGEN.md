# Anforderungen – Neue Ufer (Kernspiel)

Quelle: Interview mit dem Nutzer am 30.10.2026.

## Rahmen
- A1 Spielbar im Safari-Browser auf dem iPhone, **Querformat**. Bei Hochformat erscheint ein Hinweis „Bitte drehen“.
- A2 Grafik: **hochwertiges, detailreiches 3D, schöner als das Original von 1602** (kein vereinfachter „Low-Poly“-Look). Modelle kommen von einem KI-Dienst (Meshy) plus eigener Programmierung für Insel, Wasser, Licht, Effekte. Details wie bei Anno: Fenster, Türen, Fachwerk, Dachstrukturen, Schornsteine mit Rauch, Zäune, Fässer, Kisten, Tiere, Pflanzen, sichtbares Leben.
- A3 Setting: **Segelzeitalter um 1600**: Insel, Siedlung, Kontor am Meer.
- A4 Keine Inhalte aus Anno 1602 (Code, Grafik, Namen, Texte). Das Wort „Anno“ kommt im Spiel nicht vor.
- A5 Oberfläche komplett auf Deutsch, verständlich für Laien.

## Bedienung
- B1 Ein Finger ziehen = Karte verschieben. Zwei Finger = zoomen (Pinch) und drehen.
- B2 Tippen auf ein Gebäude zeigt eine Info (Status, Produktion, Probleme).
- B3 Bauen: Gebäude im Baumenü wählen, auf die Insel tippen (Vorschau grün/rot), erneut tippen oder ✓ zum Bauen.
- B4 Wege lassen sich durch Ziehen mit dem Finger bauen.
- B5 Abreißen ist möglich, mit teilweiser Rückerstattung.
- B6 Bedienelemente groß genug für Finger (mind. ~40 px), Notch/Rundungen werden berücksichtigt.

## Zeit & Speichern
- C1 Echtzeit mit Pause und Tempo 1x / 2x / 4x.
- C2 Automatisches Speichern (regelmäßig und beim Verlassen). Beim Öffnen geht es exakt dort weiter.
- C3 „Neues Spiel“ erzeugt eine neue Insel.

## Wirtschaft (voller Umfang wie 1602, Details: docs/1602-INHALT.md)
- D1 Jede Insel hat ihr eigenes Lager (Kontor + Marktplätze, Kontor in 4 Stufen ausbaubar: 30/50/75/100 t).
- D2 Alle Warenketten:
  - Holz (Holzfäller, Bäume wachsen nach), Steine (Steinbruch am Berg – statt Ziegel, ohne Steinmetz)
  - Nahrung: Fischerhütte, Jagdhütte, Schweinezucht → Fleischerei (statt Rinderfarm), Getreidefarm → Mühle → Bäckerei
  - Stoffe: Schaffarm oder Baumwollplantage → Weberei; Kleidung: Schneiderei
  - Alkohol: Weingut, Zuckerrohr → Rumbrennerei, (Abwandlung) Getreide → Brauerei
  - Tabak → Tabakwaren, Gewürze, Kakao (Plantagen nur auf fruchtbaren Inseln, Ertrag × Fruchtbarkeit)
  - Erz (Mine, Vorkommen erschöpfbar) → Erzschmelze → Eisen → Werkzeug, Schwerter, Musketen, Kanonen
  - Gold (Goldmine, nur Gold-Inseln) → Goldschmied → Schmuck
- D3 Produktionsgebäude brauchen einen **Weg** zu Kontor/Marktplatz; Marktkarren holen die Ware ab. Pflasterwege (Steine) machen die Karren schneller.
- D4 Bauen nur im eigenen Gebiet (Kontor/Marktplatz).
- D5 Gebäude kosten Taler und Baumaterial (Holz, Werkzeug, Steine, beim Wachturm Kanonen) und haben Unterhalt.
- D6 Bewohner zahlen Steuern, abhängig von Zufriedenheit.
- D7 Werften bauen kleine/große Handels- und Kriegsschiffe (Laderaum, Tempo, Kanonen).
- D8 Militärbauten: Palisade, Steinmauer, Wachturm (mit Kanonen), Burg (Soldaten folgen mit dem Kampf-Update).
- D9 Freier Händler am Kontor (Kaufen/Verkaufen).

## Bevölkerung
- E1 Fünf Stufen: **Pioniere → Siedler → Bürger → Kaufleute → Aristokraten** (Bewohner je Haus 3/7/15/25/40).
- E2 Aufstieg wie im Vorbild:
  - Pioniere → Siedler: Stoffe im Lager, Kapelle
  - Siedler → Bürger: Alkohol und (Tabakwaren oder Gewürze), Wirtshaus, Schule
  - Bürger → Kaufleute: Kakao, Kirche, Badehaus
  - Kaufleute → Aristokraten: Schmuck und Kleidung, Hochschule, Theater
  - Jede Stufe verbraucht ihre Waren laufend; Bedürfnisse heißen „Nahrung“ usw. (nicht einzelne Lebensmittel).
- E3 Gebäude werden nach Einwohnerzahl freigeschaltet (Schwellen des Vorbilds).
- E4 Die Info zu einem Haus zeigt klar, was für den nächsten Aufstieg fehlt.

## Führung
- F1 Aufgaben-Liste führt Einsteiger Schritt für Schritt durch alle Warenketten (mit Belohnung).
- F2 Verständliche Meldungen, warum etwas nicht geht (z. B. „Kein Weg zum Lager“, „Zu wenig Holz“).

## Technik
- G1 Läuft flüssig auf aktuellen iPhones (Ziel 60 FPS bei normaler Siedlungsgröße).
- G2 Das Spiel ist eine Webseite plus Modell-Dateien (models/*.glb), leicht zu verteilen und vorzuschauen.
- G3 Fehler im Speicher (z. B. privater Modus) bringen das Spiel nicht zum Absturz.

## Später (nicht Etappe 1, aber fest eingeplant)
- Etappe 2: Schiffe, weitere Inseln mit anderen Rohstoffen (z. B. Tabak, Gewürze), Stufe Kaufleute.
- Etappe 3: **Kampf** – Piraten, Militär, Seeschlachten, Computergegner.
- Etappe 4: Handel – freie Händler, Handelsrouten.
