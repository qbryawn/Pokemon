# Kartenarchiv

Kartenarchiv ist eine kostenlose, offlinefähige Progressive Web App zur privaten Verwaltung einer Pokémon-Kartensammlung. Sie läuft vollständig im Browser und benötigt weder Konto noch Server.

## Funktionen

- Karten per Kamera oder Bilddatei hinzufügen
- kostenloser, clientseitiger Karten-Zuschnitt (Canvas und lokale Kantenerkennung)
- Kartennummer, Name, Set, Sprache, Zustand, Kaufpreis und Notizen
- getrennte Werte für ungraded und graded Karten
- Grading-Anbieter, Note und Zertifikatsnummer
- Bearbeiten, Löschen, Favoriten und automatische Duplikaterkennung
- Suche, Sortierung sowie Raster- und Listenansicht
- lokale Speicherung in IndexedDB
- vollständiger JSON-Export und -Import inklusive Bilder
- responsive, installierbare PWA mit Offline-Modus

## Lokal starten

Die App hat keine externen Abhängigkeiten. Wegen IndexedDB und Service Worker sollte sie über einen lokalen Webserver und nicht direkt als `file://` geöffnet werden.

### Mit Python (macOS, Linux oder Windows)

```bash
cd pokemon-karten-app
python3 -m http.server 4173
```

Danach im Browser öffnen: <http://localhost:4173>

### Tests

Node.js 18 oder neuer wird nur für die automatischen Tests benötigt:

```bash
npm test
npm run check
```

## Installation als App

- **iPhone/iPad:** in Safari öffnen → Teilen → „Zum Home-Bildschirm“
- **Android/Desktop:** im Browser „App installieren“ wählen

Die Sammlung wird pro Browser und Gerät gespeichert. Regelmäßige Exporte über **Backup & Import** werden empfohlen.

## GitHub-Repository

Dieses Projekt ist für das Repository <https://github.com/qbryawn/Pokemon> vorbereitet. Nach aktivierten GitHub Pages ist die App unter folgender Adresse erreichbar:

<https://qbryawn.github.io/Pokemon/>

## GitHub veröffentlichen

```bash
git init
git add .
git commit -m "Initiale Version der Kartenarchiv-PWA"
git branch -M main
git remote add origin https://github.com/qbryawn/Pokemon.git
git push -u origin main
```

Die App kann anschließend kostenlos über GitHub Pages veröffentlicht werden: Repository → **Settings** → **Pages** → Branch `main`, Ordner `/ (root)`.

## Datenschutz

Alle Kartendaten und Bilder bleiben standardmäßig im lokalen Browser. Die App lädt keine Bilder hoch und verwendet keine Analyse- oder Trackingdienste.

## Rechtlicher Hinweis

Dies ist ein inoffizielles Fan-Projekt. Pokémon und die zugehörigen Namen/Marken gehören ihren jeweiligen Rechteinhabern. Es werden keine offiziellen Kartenbilder oder Marken-Assets mitgeliefert.

## Lizenz

MIT
