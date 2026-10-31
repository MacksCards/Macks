# Neue Ufer – Projektregeln für Claude

Arbeitstitel: **Neue Ufer** – ein Aufbau-Strategiespiel, inhaltlich so nah wie möglich am Klassiker von 1602, in schöner, moderner 3D-Grafik, für iPhone (quer).

## Dauerhafte Regeln (aus Korrekturen des Nutzers)
1. **Kampf ist ein Kernbestandteil**, genauso wichtig wie Aufbau, Warenketten und Entdecken. Niemals streichen oder als „optional“ abwerten. Handel ist weniger wichtig, gehört aber dazu. *(Korrektur vom 30.10.2026)*
2. **Alles muss detailreich und grafisch anspruchsvoll sein, schöner als das Original von 1602.** Gilt für alles: Gebäude, Menschen, Tiere, Wasser, Wellen, Wind, Berge, Bäume. Keine simplen Klötzchen und **kein „Low Poly“** (der Nutzer will keine vereinfachte Darstellung). Fenster, Türen, Fachwerk, Dachziegel, Schornsteine mit Rauch, Zäune, Fässer, Tiere, Bewegung. *(Korrekturen vom 30.10.2026)*
3. **Bedürfnisse wie in Anno 1602 zusammenfassen:** Bewohner wollen „Nahrung“, nicht einzelne Lebensmittel. Nahrung kommt aus mehreren Quellen (einfach: Fischerhütte, Jagdhütte; besser: Schweinezucht → Schweine → Fleischerei, Getreide → Mühle → Bäckerei). **Keine Rinderfarm** – die Schweinezucht ersetzt sie *(Korrektur vom 30.10.2026)*. Abwandlungen sind erlaubt, aber das Spiel soll sich sehr nah an 1602 orientieren. *(Korrektur vom 30.10.2026)*
4. **Inhaltlich so nah wie möglich an 1602.** Der Nutzer will „theoretisch 1602 spielen können, nur in neuem Kleid“: fünf Stufen (Pioniere, Siedler, Bürger, Kaufleute, Aristokraten), Rohstoffvorkommen (Stein und Erz am Berg, seltenes Gold), Inseln mit unterschiedlichen Pflanzen, Militär mit Soldaten und Gefechten, Schiffe, Handel. Abwandlungen nur, wo sie rechtlich nötig oder klar besser sind – nicht alles anders machen. *(Korrektur vom 30.10.2026)*
5. **Keine Fachwörter ohne Erklärung.** Der Nutzer ist kein Entwickler. Begriffe wie „Low Poly“, „Shader“, „Mesh“ vermeiden oder in einfachen Worten erklären. *(Korrektur vom 30.10.2026)*
6. **Realistischer Grafikstil wie die modernen Anno-Teile**, nicht comichaft oder niedlich: echte Materialien (Holz, Stein, Ziegel), realistisches Licht und Wasser, natürliche Landschaft mit echten Bergen. Modelle von Meshy im Stil „realistic“ mit echten Oberflächen. *(Korrektur vom 30.10.2026)*
7. **Kernablauf wie 1602:** zufällige Inselwelt (viele Inseln, Formen, Größen, Klima, Fruchtbarkeit, Rohstoffe), am Anfang unentdeckt; Start mit einem Schiff, Erkunden, Insel wählen, Kontor an der Küste bauen; KI-Konkurrenten suchen und besiedeln ebenfalls Inseln; Einflussbereich von Kontor/Marktplatz sichtbar (Baugebiet + Warenabholung), Marktplätze erweitern ihn; Betriebe haben Arbeitsradien; Marktkarren holen Waren sichtbar über Wege ab. Reverse Engineering ist nicht nötig – die Zahlen stehen in docs/1602-INHALT.md. *(Korrektur vom 30.10.2026)*
8. **Schritt für Schritt statt alles auf einmal:** Die Oberfläche zeigt nur, was der Spieler gerade nutzen kann (wie 1602). Nicht freigeschaltete Gebäude, Kategorien und Waren sind ausgeblendet; neue Möglichkeiten werden angekündigt, und es gibt Hinweise, was als Nächstes kommt. Intuitiv, ohne Suchen und Durchklicken. *(Korrektur vom 30.10.2026)*
9. **Inseln müssen brauchbar groß sein.** Keine Mini-Inseln, auf die nur ein Kontor passt. Große Inseln: viel Platz für große Städte, dafür eher unfruchtbar und selten Gold. Kleine Inseln: fruchtbarer und öfter Gold, aber immer groß genug für eine echte Siedlung. *(Korrektur vom 30.10.2026)*
10. **Lebendige Welt mit echter Rohstoff-Logik:** Rohstoffe verbrauchen sich und wachsen nach (Bäume fallen → Setzling → wächst wieder; Fischbestand je Fanggebiet; Wild; Weideland). Betriebe derselben Art in der Nähe teilen sich den Rohstoff (zu dicht gebaut = weniger Ertrag). Beim Bauen zeigt eine Skala, wie ergiebig der Platz ist (z. B. Bucht vs. offene Küste). Alles sichtbar animiert: Fischschwärme, fallende Bäume, arbeitende Holzfäller, Fischerboote, Tiere – das gilt sinngemäß für alle Gebäude. *(Korrektur vom 31.10.2026)*
11. **Den vollen Umfang von 1602 umsetzen, nicht stückeln.** Alle Waren, Ketten, Gebäude und Stufen gehören ins Spiel: Steine (statt Ziegel, ohne Steinmetz) für Pflasterwege (schneller), Mauern, Burg, Kirche usw.; Erz → Eisen → Werkzeug, Schwerter, Musketen, Kanonen; Werften mit kleinen/großen Handels- und Kriegsschiffen (Tempo, Laderaum, Kanonen); alle Plantagen (Getreide, Wein, Zuckerrohr, Tabak, Gewürze, Kakao, Baumwolle) und Waren (Alkohol, Tabakwaren, Stoffe, Kleidung, Schmuck); fünf Stufen mit Bedürfnissen (Kapelle, Wirtshaus, Schule, Kirche, Badehaus, Hochschule, Theater) und Freischaltungen. Referenz: docs/1602-INHALT.md. *(Korrektur vom 31.10.2026)*

## Feste Projektentscheidungen
- Ziel: zuerst ein Spiel für den Nutzer selbst, Launch später möglich.
- Rechtlich sauber: **kein** Code, keine Grafiken, Sounds, Texte oder Namen aus Anno 1602 oder Reverse-Engineering-Projekten. Nur allgemeine Spielmechaniken (nicht geschützt) als Inspiration. Das Wort „Anno“ kommt im Spiel nicht vor.
- Grafik: realistisches, detailreiches 3D. Modelle (Gebäude, Menschen, Tiere, Schiffe) erzeugt der KI-Dienst **Meshy** (Nutzer zahlt den Plan); Landschaft, Wasser, Licht und Effekte programmiert Claude. Details: docs/GRAFIK.md.
- Bedienung: iPhone im Querformat, Touch zuerst (Maus nur fürs Testen).
- Zeit: Echtzeit mit Pause und Tempo 1x/2x/4x, Spiel friert ein, wenn die App zu ist. Automatisches Speichern.
- Etappen (neu): 1) Kernablauf – Inselwelt, Schiff, Kontor, Einfluss, Wege, Marktkarren, Original-Ketten und Freischaltungen, KI-Konkurrenten siedeln → 2) alle fünf Stufen, Handel mit Händlern/Ureinwohnern, Piraten → 3) Kampf (Militär, Seeschlachten, Eroberung) → 4) Feinschliff, Szenarien, Endwertung.
- Sprache im Spiel und in der Kommunikation: Deutsch, einfach und ohne Fachchinesisch.

## Arbeitsweise
- Vor jeder Lieferung prüft ein separater Agent ohne Vorwissen das Ergebnis gegen `docs/ANFORDERUNGEN.md` und diese Regeln.
- Neue Korrekturen des Nutzers hier als dauerhafte Regel ergänzen.

## Technik
- Vite + TypeScript + three.js. `npm run dev` zum Entwickeln, `npm run build` erzeugt eine einzelne Datei `dist/index.html`.
- `npm run check` = Typprüfung. `node scripts/smoke.mjs` = Browser-Test (Playwright).
