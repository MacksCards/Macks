// Andockstelle für weitere Bild-Ebenen (z. B. „Bewohner“ und „Felder“ aus dem Paket G3b).
// Eine Ebene meldet sich mit View.addLayer(ebene) an; die Darstellung ruft sie dann an festen Stellen auf,
// ohne sie im Einzelnen zu kennen:
//   setGame – beim Aufbau der Welt (Start, „Neues Spiel“, Laden), mit Höhenabfrage des Geländes
//   rebuild – wenn sich auf dem Land etwas geändert hat (Rechteck in Feldern; fehlt = alles)
//   update  – je gezeichnetem Bild: t = Uhrzeit in s, gameDt = Spielzeit seit dem letzten Bild (0 in der Pause),
//             cam = Blickpunkt und Abstand der Kamera (für „nur nahe der Kamera“)
// Regel: Signaturen später nur erweitern, nicht ändern.
import type * as THREE from 'three';
import type { Game } from '../game';
import type { TileRect } from './terrain';

export interface CameraSpot { x: number; z: number; dist: number }

export interface RenderLayer {
  /** alles, was die Ebene zeichnet (wird einmal in die Szene gehängt) */
  group: THREE.Object3D;
  setGame(g: Game, height: (x: number, z: number) => number): void;
  rebuild?(r?: TileRect): void;
  update(t: number, gameDt: number, cam: CameraSpot): void;
  dispose?(): void;
}
