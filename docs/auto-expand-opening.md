# Berechnete Autoexpand-Eröffnung

Die Eröffnung wählt Zeitpunkt und Truppenmenge anhand der aktuellen neutralen
Grenze. Sie spart zunächst Zinsen an und bündelt Expansion so, dass die eroberten
Felder möglichst schon bei der nächsten Gebietseinnahme mitbezahlt werden.
Bei jedem neuen Spiel wird sie automatisch über ECO aktiviert. Über den
ECO-Knopf lässt sie sich für das laufende Spiel ausschalten; das nächste Spiel
startet wieder mit aktiver Eröffnungsstrategie. Replays aktivieren ECO nicht.
Die Limit-Einstellung des Angriffssliders beeinflusst die Eröffnung nicht:
Bei gleicher Spielsituation bleiben Zeitpunkt und Truppenmenge gleich, auch
wenn das Limit während der Eröffnung geändert wird.

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
  Bestands vor der zusätzlichen Gebühr. Diese eigene Budgetgrenze gilt
  unabhängig vom eingestellten Slider-Limit.
- Jeder Angriff auf neutrales Land sendet mindestens die aktuelle reine
  Zinszahlung (`max(1, floor(Zinssatz * Bestand / 10.000))`). Armee- und
  Gebietseinkommen zählen nicht zu dieser Untergrenze. So wird die feste
  Angriffsgebühr nicht für unverhältnismäßig kleine Armeen bezahlt.
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
für die Eröffnung bis Tick 599. Ab Tick 600 greifen dichteabhängige Expansion,
die zusätzliche Regel für günstiges freies Land und bezahlbare Botangriffe.
Bei diesen Aktionen und manuellen Gegnerangriffen bleibt das Slider-Limit
bindend; die Eröffnung verändert die Einstellung nicht.

## Günstiges freies Land nach der Eröffnung

Autoexpand muss nach der Eröffnung nicht mehr auf die Dichtegrenze warten:
Es erobert die direkt angrenzende neutrale Grenzschicht auch dann, wenn die
dafür benötigte Armee einschließlich Angriffsgebühr höchstens 5 % des aktuellen
Truppenbestands bindet. Diese zusätzliche Schwelle ist eine vorsichtige
Budgetregel für günstige Expansion, kein berechnetes wirtschaftliches Optimum.

Geprüft werden die tatsächlich gesendeten Truppen nach Rundung des Prozentsatzes
und die zusätzliche Gebühr `floor(12 * Bestand / 1024)`. Mindestens 95 % des
Bestands bleiben dadurch schon vor der Rückkehr der Restarmee verfügbar. Der
Angriff muss die vollständige unmittelbare Grenzschicht und mindestens eine
aktuelle Zinszahlung finanzieren können sowie ins Slider-Limit passen. Passt
diese Untergrenze einschließlich Gebühr nicht ins 5-%-Budget, wartet ECO. Bei
10.000 Truppen, 100 angrenzenden neutralen Feldern und einer Zinszahlung von 300
Truppen sind es nach Prozentrundung 302 entsandte Truppen plus 117 Gebühr.

Nach dem gemeinsamen Cooldown wird die neue Grenze erneut geprüft. Ein noch
laufender neutraler Angriff wird nicht verstärkt. Die Eröffnungsplanung bleibt
bis Tick 599 allein zuständig; die bestehenden Regeln gegen Dichteüberlauf
gelten nach der Eröffnung zusätzlich und können größere Angriffe auslösen.

## Freigabe automatischer Botangriffe

Botangriffe beginnen frühestens nach dem Ende der Eröffnungssequenz bei Tick 600
(33,6 Sekunden bei normaler Geschwindigkeit), auch wenn vorher bereits kein
freies Land mehr erreichbar ist. Sowohl der Spiel-Hook als auch die
Controller-Einstiege für Botangriffe und Korrekturen sperren frühere Aktionen.

Zusätzlich müssen die neutrale Grenze ausgeschöpft und die neutrale Armee
zurückgekehrt sein. Solange direkt erreichbares freies Land vorhanden ist oder
noch ein neutraler Angriff läuft, hat neutrale Expansion Vorrang. Ein zu kleines
Budget, das Slider-Limit oder das Warten auf Einkommen löst keinen Botangriff
als Ersatz aus. Erschließt eine Boteroberung neues freies Land, erhält dieses
wieder Vorrang. Unerreichbares freies Land anderswo auf der Karte verhindert
die Botfreigabe nicht. Manuelle Gegnerangriffe bleiben möglich.

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
startet mit 512 Truppen auf zwölf Feldern und Standardeinkommen. Die vorherige
Strategie verwendet einen 50-%-Slider; die berechnete Eröffnung ist vom Limit
unabhängig.
Er vergleicht die vorherige Eröffnung mit der neuen Controller-Logik einschließlich
Warten, Bestätigungen und Neuplanung. Gegner und Netzwerklatenz sind nicht Teil
dieser Messung.

Die Regressionstests vergleichen vollständige Angriffsfolgen, Truppen und
Gebiet bei minimalem, niedrigem, hohem und wechselndem Slider-Limit. Sie prüfen
offenes und begrenztes Land sowie Gegnernähe. Der Spiel-Hook wird außerdem für
Singleplayer und Multiplayer sowie den Übergang ab Tick 600 geprüft.
Weitere Tests prüfen die 5-%-Schwelle einschließlich Gebühren und Rundung,
die Mindesthöhe einer aktuellen Zinszahlung, günstige Expansion unterhalb der
Dichtegrenze, den gemeinsamen Cooldown und die Bot-Sperre während der gesamten
Eröffnung bei eingeschlossenem Start.

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
