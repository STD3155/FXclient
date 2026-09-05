---
name: territorial-opening
description: Plane, erkläre oder übertrage die berechnete Territorial.io-Eröffnungsstrategie aus FXclient. Verwende diese Skill für frühe neutrale Expansion, Angriffstiming, Truppenbudget und den zugehörigen Cooldown.
---

# Territorial.io: berechnete Eröffnung

Nutze diese Strategie, um in der Eröffnung freie Fläche und verzinsten
Truppenbestand gemeinsam aufzubauen. Spare zunächst Zinsen an und bündele
Angriffe so, dass neues Land möglichst vor der nächsten Gebietseinnahme
erobert ist. Passe Zeitpunkt und Truppenmenge an die tatsächliche Grenze an.

Diese Skill ist eine eigenständige Anleitung in Klartext. Die Zahlen beschreiben
das FXclient-Modell vom 05.09.2026. Behandle sie als versionsabhängige Regeln und
Modellannahmen, nicht als Beweis für eine universell optimale Eröffnung.

## Ausgangslage erfassen

Verwende den aktuellen Spieltick, Truppenbestand, eigenes Gebiet, den eingestellten
Sendeanteil, Einkommensregeln und laufende Angriffe. Erfasse die erreichbaren
neutralen Felder in aufeinanderfolgenden Grenzschichten. Prüfe, ob feindliche
Spieler oder Bots innerhalb von sechs neutralen Schichten liegen.

Fehlen diese Angaben, kennzeichne eine Beispielrechnung als Annahme. Verwende
dafür 512 Starttruppen, zwölf Startfelder, einen 50-%-Slider, Standardeinkommen
und eine offene Karte ohne Gegner. Gib eine solche Rechnung nicht als Analyse
einer unbekannten laufenden Partie aus.

## Spielmechanik berücksichtigen

| Größe | Wert im gespeicherten Modell |
| --- | --- |
| Spieltick | 56 ms bei normaler Geschwindigkeit |
| Zinszahlung | Alle zehn Ticks, bei Tickrest 9: alle 0,56 s |
| Gebietseinnahme | Alle 100 Ticks, bei Tickrest 99: alle 5,6 s |
| Gebietseinnahme im Standardspiel | Eine Truppe je eigenem Feld und Gebietseinnahmezyklus |
| Eröffnung | Ticks 0 bis 599, insgesamt 33,6 s |
| Neutrale Eroberungskosten | Zwei Truppen je Feld |
| Zusätzliche Gebühr je Landangriff | Abgerundet: 12 × aktueller Truppenbestand / 1024 |
| Dichte für maximales Zinseinkommen | 100 Truppen je Feld |
| Maximale Truppendichte | 150 Truppen je Feld |
| Erste Eroberung eines neuen Angriffs | Nach sieben Ticks |
| Weitere Eroberungsschritte | Vier Ticks unter 1.000 Feldern, drei ab 1.000, zwei ab 10.000, einer ab 60.000 |

Rechne Gebühren zusätzlich zur entsandten Armee vom Bestand ab. Die Gebühr
beträgt rund 1,17 % des gesamten Bestands, auch bei einem kleinen Angriff.
Entsandte Truppen bringen während des Angriffs keine Zinsen. Nicht verbrauchte
Truppen kehren zurück, wenn der Angriff endet.

Verwende den zeitabhängigen Zinssatz einschließlich Dichtekorrektur und
gegebenenfalls benutzerdefinierter Einkommen. Unter Standardbedingungen beginnt
die obere Zinskurve bei 7 % und fällt während der Eröffnung. Halte sie in der
Prognose nicht konstant. Berücksichtige ganzzahlige Rundung und die Reihenfolge:
Zins- und Gebietseinnahmen werden innerhalb eines Spielticks vor der nächsten
Eroberung ausgezahlt.

## Nächsten Angriff auswählen

1. Vergleiche Warten mit möglichen Angriffen auf einem Raster von zehn
   Spielticks. Plane höchstens einen Eröffnungsangriff pro Gebietseinnahmezyklus.
2. Betrachte nur vollständig erfasste neutrale Grenzschichten. Begrenze die
   Vorschau auf 48 Schichten und 32.768 Felder; erfasse die unmittelbare Grenze
   trotzdem vollständig. Verwirf eine zusätzliche Schicht, die das Limit
   überschreitet, statt sie teilweise als günstigen Angriff anzubieten.
3. Ermittle die kleinste Armee, die die gewünschten Schichten vollständig
   erobern kann. Für jede erreichte Schicht muss noch mindestens eine Truppe
   je Frontfeld über deren Eroberungskosten verfügbar sein. Bei Kosten `c` und
   Schichtgrößen `n₁ … nₖ` ist der notwendige Anfangsbetrag das Maximum aller
   Werte `c × Summe der vorherigen Schichtgrößen + (c + 1) × aktuelle Schichtgröße`.
4. Begrenze die entsandte Armee auf den kleineren Wert aus Slider und 50 % des
   Bestands vor Gebühr. Prüfe bei einer Umsetzung die tatsächlich übertragene
   Truppenmenge nach Rundung; sie muss sowohl die Mindestmenge als auch das
   Budget einhalten. Reicht das Budget nicht für die erste Schicht, warte.
5. Plane Anlaufzeit, sämtliche Eroberungsschritte und die Rückkehr der Restarmee
   ein. Der Angriff muss einschließlich Rückkehr im betrachteten
   Gebietseinnahmezyklus enden. Füge für Multiplayer zehn Ticks Zeitpuffer hinzu;
   dies ist eine Laufzeitannahme, keine Garantie über die Netzwerkverzögerung.
6. Simuliere für jede Variante den weiteren Verlauf mit Zinsen, Gebühren,
   Gebietseinnahmen und zurückkehrenden Truppen. Bewerte im ungestörten Fall
   `verbleibende Truppen + Eroberungskosten × Gebiet` bei Tick 600. Behalte für
   denselben Gebiet- und Cooldown-Zustand die Variante mit dem höheren Bestand.
7. Sind Gegner nahe, verkürze die Vorschau auf den aktuellen und den nächsten
   Gebietseinnahmezyklus, spätestens bis Tick 600. Bewerte dann
   `verbleibende Truppen + (Eroberungskosten + 1) × Gebiet`, um freie Fläche
   früher zu sichern. Diese Gewichtung ist eine Heuristik für Konkurrenzdruck.
8. Wähle die beste zulässige Variante. Liegt ihr Angriff in der Zukunft, warte
   bis zu diesem Zeitpunkt und rechne vor dem Senden mit der aktuellen Grenze
   und dem tatsächlichen Bestand neu. Verstärke keinen noch laufenden neutralen
   Angriff. Unterbrich die geplante Eröffnung bei verfügbarem neutralem Land
   nicht durch zusätzliche Korrektur- oder Botangriffe.

## Aktivierung und Cooldown erhalten

- Aktiviere die Strategie bei jedem neuen Live-Spiel automatisch über ECO.
  Setze den Plan, ausstehende Anfragen und den Cooldown des vorherigen Spiels
  zurück. Replays aktivieren ECO nicht.
- Respektiere das manuelle Ausschalten über ECO für die laufende Partie.
  Aktiviere erst beim nächsten Spielstart wieder automatisch.
- Halte zwischen allen automatischen Landangriffen mindestens 50 Spielticks
  Pause ein, entsprechend 2,8 Sekunden bei normaler Geschwindigkeit. Das gilt
  auch für Bot- und Korrekturangriffe.
- Beginne die Pause beim Anfordern des Angriffs und erneut bei seiner
  Bestätigung. Ein bestätigter manueller Landangriff startet ebenfalls die
  Pause für automatische Aktionen. Versende keine doppelte Anfrage, solange
  eine Bestätigung noch aussteht; eine Wiederholung nach Zeitablauf muss den
  Cooldown weiterhin einhalten.
- Setze den Cooldown beim Aus- und Einschalten von ECO nicht zurück. Zeige die
  verbleibende Zeit am ECO-Knopf an.
- Beende die Eröffnungsplanung ab Tick 600. Danach gelten die gesonderten Regeln
  für dichteabhängige Expansion und bezahlbare Botangriffe, mit demselben Cooldown.
- Gib automatische Botangriffe erst frei, wenn kein direkt erreichbares freies
  Land und kein laufender neutraler Angriff mehr vorhanden sind. Diese Priorität
  bleibt auch nach Tick 600 bestehen: Ein zu kleines Truppenbudget oder das
  Warten auf Einkommen ist kein Anlass, ersatzweise einen Bot anzugreifen.
  Erschließt eine Boteroberung neues freies Land, gib diesem wieder Vorrang.
  Freies Land ohne Verbindung zur eigenen Grenze blockiert die Botfreigabe
  nicht. Lasse manuelle Gegnerangriffe weiterhin zu.

## Referenz zur Plausibilitätsprüfung

Auf einer offenen Karte ohne Gegner, mit 512 Starttruppen, zwölf Feldern,
50-%-Slider und Standardeinkommen ergibt die Berechnung folgende Folge:

| Spielzeit | Sendeanteil | Entsandte Truppen |
| --- | ---: | ---: |
| 4,48 s | 16,70 % | 144 |
| 10,08 s | 15,33 % | 229 |
| 15,12 s | 21,78 % | 537 |
| 20,16 s | 32,91 % | 1.273 |
| 25,76 s | 39,16 % | 2.330 |
| 30,80 s | 49,32 % | 4.242 |

Verwende diese Folge nur als Referenz, nicht als feste Vorschrift für andere
Karten. Im Modell entstehen nach 33,6 Sekunden 4.128 Felder und 9.806 Truppen
bei sechs Angriffen. Gegnerzüge, wechselnde Latenz und andere Einkommenseinstellungen
können das Ergebnis verändern. Stelle Modellgewinne nicht als gemessene
Multiplayer-Siegrate dar.

## Quellen und Umsetzung bei Bedarf

Das [offizielle Tutorial](https://territorial.io/tutorial), Abschnitte 4 und 5,
begründet die Dichteschwellen und die Gebühr pro Landangriff. Die
[Community-Übersicht der Eröffnungen](https://territorial.fandom.com/wiki/Openings)
beschreibt das Timing vor Gebietseinnahmen und die Abwägung von Fläche und
Bestand. Beide Quellen wurden für die gespeicherte Strategie am 05.09.2026
herangezogen. Prüfe Mechanik und Zeitwerte neu, wenn du sie auf eine andere
Spielversion überträgst.

Im FXclient-Projekt stehen die genaue Berechnung in `src/openingStrategy.js`,
Aktivierung und Ablauf in `patches/patches.js`, `patches/autoExpand.js` und
`src/autoExpand.js`, die Herleitung in `docs/auto-expand-opening.md`.
Für einen reproduzierbaren Vergleich dient `node scripts/benchmarkAutoExpand.js`.
Diese Dateien sind ergänzende Hilfen; die Entscheidungsregeln dieser Skill
lassen sich auch ohne das Projekt lesen und übertragen.
