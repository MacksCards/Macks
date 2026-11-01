# Anforderungen – Neue Ufer (Kernspiel)

Quelle: Interview mit dem Nutzer am 30.10.2026; ergänzt am 31.10.2026 um die Entscheidungen aus dem 1:1-Abgleich (Abschnitte unten).

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
- B4 Wege und Mauern lassen sich per Tippen bauen (Start, Ziel, ✓; siehe B-Touch). Ein Finger zieht nie einen Weg.
- B5 Abreißen ist möglich, mit teilweiser Rückerstattung.
- B6 Bedienelemente groß genug für Finger: Tippziele mindestens **44 px** (Apple-Empfehlung), kleinste Schrift mindestens 12 px, Notch/Rundungen werden berücksichtigt. Alle wichtigen Knöpfe (Hauptknopf eines Fensters, Schließen, Abreißen, Militär, „Alles ausladen“) sind ohne Wischen erreichbar – im Infofenster stehen sie in einer festen Fußleiste, die beim Wischen stehen bleibt. Das Baumenü links zeigt auch zweispaltig unter jedem Symbol eine kurze Beschriftung.

- B-Touch: Wege und Mauern werden per Tippen gebaut (Start, Ziel, Vorschau mit Kosten, ✓); der Weg führt selbst um Wasser und Gebäude herum. Ein Finger verschiebt immer nur die Karte, zwei Finger zoomen/drehen – dabei wird nie gebaut.
- B-Schiff: Tipp auf Meer = Schiff fährt hin. Tipp auf Land = das Schiff fährt in Tipp-Richtung, so weit es kommt, und hält an der zugewandten Küste der angetippten Insel (es umrundet die Insel nicht); geht das nicht, sucht es einen nahen Küstenplatz; „kein Weg“ erscheint nur, wenn es sich gar nicht bewegen kann. Tipp auf ein eigenes Gebäude bei gewähltem Schiff = Schiff segelt hin (am Kontor in Ladereichweite), ein zweiter Tipp zeigt die Info. Im Nebel verrät kein Hinweis, dass dort Land ist; taucht unterwegs Land auf, plant das Schiff neu. Beschädigte Schiffe fahren langsamer.
- B-Wege: Start und Ziel sind gelb markiert; ist das Ziel nicht erreichbar, endet die Strecke am nächsten erreichbaren Feld; gibt es gar keinen Durchgang, wird nichts gebaut (kein Bau von Bruchstücken). Mauern lassen sich nicht über Wege setzen; ein eigenes Tor darf auf einen eigenen Weg und gehört zum Wegenetz (Karren fahren hindurch, Feinde nicht).
- B-Flüssig: Schiffe, Soldaten, Karren und Fischerboote werden zwischen den Rechenschritten flüssig dargestellt; Tiere laufen, bleiben stehen und grasen; Figuren rutschen nicht.

## Zeit & Speichern
- C1 Echtzeit mit Pause und Tempo 1x / 2x / 4x.
- C2 Automatisches Speichern (regelmäßig und beim Verlassen) in „Auto 1“ und „Auto 2“ (abwechselnd alle 5 Minuten), gepackt im großen Speicher des Browsers. Beim Öffnen geht es mit dem zuletzt gespeicherten Stand exakt dort weiter; der alte Stand aus früheren Fassungen wird übernommen.
- C3 „Neues Spiel“ erzeugt eine neue Inselwelt mit den gewählten Einstellungen (Schwierigkeit, Konkurrenten 0–3, Piraten, Feuer/Pest/Dürre, Inselwelt-Nummer zum Teilen) und fragt vorher, ob das jetzige Spiel auf einen eigenen Platz gesichert werden soll. Ein unlesbarer Spielstand wird gesichert statt überschrieben.
- C4 Einstellungen *(gilt, P1)*: Grafik Auto / Hoch / Sparsam (bleibt gespeichert), Ton und Musik; ohne Vollbild der Hinweis „Teilen → Zum Home-Bildschirm“.

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
- D9 Freier Händler am Kontor (Kaufen/Verkaufen): seit S2 per Händlerschiff und Aufträgen (siehe N2); der Sofort-Handel bleibt als teurer Notbehelf (40 % Aufschlag bzw. Abschlag).

## Kampf (Regel 1, Kernbestandteil)
- K1 Soldaten wie im Vorbild: Schwertkämpfer, Reiter (je 3 Schwerter), Musketier (4 Musketen), Kanonier (2 Kanonen) mit den Originalwerten (Treffer, Stärke, Tempo der Schläge, Reichweite) und Unterhalt; Ausbildung in Burg/Großer Burg/Festung (3/5/8 gleichzeitig); höchstens 99.
- K2 Führen per Tippen: Soldat antippen, mehrere in der Nähe dazunehmen, hinlaufen, angreifen, aufs Schiff steigen; Soldaten wehren sich selbst und greifen Feinde in der Nähe an; Musketiere und Kanoniere schießen nicht durch Wald.
- K3 Mauern und Tore halten Feinde auf (eigene Leute gehen durch Tore); Wachtürme schießen auf Soldaten und Schiffe (Reichweite 8).
- K4 Schiffe: Kanonen am Kontor laden (bis 6/8/10/14 je Schiffstyp), Seeschlachten, Versenken, Ausbessern an der Werft, Soldaten übersetzen und an Land setzen.
- K5 Eroberung: Fällt Kontor oder Marktplatz, während eigene Soldaten danebenstehen, wechseln es und alle Gebäude im Gebiet den Besitzer; sonst wird es zerstört. Gegner ohne Gebäude und Schiffe ist besiegt → ein Triumphbogen je Sieg, jeder erlaubt ein Schiff mehr.
- K6 Krieg & Frieden mit jedem Konkurrenten (Krieg erklären, Frieden gegen Entschädigung); Angriff im Frieden nur nach Rückfrage. Die KI wirbt Soldaten an, erklärt Krieg, wenn sie deutlich stärker ist (mit Vorwarnung drei Minuten vorher, nie zwei Vorwarnungen gleichzeitig und frühestens 10 Minuten nach der letzten Kriegserklärung; frühestens nach 40 Minuten und 15 Minuten, nachdem der Spieler Burg/Türme bauen kann, spätestens ab 90 Minuten), schickt Kriegsschiffe und landet Truppen.
- K7 Piraten: tauchen nach ca. 30 Minuten auf, überfallen Schiffe (Handelsschiffe werden ausgeraubt, Kriegsschiffe bekämpft; danach 10 Minuten Ruhe, bei leerem Schiff 30 Minuten), beschießen ungeschützte Küsten erst ab ca. 50 Minuten und 15 Minuten nach Freischaltung der Wachtürme; Kontore werden geplündert, nicht zerstört; nach jedem Küstenüberfall hat die ganze Insel 10 Minuten Ruhe; ohne Kontor und ohne Material für ein Kontor kommt ein neues Schiff mit Startladung; Schutz kaufen möglich; drei versenkte Piratenschiffe → Triumphbogen.
- K9 Niederlage: Ohne Gebäude und Schiffe erscheint „Spiel verloren“ mit der Wahl „mit neuem Schiff weiterspielen“ (Frieden mit allen, 40 Minuten keine Kriegserklärung) oder „Neues Spiel“.
- K8 Sichtbar und hörbar: Lebensbalken, Mündungsfeuer, Kanonenkugeln, Rauch, brennende Gebäude, sinkende Schiffe; Klänge für Schwerter, Musketen, Kanonen, Sturmglocke.
- K10 Kampfregeln wie im Vorbild (Paket M1): Musketiere, Kanoniere, Türme und Schiffe treffen nicht immer (85/80/75 %), der Schaden je Treffer ist so ausgeglichen, dass im Mittel so viel ankommt wie im Vorbild (Kanonier gegen Holzturm ≈ 6, gegen Steinturm ≈ 8 Schüsse). Weiße Flagge am Schiff (nicht gespeichert): Piraten und Computergegner lassen es in Ruhe (nicht mit Soldaten an Bord), verfolgende Piraten lassen ab, die eigenen Kanonen schießen nicht von selbst; ein Angriffsbefehl holt sie ein. Freier Händler und Ureinwohner sind nie Ziel von Piraten und Computergegnern; Ureinwohner nur auf ausdrücklichen Befehl des Spielers (mit Rückfrage), nie Krieg. Piratenschiffe drehen unter 30 % Trefferpunkten ab und kommen erst erholt (70 %) wieder. Soldaten fällen Bäume (≈ 4 s, danach Gras; Kanoniere nicht), laufen in Aufstellung Reihe oder Block (Nahkämpfer vorn, Kanoniere hinten), lassen sich ausmustern (still, ohne Sold). Schiffe patrouillieren zwischen zwei Punkten und greifen Feinde in Reichweite an. Im Umkreis eines eigenen Arztes heilen Soldaten 1 Leben/s und kosten keinen Sold, sonst nur 0,03/s; Gebäude bessern sich von selbst nur bis 75 % aus. Kanonentreffer setzen Holzgebäude mit 25 % in Brand (wirkt, sobald es Feuer gibt). Kampfmeldungen haben einen Ort. Zufall im Kampf wiederholbar (gleicher Ablauf nach dem Laden). Großes Gefecht (≈ 160 Soldaten): Spielschritt im Mittel unter 6 ms. Prüfung: `scripts/kampf-test.ts`.

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
- G4 Wenn der Lager-Platz einer Ware voll ist, geht keine Ware verloren: Karren holen nichts mehr ab, der Betrieb meldet „Lager voll“.
- G5 Start ohne Internet möglich (Schriften sind im Spiel enthalten).

## Entscheidungen aus dem 1:1-Abgleich (Nutzer, 31.10.2026)
Quelle: `CLAUDE.md`, Abschnitt „Entscheidungen aus dem 1:1-Abgleich“; Hintergrund und Status je Punkt: `docs/ABGLEICH-1602.md`, Abschnitt 6. **Status „gilt“** = jetzt prüfen; **„geplant (Paket)“** = erst prüfen, wenn das Paket geliefert ist (bis dahin kein Mangel).

- Z1 Steuern wie 1602 *(gilt seit L2; großes Steuer- und Bilanzfenster geplant U2)*: Jede Stufe hat einen eigenen Steuerregler (− / + in 2-%-Schritten, Knöpfe 44 px) im Hausfenster (eigene Stufe) und im Kontor (alle schon erreichten Stufen), mit Gesicht 😊/😐/😠 und dem tragbaren Satz. Höchstsätze, bei denen voll versorgte Bewohner noch bleiben: Pioniere 48 %, Siedler 45 %, Bürger 38 %, Kaufleute 36 %, Aristokraten 35 % (weniger, wenn Waren fehlen; z. B. Bürger mit der Hälfte ihrer Waren etwa 17–25 %). Ein Satz über dem tragbaren macht unzufrieden bis zum Auszug (gut 10 Punkte zu viel). Die Steuerkurve ist flach: ein Aristokrat zahlt etwa das 1,4-Fache eines Pioniers. Die Gesamteinnahmen sind so eingestellt, dass das Spiel nicht schwerer wird (Nachweis `scripts/wirtschaft-sim.ts`: Aristokratenstadt mit etwa 43 % Gewinn, vorher 39 %, Original etwa ein Drittel). Computergegner zahlen immer den Standardsatz. Spielstände ab Version 5 speichern die Sätze; ältere Stände starten mit dem Standardsatz.
- Z2 Bankrott *(gilt seit L2)*: Warnungen mit Rat bei −2 000, −5 000 und −10 000 Talern und 2 Minuten vor Schluss. Wer 10 Spielminuten ununterbrochen unter −10 000 Taler steht, ist bankrott: Fenster „Bankrott“ mit „Schulden erlassen und weiterspielen“ (Kasse auf 0, wird gezählt – Punktabzug kommt mit S5) oder „Neues Spiel“. Computergegner verlieren dadurch nicht (im Minus bauen sie nur nichts).
- Z3 Wirtschaftstempo wie 1602 *(gilt seit L2)*: Jeder Betrieb einer Bedarfskette versorgt 60 bis 100 % so viele Bewohner wie im Original (gemessen 60–83 %), die Rohstoffbetriebe passen wie im Original zu ihren Werkstätten (2 Schaffarmen, 2 Zuckerrohr- oder Tabakplantagen je Werkstatt, 1 Goldmine je Goldschmied). Die Kosten der Warenketten liegen bei 26–45 % der Steuer (Aristokraten 40 %). Nachweis: `scripts/wirtschaft-sim.ts` (auch im laufenden Spiel: 2 Schaffarmen + Weberei liefern mit Marktkarren die volle Leistung). Abweichung: Bergbau, Metall, Holz und Steine laufen im alten Tempo (Baustoffe und Waffen, nicht Bedarf der Bewohner).
- Z4 Felder *(geplant L4/G3b)*: Farm und Plantage legen beim Bau automatisch sichtbare Felder an (5 Taler je Feld). Die Felder reifen erst; ein Feld-Werkzeug dient zum Nachbessern. Es gibt keine unsichtbaren Felder mehr.
- Z5 Grafik-Reihenfolge *(gilt)*: Sichtbare Fehler zuerst im Code beheben, dann eine Meshy-Probe mit 3 Modellen (Wohnhaus, Kontor, Schaf). Alle weiteren Modelle erst nach Freigabe der Probe durch den Nutzer; im Code wird nur nachgebaut, was Meshy nicht liefert. Der Schlüssel `MESHY_API_KEY` steht nie im Chat, im Code oder im Git.
- Z6 Schwierigkeit *(gilt seit P1; Gegner-Wachstum geplant KI2, Katastrophen S3)*: Beim neuen Spiel wählbar: leicht / normal / schwer mit Startgeld 20 000 / 15 000 / 10 000 (Standard und erster Start: normal). Heute wirken außerdem: Kasse der Gegner (¾ / 1 / 1½ des bisherigen Startgelds), Belohnung der Aufgaben (schwer: die Hälfte), Piraten frühestens nach 60 / 30 / 30 Minuten. Standard „normal“: Gegner wachsen bis Kaufleute, besiedeln 2 bis 3 Inseln und greifen nach Vorwarnung an (Werte liegen in `src/schwierigkeit.ts` bereit, wirken mit KI2). Katastrophen standardmäßig „mild“ (abschaltbar; die Wahl wird gespeichert und wirkt mit S3).
- Z7 Inselgrößen wie 1602 *(geplant L5, zuletzt)*: Fünf Größenklassen (etwa 100 × 90 bis 30 × 30 Felder), größere Welt, beim Start wählbar. Erst nach der Grafik-Leistungsarbeit (R1, R2) und einem Test auf dem iPhone des Nutzers. Auch große Inseln sind brauchbar groß; kleine nie unter einer echten Siedlung (Regel 9).

## Neue prüfbare Anforderungen aus dem Abgleich (Etappen 2 bis 4, siehe docs/OFFEN.md)
Alle *geplant* mit Paketname; ein Prüfer meldet sie erst als Mangel, wenn das Paket geliefert wurde.

- N1 Heimatinsel *(gilt, L1)*: Die erste Insel ist groß oder mittel, hat Berg mit Erz und mindestens eine Pflanze mit 100 % Fruchtbarkeit; irgendwo in der Welt gibt es Gold (Garantie auf einer kleinen Berginsel). Der Spielstart deckt ein Stück Küste der Heimatinsel auf.
- N2 Händlerschiff mit Aufträgen *(geplant S2/U5)*: Am Kontor stellt man Kauf- und Verkaufsaufträge (Ware, Menge, Preis) ein, die Zahl der Plätze wächst mit der Kontorstufe; ein freies Händlerschiff kommt und handelt danach. Der Händler verkauft nur, was jemand hergestellt hat (Ausnahme Werkzeug, Erz, Holz, Nahrung).
- N3 Handelsrouten *(geplant S2/U5)*: Schiffe fahren automatisch zwischen Kontoren; je Ware Laden und Ausladen einstellbar. Handel mit Computergegnern per Handelsvertrag *(M2)*.
- N4 Statistik *(Logik erledigt S1, Fenster geplant U2)*: Fenster mit Bevölkerung je Stufe (Stimmung, was fehlt), Waren (Erzeugung, Verbrauch, Saldo) und Bilanz (Einnahmen und Ausgaben nach Arten, Heer sichtbar, Verlauf).
- N5 Warnungen *(erledigt S1)*: Meldung bei Warenmangel („Nahrung reicht noch 1 Minute“), Hunger, Auszug, Lager voll und Minus in der Kasse, jeweils mit Ort und Warnzeichen ⚠️ (Alarmton); dieselbe Warnung je Ware und Insel höchstens alle 5 Spielminuten.
- N2 Händlerschiff mit Aufträgen *(gilt seit S2; große Handelsoberfläche U5 geplant)*: Am Kontor (Reiter „⚖️ Handel“) stellt man Kauf- und Verkaufsaufträge ein (Ware, „kaufen bis X t“ bzw. „verkaufen über X t“, Preis 70–105 % des Grundpreises); Plätze je Kontorstufe 4/3, 7/4, 8/6, 11/8. Ab dem ersten Kontor kommt alle 3 bis 6 Minuten ein freies Händlerschiff (weiße Flagge, neutral, nicht angreifbar) vom Kartenrand an jedes Kontor mit Küste, liegt etwa 40 Sekunden im Hafen und handelt danach (Meldung „Händler im Hafen“). Preise schwanken ± 15 %, je 10 t gekaufter oder verkaufter Ware um 8 % und erholen sich in etwa 5 Minuten; höchstens 40 t je Ware und Besuch. Der Händler verkauft nur, was schon einmal in einem Lager war (Ausnahme Werkzeug, Erz, Holz, Nahrung), Waffen knapp und teuer (höchstens 10 t, dreifacher Preis). Ein bewaffnetes feindliches Schiff im Umkreis von 10 Feldern blockiert das Kontor (Meldung „blockiert von …“). Alle Käufe und Verkäufe gehen ins Kassenbuch.
- N3 Handelsrouten *(gilt seit S2; große Bedienung U5 geplant)*: Ab zwei eigenen Kontoren hat das Schiffsfenster den Block „🧭 Handelsroute“: 2 bis 4 Halte, je Halt und Ware „laden bis X t an Bord“ oder „ausladen bis X t“ (höchstens 100 t); das Schiff fährt allein, lädt und löscht, meldet „Route blockiert“ bei vollem Ziel oder leerer Quelle (wartet bis 30 s, fährt dann weiter); Anhalten und Weiter; lenkt man das Schiff selbst, pausiert die Route. Am eigenen Kontor lässt sich ein leeres Schiff abwracken (Hälfte von Holz und Stoffen zurück). Handel mit Computergegnern per Handelsvertrag *(M2; der Händlerbesuch nimmt dafür eine eigene Preisliste an)*.
- N4 Statistik *(geplant S1/U2)*: Fenster mit Bevölkerung je Stufe (Stimmung, was fehlt), Waren (Erzeugung, Verbrauch, Saldo) und Bilanz (Einnahmen und Ausgaben nach Arten, Heer sichtbar, Verlauf).
- N5 Warnungen *(geplant S1)*: Meldung bei Warenmangel („Nahrung reicht noch 1 Minute“), Hunger, Auszug, Lager voll und Minus in der Kasse, jeweils mit Ort.
- N6 Meldungsverlauf *(geplant U3)*: Liste der letzten Meldungen mit Uhrzeit; ein Tipp springt zum Ort des Geschehens; wichtige Meldungen bleiben stehen, bis man sie antippt.
- N7 Übersichtskarte *(geplant U3)*: dauernd sichtbare Minikarte mit Sichtfeld, Kontoren, Schiffen und Feinden; Tippen setzt die Kamera. Die große Weltkarte zeigt Inselnamen, Erz, Gold und hält das Spiel nicht an. Liste „Meine Schiffe und Inseln“ zum schnellen Wählen und Umbenennen.
- N8 Ereignisse *(geplant S3)*: Feuer (Feuerwehr), Pest (Arzt), Kriminalität (Galgen), Dürre, Schatzfund; Standard „mild“. Feuerwehr, Arzt und Galgen erscheinen im Baumenü erst, wenn diese Ereignisse im Spiel sind (Regel 8).
- N9 Ureinwohner *(geplant S4)*: Dörfer auf manchen Inseln, Tauschhandel Ware gegen Ware (etwa 1 : 1,5), bei Angriff endet der Handel für immer und ein Fluch bringt häufiger Feuer, Pest und Dürre; Angriff nur nach deutlicher Rückfrage.
- N10 Endwertung *(geplant S5)*: Punkte für Einwohner, Kasse und Siege und eine Rangliste am Ende; wann das Spiel endet (heute beendet ein Sieg es nicht), legt Paket S5 fest und wird hier nachgetragen.
- N11 Mehrere Spielstände *(gilt, P1)*: zwei automatische und drei eigene Plätze mit Datum, Spielzeit, Einwohnern, Geld und Schwierigkeit; Laden, Speichern, Löschen (Überschreiben und Löschen mit Rückfrage); Weitergeben als Text oder Datei und Einlesen; Fehler beim Speichern und Laden werden gemeldet.
- N12 Rückgängig *(geplant U4)*: Nach jedem Bau und jeder Wegstrecke kurze Zeit „↩ Rückgängig“ mit voller Rückerstattung. Wohnblöcke und Abrissbereiche lassen sich per Rahmen (zwei Ecken) bauen bzw. abreißen, mit gemeinsamer Rückfrage.
- N13 Unterhalt und Betrieb *(gilt seit L2)*: Betriebe zahlen im Betrieb den vollen Unterhalt, in Ruhe (Stillstand, nichts zu tun, „Lager voll“, abgeschaltet) den Ruhewert des Originals (z. B. Weingut 35/15, Steinbruch 0); Werften 100/150 nur mit Auftrag, sonst 20/30. Knopf „💤 Ruhen lassen“ / „▶ Arbeiten“ an jedem Betrieb (ruhend: keine Arbeit, kein Abholen). Schalter „Baumaterial an Bewohner“ am Kontor (gesperrt: Häuser steigen nicht auf, Meldung „Baumaterial gesperrt“; das Lager fällt nie unter 0). Nahrung ist Pflicht: Hunger senkt die Zufriedenheit auf höchstens 30 %, die Bewohner ziehen aus (Meldung mit Grund). Ist ein Haus 90 s sehr unzufrieden und nur noch so voll wie die Stufe darunter, steigt es ab („Haus verfällt: … fehlt“). Aufstieg nur, wenn die Aufstiegsware die Insel samt Haus mindestens 2 Minuten versorgt. Marktkarren holen nur in Abholweite (Kontor 8, Marktplatz 12 Felder) ab, sonst „Zu weit vom Kontor oder Marktplatz“; Karren tragen 10 t. Das Kontor lässt sich abreißen, wenn sonst nichts mehr auf der Insel steht (Lager verfällt, Land und Wege werden frei).
- N14 Computergegner *(Wirtschaft gilt seit KI1, Wachstum geplant KI2)*: Alle Betriebe der Gegner hängen am Wegenetz, kein Gegner bleibt dauerhaft im Minus; später wachsen sie bis Kaufleute und besiedeln 2 bis 3 Inseln.
- N15 Kampf-Ergänzungen *(geplant M1/M2/U4)*: weiße Flagge, Soldaten ausmustern, Bäume fällen, Aufstellung, Arzt heilt, Kanonen setzen Gebäude in Brand, Piratennest zerstörbar, Piraten bestechen.
- N17 Stadtleben *(gilt, G3)*: Schornsteine rauchen nur, solange der Betrieb arbeitet bzw. jemand im Haus wohnt (Schmelze, Schmieden und Kanonengießerei dunkel und kräftig, Bäckerei hell, Wohnhaus dünn), auch an den Meshy-Modellen; die Mühle dreht sich nur, wenn sie arbeitet. Ein neues Gebäude wächst in gut einer Sekunde aus dem Boden (Staub, Hammerschläge), beim Aufstieg steht kurz ein Gerüst, beim Abriss sinkt es mit Staub ein. Warnsymbole über eigenen Gebäuden haben einen Ring in der Farbe der Dringlichkeit (rot: steht still oder Bewohner ziehen weg, gelb: eingeschränkt, grau: Hinweis), Häuser zeigen ein gelbes Gesicht unter 70 % und ein rotes unter 45 % Zufriedenheit; weit herausgezoomt (ab Abstand 40) werden sie zu Sammelmarken mit Zahl. Über entdeckten Inseln stehen ab Abstand 20 Erz, Gold und die Pflanzen mit Prozent. Ein angetippter Erntebetrieb zeigt seinen Arbeitsradius in der Farbe seiner Ergiebigkeit. Eigene Soldaten lassen sich in Fingerbreite antippen, ab Abstand 45 tragen sie eine Marke.
- N16 Klänge *(geplant A1)*: passende Klänge für Bedienung, Bauen, Schiffe, Kanonen, Möwen, Meer und Musik; Ton und Musik einzeln abschaltbar (Regel 12).

## Später (fest eingeplant, siehe docs/OFFEN.md)
- Prestigebauten (Palast, Kathedrale, Denkmal), Plätze, Anlegesteg, Brücken über Flüsse (L3, L5); Szenarien (F2).
- Mehrspieler und Karteneditor sind bewusst nicht geplant (docs/1602-INHALT.md, Abschnitt 12).
