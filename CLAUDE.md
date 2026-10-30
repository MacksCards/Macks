# Neue Ufer – Projektregeln für Claude

Arbeitstitel: **Neue Ufer** – ein Aufbau-Strategiespiel, inhaltlich so nah wie möglich am Klassiker von 1602, in schöner, moderner 3D-Grafik, für iPhone (quer).

## Dauerhafte Regeln (aus Korrekturen des Nutzers)
1. **Kampf ist ein Kernbestandteil**, genauso wichtig wie Aufbau, Warenketten und Entdecken. Niemals streichen oder als „optional“ abwerten. Handel ist weniger wichtig, gehört aber dazu. *(Korrektur vom 30.10.2026)*
2. **Alles muss detailreich und grafisch anspruchsvoll sein, schöner als das Original von 1602.** Gilt für alles: Gebäude, Menschen, Tiere, Wasser, Wellen, Wind, Berge, Bäume. Keine simplen Klötzchen und **kein „Low Poly“** (der Nutzer will keine vereinfachte Darstellung). Fenster, Türen, Fachwerk, Dachziegel, Schornsteine mit Rauch, Zäune, Fässer, Tiere, Bewegung. *(Korrekturen vom 30.10.2026)*
3. **Bedürfnisse wie in Anno 1602 zusammenfassen:** Bewohner wollen „Nahrung“, nicht einzelne Lebensmittel. Nahrung kommt aus mehreren Quellen (einfach: Fischerhütte, Jagdhütte; besser: Schweinezucht → Schweine → Fleischerei, Getreide → Mühle → Bäckerei). **Keine Rinderfarm** – die Schweinezucht ersetzt sie *(Korrektur vom 30.10.2026)*. Abwandlungen sind erlaubt, aber das Spiel soll sich sehr nah an 1602 orientieren. *(Korrektur vom 30.10.2026)*
4. **Inhaltlich so nah wie möglich an 1602.** Der Nutzer will „theoretisch 1602 spielen können, nur in neuem Kleid“: fünf Stufen (Pioniere, Siedler, Bürger, Kaufleute, Aristokraten), Rohstoffvorkommen (Stein und Erz am Berg, seltenes Gold), Inseln mit unterschiedlichen Pflanzen, Militär mit Soldaten und Gefechten, Schiffe, Handel. Abwandlungen nur, wo sie rechtlich nötig oder klar besser sind – nicht alles anders machen. *(Korrektur vom 30.10.2026)*
5. **Keine Fachwörter ohne Erklärung.** Der Nutzer ist kein Entwickler. Begriffe wie „Low Poly“, „Shader“, „Mesh“ vermeiden oder in einfachen Worten erklären. *(Korrektur vom 30.10.2026)*
6. **Realistischer Grafikstil wie die modernen Anno-Teile**, nicht comichaft oder niedlich: echte Materialien (Holz, Stein, Ziegel), realistisches Licht und Wasser, natürliche Landschaft mit echten Bergen. Modelle von Meshy im Stil „realistic“ mit echten Oberflächen. *(Korrektur vom 30.10.2026)*

## Feste Projektentscheidungen
- Ziel: zuerst ein Spiel für den Nutzer selbst, Launch später möglich.
- Rechtlich sauber: **kein** Code, keine Grafiken, Sounds, Texte oder Namen aus Anno 1602 oder Reverse-Engineering-Projekten. Nur allgemeine Spielmechaniken (nicht geschützt) als Inspiration. Das Wort „Anno“ kommt im Spiel nicht vor.
- Grafik: realistisches, detailreiches 3D. Modelle (Gebäude, Menschen, Tiere, Schiffe) erzeugt der KI-Dienst **Meshy** (Nutzer zahlt den Plan); Landschaft, Wasser, Licht und Effekte programmiert Claude. Details: docs/GRAFIK.md.
- Bedienung: iPhone im Querformat, Touch zuerst (Maus nur fürs Testen).
- Zeit: Echtzeit mit Pause und Tempo 1x/2x/4x, Spiel friert ein, wenn die App zu ist. Automatisches Speichern.
- Etappen: 1) Insel-Aufbau + Warenketten → 2) Schiffe + neue Inseln → 3) Kampf (Piraten, dann KI-Gegner) → 4) Handel.
- Sprache im Spiel und in der Kommunikation: Deutsch, einfach und ohne Fachchinesisch.

## Arbeitsweise
- Vor jeder Lieferung prüft ein separater Agent ohne Vorwissen das Ergebnis gegen `docs/ANFORDERUNGEN.md` und diese Regeln.
- Neue Korrekturen des Nutzers hier als dauerhafte Regel ergänzen.

## Technik
- Vite + TypeScript + three.js. `npm run dev` zum Entwickeln, `npm run build` erzeugt eine einzelne Datei `dist/index.html`.
- `npm run check` = Typprüfung. `node scripts/smoke.mjs` = Browser-Test (Playwright).
