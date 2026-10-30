# Grafik – wie das Spiel schön wird

Ziel (Regel 2 + 6 in CLAUDE.md): realistischer, detailreicher Look wie die modernen Anno-Teile, schöner als das Original von 1602.

## Arbeitsteilung
| Was | Wer / womit |
|---|---|
| Gebäude, Menschen, Soldaten, Tiere, Schiffe, Bäume | **Meshy** (KI-Dienst, Stil „realistic“, echte Oberflächen) – Liste: `assets/modelle.json` |
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
```
node scripts/meshy.mjs --test          # zeigt, was erzeugt würde
node scripts/meshy.mjs --nur haus-1    # erst ein Testmodell, Qualität ansehen
node scripts/meshy.mjs                 # alle fehlenden
```
Das Skript: Form → realistische Oberflächen → Download → verkleinern für iPhone (Texturen 1024 px, komprimierte Geometrie) → `public/models/<id>.glb` + `manifest.json`. Das Spiel lädt sie automatisch (`src/render/glb.ts`) und passt sie in die Grundfläche ein.
Fortschritt: `assets/meshy-status.json` (Abbruch → einfach neu starten). Rohdateien `assets/raw/` nicht ins Git (zu groß).

## Budget fürs iPhone (Richtwerte)
- Gebäude ≤ 12 000 Dreiecke, Figuren ≤ 6 000, Tiere ≤ 4 000, Schiffe ≤ 15 000.
- Texturen max. 1024 px, WebP. Wenige hundert Zeichenaufrufe pro Bild.
- Viele gleiche Dinge (Bäume, Gras, Tiere) als „Instanzen“ zeichnen.

## Nächste Grafik-Schritte
- Erstes Testmodell erzeugen und mit dem Nutzer abstimmen (Stil, Farben).
- Figuren mit Animationen (Träger auf Wegen, Arbeiter, Soldaten), Tiere auf Weiden.
- Rauch aus Schornsteinen, Möwen, Wolkenschatten, Tag-Abend-Licht.
