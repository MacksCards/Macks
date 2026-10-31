// Endwertung: Punkte, Spielziele, Sieg.
// GERÜST: Die Schnittstelle steht fest, Punkte gibt es noch nicht (kommt mit dem Paket S5).
// Es gibt vorerst nur das Endlosspiel.
import { HUMAN, type Game } from './game';
import type { GameSystem } from './systems';

/** ein Spielziel (wählbar beim Spielstart, gespeichert in Game.opts.ziel) */
export interface Goal {
  id: string;
  name: string;
  desc: string;
  /** erreicht? (fehlt = nie, z. B. beim Endlosspiel) */
  done?(g: Game, owner: number): boolean;
}

export const GOALS: Goal[] = [
  { id: 'endlos', name: 'Endlos', desc: 'Ohne festes Ziel – baue und erobere, so lange du willst.' },
];

/** Punkte eines Spielers mit Aufschlüsselung */
export interface ScoreSheet {
  total: number;
  parts: { name: string; points: number }[];
}

/** Punktestand eines Spielers (Gerüst: noch 0) */
export function score(_g: Game, _owner = HUMAN): ScoreSheet {
  return { total: 0, parts: [] };
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'score',
};
