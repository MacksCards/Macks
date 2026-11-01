# Grafik – wie das Spiel schön wird

Ziel (Regel 2 + 6 in CLAUDE.md): realistischer, detailreicher Look wie die modernen Anno-Teile, schöner als das Original von 1602.

## Arbeitsteilung
| Was | Wer / womit |
|---|---|
| Gebäude, Menschen, Soldaten, Tiere, Schiffe, Bäume | **Meshy** (KI-Dienst, Stil „realistic“, echte Oberflächen) – Aufträge: `assets/meshy-batch.json` (je Modell Name, Gebäude, Stufe, Grundfläche und Beschreibung) |
| Insel, Berge, Strand, Gras, Wasser, Wellen, Himmel, Licht, Schatten, Wind, Rauch | Claude per Programm (`src/render/terrain.ts`, `vegetation.ts`, `scene.ts`) |
| Platzhalter, solange ein Meshy-Modell fehlt | einfache Modelle aus Code (`src/render/models/`) |

## Meshy einrichten (einmalig, macht der Nutzer)
1. Konto auf meshy.ai, Plan mit **kommerzieller Nutzung** und **API-Zugang** (Preis auf meshy.ai/pricing prüfen).
2. API-Schlüssel erzeugen – **nie in den Chat kopieren**.
3. Cloud-Umgebung → Edit:
   - Schlüssel als `MESHY_API_KEY` eintragen (Network secrets / Umgebungsvariable).
   - Network access → Allowed domains: `api.meshy.ai`, `assets.meshy.ai` (ggf. weitere Download-Domain, die das Skript meldet).
4. Neue Sitzung starten.

## Modelle erzeugen (macht Claude)
Heute läuft es über das Meshy-Kommandozeilenwerkzeug (`meshy-cli`), je Modell ein Aufruf:
```
scripts/meshy-modell.sh <id> "<Beschreibung>" <Dreiecke>   # Form → Oberflächen → Download → verkleinern
scripts/meshy-remesh.sh <id> <ziel-id> <Dreiecke>          # sauberer Neuaufbau mit weniger Dreiecken
node scripts/modell-texturen.mjs                           # Oberflächenbilder fürs iPhone verkleinern (s. u.)
```
Die Aufträge (Beschreibungen) stehen in `assets/meshy-batch.json`, die fertigen Dateien in `public/models/<id>.glb`, die Zuordnung zum Spiel in `public/models/manifest.json` (Gebäude, Stufe, Grundfläche; bei Bedarf `yaw` = Drehung in Grad, z. B. Werft mit der Helling zum Wasser; bei der Mühle `nabe`/`fluegel` = Mitte und Länge der drehenden Flügel; `fahne` = Spitze eines Fahnenmasts im Modell, dort hängt die Fahne in Besitzerfarbe; `rauch` = Liste der Schornstein-Öffnungen im Modell, dort steigt Rauch auf (gefunden mit einer Höhenkarte des Modells – schmale, hohe Spitzen – und für jedes Modell an Bildern mit markierten Punkten geprüft; heute bei Wohnhaus 0–4, Wirtshaus, Bäckerei, Brauerei, Tabakwaren, Erzschmelze, Kanonengießerei; ein neues Modell einer rauchenden Gebäudeart braucht diesen Eintrag, das prüft `scripts/stadtleben-test.ts`); `hoehe` = Höchsthöhe in Feldern, falls die Regel unten nicht passt). Rohdateien in `assets/raw/` kommen nicht ins Git (zu groß). Das ältere `scripts/meshy.mjs` mit `assets/modelle.json` ist nicht mehr der Weg.

**Jedes Modell vor dem Einbau ansehen.** Meshy liefert manchmal nur Bruchstücke (17 Modelle wurden deshalb wieder entfernt, zuletzt Erzmine – auch für Tiefe Erzmine und Goldmine –, Hochschule und Rumbrennerei; die Hochschule ist seit 01.11.2026 neu erzeugt wieder drin). Das Spiel prüft zusätzlich die Maße: Ist ein Gebäude-Modell viel flacher (Höhe < 0,3 × Breite) oder dünner (Tiefe < 0,35 × Breite) als ein Haus sein kann, nimmt es das Code-Modell und schreibt eine Warnung in die Konsole.

**Größe:** Ein Modell wird gleichmäßig so skaliert, dass es auf seine Grundfläche passt – aber höchstens 1,5 Felder hoch bei 1 × 1, 2,8 bei 2 × 2 und 3,6 bei 3 × 3 (nie gestaucht; ein schlanker Turm steht dann etwas schmaler auf seinem Feld). Heute betrifft das nur den Holzturm (vorher 2,8 Felder hoch, höher als das Kontor).

**Nachbessern mit `scripts/modell-schnitt.mjs`:** schneidet lose Einzelteile neben dem Hauptkörper heraus (Schule: Brett davor, Weingut: Rebstock davor) und entfernt fest eingebaute Fahnen (Kontor: rotes Tuch, der Mast bleibt und trägt jetzt die Fahne in Besitzerfarbe; Festung: alle rot-blauen Fahnen auf den Türmen). Fest eingebautes Rot oder Blau ist verboten, weil das Spielerfarben sind. Die genauen Aufrufe stehen oben im Skript.

**Mühle:** Die Meshy-Mühle hatte feste Flügel. `scripts/muehle-fluegel.mjs` hat sie aus der Datei geschnitten; das Spiel setzt an der Nabe drehende Flügel aus Code (Rute, Gitter, Segeltuch) ein.

**Besitzerfarbe:** Meshy-Modelle bekommen im Spiel eine Fahne aus Code an ihrer höchsten Stelle – groß bei Kontor, Marktplatz, Werften, Burgen, Festung, Türmen und Triumphbogen, als kleiner Wimpel bei allen anderen Gebäuden. So sind eigene und fremde Gebäude immer unterscheidbar. Alle Fahnen, Wimpel und Masten werden gemeinsam gezeichnet (`src/render/marks.ts`: je Art eine Vorlage mit vielen Kopien, die Farbe steht je Kopie) – in einer Test-Stadt mit 45 Gebäuden sank die Zahl der Zeichenaufrufe dadurch von 198 auf 113 (Übersicht) bzw. 129 auf 89 (nah).

## So lädt das Spiel die Modelle (`src/render/glb.ts`)
- Beim Start wird nur die Liste `manifest.json` gelesen. Ein Modell wird erst geladen, wenn ein Gebäude oder Schiff dieser Art zum ersten Mal gezeigt wird; bis dahin steht das Code-Modell da. Danach werden nur Gebäude neu aufgebaut, deren gezeigtes Modell sich wirklich ändert. Beim Aufstieg eines Hauses bleibt das bisherige Modell stehen, bis das der neuen Stufe geladen ist (kein Zurückspringen auf das Code-Modell).
- Bei „Neues Spiel“ werden Modelle, die das neue Spiel nicht braucht, aus dem Grafikspeicher genommen und bei Bedarf neu geladen (Schiffe bleiben). Test: nach einer Stadt mit allen Modellen 8 statt 92 Bilder im Grafikspeicher.
- Jede Datei wird nur einmal geladen, auch wenn mehrere Gebäude sie nutzen (z. B. Werft und Große Werft). Alle Kopien teilen sich Form und Oberflächenbilder im Grafikspeicher.

## Budget fürs iPhone (ehrliche Zahlen, Stand 01.11.2026)
- **Dreiecke:** Wohnhäuser ≈ 6 000–7 000 (davon stehen viele), Einzelgebäude bis ≈ 30 000 (Kontor 29 000, Triumphbogen 29 000, die meisten 9 000–24 000), Schiffe ≈ 16 000. Figuren ≤ 6 000, Tiere ≤ 4 000 (noch aus Code).
- **Oberflächenbilder (WebP):** je Modell drei Bilder – Farbe, Normalen (feine Unebenheiten) und Metall/Rauheit (Glanz).
  - Normalen und Metall/Rauheit: immer 512 × 512.
  - Farbbild: 1024 × 1024 bei Häusern, Schiffen und Dateien, die ein Gebäude mit Grundfläche 3 nutzt (z. B. Burg = auch Große Burg); 512 × 512 bei kleinen Gebäuden (Grundfläche 1–2).
  - Grafikspeicher je Modell damit 4 MB (klein) oder 8 MB (groß) statt 16 MB; damals alle 36 Dateien zusammen ≈ 227 MB statt ≈ 575 MB (heute 34 Dateien) (vorher wurden 4 Dateien sogar doppelt geladen: ≈ 640 MB). Weil nur Gebrauchtes geladen wird, ist es im Spiel meist deutlich weniger.
  - Größe aller Modelldateien ≈ 18 MB (vorher 22 MB); das Spiel selbst ≈ 1,2 MB.
- Wenige hundert Zeichenaufrufe pro Bild. Viele gleiche Dinge (Bäume, Gras, Tiere) als „Instanzen“ zeichnen (ein Aufruf für alle).

## Nächste Grafik-Schritte
- Die 16 noch fehlenden Modelle neu erzeugen (Liste in `docs/OFFEN.md`), wenn wieder Meshy-Guthaben da ist.
- Figuren mit Animationen (Träger auf Wegen, Arbeiter, Soldaten), Tiere auf Weiden.
- Test auf dem iPhone des Nutzers (Grafikspeicher, Bildrate, Akku).
