# Anforderungen – Neue Ufer, Etappe 1 (Insel-Aufbau)

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

## Wirtschaft
- D1 Waren werden in einem gemeinsamen Lager gesammelt (Kontor + Marktplätze, mit Kapazitätsgrenze).
- D2 Warenketten mit mehreren Stufen, mindestens:
  - Holzfäller → Holz (braucht Wald in der Nähe)
  - **Nahrung** aus mehreren Quellen: Fischerhütte (am Wasser), Jagdhütte (Wald), Schweinezucht, Rinderfarm → Rinder → Fleischerei, Getreidefarm → Getreide → Mühle → Mehl → Bäckerei
  - Schaffarm → Wolle → Weberei → Stoff
  - Steinbruch → Stein (am Berg); Erzmine → Erz (am Berg) + Holz → Werkzeugschmiede → Werkzeug
  - Getreide → Brauerei → Bier
- D3 Produktionsgebäude müssen per **Weg** mit Kontor oder Marktplatz verbunden sein, sonst arbeiten sie nicht.
- D4 Bauen nur im Einflussbereich von Kontor/Marktplatz.
- D5 Gebäude kosten Taler und Baumaterial und haben laufende Unterhaltskosten.
- D6 Bewohner zahlen Steuern, abhängig von Zufriedenheit.

## Bevölkerung
- E1 Drei Stufen: **Pioniere → Siedler → Bürger**.
- E2 Jede Stufe hat Bedürfnisse (Waren + öffentliche Gebäude in Reichweite).
  - Pioniere: Nahrung, Marktplatz
  - Siedler: Nahrung, Stoff, Marktplatz, Kapelle
  - Bürger: Nahrung, Stoff, Bier, Marktplatz, Kapelle, Wirtshaus
  - Bedürfnisse heißen allgemein „Nahrung“ (nicht „Fisch“), wie bei 1602.
- E3 Erfüllte Bedürfnisse → Bewohner wachsen, Haus steigt auf (mit Baumaterial). Unerfüllte → Bewohner ziehen weg.
- E4 Die Info zu einem Haus zeigt klar, was fehlt.

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
