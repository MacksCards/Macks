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
- D8 Militärbauten: Palisade, Holztor, Steinmauer, Stadttor, Holz- und Steinturm (schießen, je 2 Kanonen), Burg, Große Burg, Festung (bilden Soldaten aus), Triumphbogen nach einem Sieg.
- D9 Freier Händler am Kontor (Kaufen/Verkaufen).

## Kampf (Regel 1, Kernbestandteil)
- K1 Soldaten wie im Vorbild: Schwertkämpfer, Reiter (je 3 Schwerter), Musketier (4 Musketen), Kanonier (2 Kanonen) mit den Originalwerten (Treffer, Stärke, Tempo der Schläge, Reichweite) und Unterhalt; Ausbildung in Burg/Großer Burg/Festung (3/5/8 gleichzeitig); höchstens 99.
- K2 Führen per Tippen: Soldat antippen, mehrere in der Nähe dazunehmen, hinlaufen, angreifen, aufs Schiff steigen; Soldaten wehren sich selbst und greifen Feinde in der Nähe an; Musketiere und Kanoniere schießen nicht durch Wald.
- K3 Mauern und Tore halten Feinde auf (eigene Leute gehen durch Tore); Wachtürme schießen auf Soldaten und Schiffe (Reichweite 8).
- K4 Schiffe: Kanonen am Kontor laden (bis 6/8/10/14 je Schiffstyp), Seeschlachten, Versenken, Ausbessern an der Werft, Soldaten übersetzen und an Land setzen.
- K5 Eroberung: Fällt Kontor oder Marktplatz, während eigene Soldaten danebenstehen, wechseln es und alle Gebäude im Gebiet den Besitzer; sonst wird es zerstört. Gegner ohne Gebäude und Schiffe ist besiegt → Triumphbogen.
- K6 Krieg & Frieden mit jedem Konkurrenten (Krieg erklären, Frieden gegen Entschädigung); Angriff im Frieden nur nach Rückfrage. Die KI wirbt Soldaten an, erklärt Krieg, wenn sie deutlich stärker ist, schickt Kriegsschiffe und landet Truppen.
- K7 Piraten: tauchen nach ca. 15 Minuten auf, jagen Schiffe, beschießen ungeschützte Küsten; Schutz kaufen möglich; drei versenkte Piratenschiffe → Triumphbogen.
- K8 Sichtbar und hörbar: Lebensbalken, Mündungsfeuer, Kanonenkugeln, Rauch, brennende Gebäude, sinkende Schiffe; Klänge für Schwerter, Musketen, Kanonen, Sturmglocke.

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

## Später (fest eingeplant, siehe docs/OFFEN.md)
- Händlerschiff, Ureinwohner, Handelsrouten, Steuersatz.
- Feuer, Pest, Feuerwehr, Arzt, Galgen; Prestigebauten (Palast, Kathedrale, Denkmal, Triumphbogen).
