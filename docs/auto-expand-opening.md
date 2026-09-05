# Berechnete Autoexpand-Eröffnung

Die Eröffnung wählt Zeitpunkt und Truppenmenge anhand der aktuellen neutralen
Grenze. Sie spart zunächst Zinsen an und bündelt Expansion so, dass die eroberten
Felder möglichst schon bei der nächsten Gebietseinnahme mitbezahlt werden.
Bei jedem neuen Spiel wird sie automatisch über ECO aktiviert. Über den
ECO-Knopf lässt sie sich für das laufende Spiel ausschalten; das nächste Spiel
startet wieder mit aktiver Eröffnungsstrategie. Replays aktivieren ECO nicht.

## Quellen und überprüfte Mechanik

- [Offizielles Tutorial](https://territorial.io/tutorial), Abschnitte 4 und 5,
  abgerufen am 05.09.2026: Zinsmaximum bei 100 Truppen pro Feld; jede Landaktion
  kostet zusätzlich `floor(12 * Bestand / 1024)`. Häufige Kleinstangriffe kosten
  dadurch unverhältnismäßig viele Truppen.
- [Community-Übersicht der Eröffnungen](https://territorial.fandom.com/wiki/Openings),
  abgerufen am 05.09.2026: Angriffe vor der Gebietseinnahme abschließen und die
  Abwägung zwischen schneller Flächensicherung und angesparten Truppen beachten.
  Deren veröffentlichte Rekordwerte sind keine Vergleichsmessung dieses Clients.
- Die konkrete Berechnung folgt zusätzlich der lokal eingebundenen Spielversion
  (`game/latest.js`, formatierter Build `build/game.js`): 56 ms pro Spieltick,
  Zinsen bei Tick `% 10 == 9`, Gebietseinnahmen bei `% 100 == 99`, standardmäßig
  zwei Truppen Eroberungskosten pro neutralem Feld. Ein neuer Angriff erreicht
  die erste Schicht nach sieben Ticks; weitere Schritte benötigen bei weniger
  als 1.000 Feldern vier Ticks, ab 1.000 drei, ab 10.000 zwei.

## Optimierungsziel und Grenzen

Die Suche vergleicht Warten sowie Angriffe auf vollständige Grenzschichten auf
einem Raster von zehn Spielticks. Sie simuliert Zinseszinsen, Angriffsgebühren,
Rundung des Sendeprozentsatzes, Gebietseinnahmen, Dichtebegrenzung, zurückkehrende
Truppen und die veränderliche Ausbreitungsgeschwindigkeit.

Bewertet wird `Truppenbestand + Eroberungskosten * Gebiet` am Ende der Eröffnung
(Tick 600 / 33,6 Sekunden). Das bewertet investierte Fläche und verfügbares
Kapital gemeinsam. Je gleichwertigem Gebiet- und Cooldown-Zustand bleibt die
Variante mit dem höheren Bestand erhalten. Dies ist eine Optimierung innerhalb
dieses Modells, kein Beweis für eine allgemein optimale Multiplayer-Strategie.

Die Bedingungen der Suche sind:

- Maximal ein Eröffnungsangriff je Gebietseinnahmezyklus und höchstens 50 % des
  Bestands vor der zusätzlichen Gebühr. Ein niedrigerer Slider bleibt bindend.
- Der Angriff einschließlich Rückkehr der Resttruppen muss im betrachteten
  Gebietseinnahmezyklus enden. Laufende neutrale Angriffe werden nicht verstärkt.
- Vorschau auf höchstens 48 vollständige neutrale Schichten. Die Suche stoppt
  vor einer zusätzlichen Schicht, die das Vorschauvolumen von 32.768 Feldern
  überschreitet. Eine unvollständige Schicht wird nicht als billiger Angriff
  angeboten. Die unmittelbare Grenze bleibt vollständig erfasst.
- Bei einem feindlichen Spieler oder Bot innerhalb von sechs neutralen Schichten
  wird nur über die nächsten zwei Gebietseinnahmezyklen geplant und Fläche höher
  bewertet (`Truppenbestand + (Eroberungskosten + 1) * Gebiet`). Diese bewusste
  Heuristik sichert umkämpftes Land früher.
- Multiplayer erhält zehn zusätzliche Ticks Zeitpuffer. Das ist eine Annahme
  über die Befehlslaufzeit; variable Netzwerklatenz und fremde Züge werden nicht
  exakt vorhergesagt. Vor dem geplanten Angriff wird mit der aktuellen Karte
  und dem tatsächlichen Bestand neu gerechnet.

Eigene Einkommenseinstellungen fließen in die Berechnung ein. Die Suche gilt
für die Eröffnung bis Tick 599; anschließend greifen die bestehenden Regeln
für dichteabhängige Expansion und bezahlbare Botangriffe.

Die Freigabe von Botangriffen hängt dabei von der tatsächlichen Grenze ab,
nicht vom Ablauf der 33,6 Sekunden: Solange direkt erreichbares freies Land
vorhanden ist oder noch ein neutraler Angriff läuft, spart Autoexpand für die
neutrale Expansion. Auch ein momentan zu kleiner Slider oder das bewusste
Warten auf Einkommen löst keinen Botangriff als Ersatz aus. Erst wenn die
neutrale Grenze ausgeschöpft und die neutrale Armee zurückgekehrt ist, werden
bezahlbare Botangriffe freigegeben. Erschließt eine Boteroberung neues freies
Land, erhält dieses wieder Vorrang. Unerreichbares freies Land anderswo auf
der Karte verhindert die Botfreigabe nicht. Manuelle Gegnerangriffe bleiben
möglich; diese Priorität betrifft die automatischen Aktionen.

## Verbindlicher Cooldown

Alle automatischen Angriffe teilen sich mindestens 50 Spielticks Pause, bei
normaler Geschwindigkeit 2,8 Sekunden. Korrekturangriffe und Botangriffe können
die Pause nicht umgehen. Sie beginnt bei der Anfrage und läuft nach deren
Bestätigung erneut vollständig; auch ein bestätigter manueller Landangriff
verschiebt den nächsten automatischen Angriff. Der ECO-Knopf zeigt die
verbleibende Zeit. Manuelle Bedienung und das Ein-/Ausschalten bleiben möglich;
ein Umschalten setzt den Cooldown nicht zurück.

## Reproduzierbarer Modellvergleich

Ausführen mit `node scripts/benchmarkAutoExpand.js`. Der unabhängige Simulator
startet mit 512 Truppen auf zwölf Feldern, 50-%-Slider und Standardeinkommen.
Er vergleicht die vorherige Eröffnung mit der neuen Controller-Logik einschließlich
Warten, Bestätigungen und Neuplanung. Gegner und Netzwerklatenz sind nicht Teil
dieser Messung.

Ergebnis nach 600 Ticks:

| Karte | Strategie | Gebiet | Truppen | Angriffe |
| --- | --- | ---: | ---: | ---: |
| Offenes Land | Vorher | 2.800 | 3.444 | 23 |
| Offenes Land | Berechnet | 4.128 | 9.806 | 6 |
| Auf 20 Schichten begrenzt | Vorher | 1.092 | 7.407 | 14 |
| Auf 20 Schichten begrenzt | Berechnet | 1.092 | 15.136 | 4 |
| Auf 5 Schichten begrenzt | Vorher | 132 | 13.795 | 2 |
| Auf 5 Schichten begrenzt | Berechnet | 132 | 16.191 | 2 |

Im offenen Referenzfall ergibt sich folgende Folge. Diese Werte werden nicht
fest einprogrammiert, sondern entstehen aus der Suche:

| Spielzeit | Sendeanteil | Gesendete Truppen |
| --- | ---: | ---: |
| 4,48 s | 16,70 % | 144 |
| 10,08 s | 15,33 % | 229 |
| 15,12 s | 21,78 % | 537 |
| 20,16 s | 32,91 % | 1.273 |
| 25,76 s | 39,16 % | 2.330 |
| 30,80 s | 49,32 % | 4.242 |

Auf derselben begrenzten Karte mit 20 Schichten führt die Gegnernähe-Heuristik
bereits nach 11,2 Sekunden zu 408 statt 48 Feldern und sichert alle 1.092 Felder
nach 22,4 Sekunden. Das prüft die frühere Expansion; es simuliert keine gegnerische KI.
