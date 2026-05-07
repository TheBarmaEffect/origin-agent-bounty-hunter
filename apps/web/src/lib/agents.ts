import type { AgentId, Algorithm } from '../types';

export interface AgentMeta {
  id: AgentId;
  name: string;
  algorithm: Algorithm;
  shortAlg: string;
  color: string;
  colorBright: string;
  rgb: string;
  glowClass: string;
  tagline: string;
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  scout: {
    id: 'scout', name: 'SCOUT', algorithm: 'BFS', shortAlg: 'BFS',
    color: '#3B8BFF', colorBright: '#7BB0FF', rgb: '59,139,255',
    glowClass: 'glow-scout',
    tagline: 'Breadth-first explorer',
  },
  drill: {
    id: 'drill', name: 'DRILL', algorithm: 'DFS', shortAlg: 'DFS',
    color: '#9B6DFF', colorBright: '#BC95FF', rgb: '155,109,255',
    glowClass: 'glow-drill',
    tagline: 'Depth-first investigator',
  },
  compass: {
    id: 'compass', name: 'COMPASS', algorithm: 'A*', shortAlg: 'A*',
    color: '#FF6B00', colorBright: '#FF8C3D', rgb: '255,107,0',
    glowClass: 'glow-compass',
    tagline: 'Heuristic-guided navigator',
  },
  dice: {
    id: 'dice', name: 'DICE', algorithm: 'Monte Carlo', shortAlg: 'MC',
    color: '#FFB830', colorBright: '#FFD060', rgb: '255,184,48',
    glowClass: 'glow-dice',
    tagline: 'Probabilistic sampler',
  },
  dash: {
    id: 'dash', name: 'DASH', algorithm: 'Greedy', shortAlg: 'GRD',
    color: '#22C55E', colorBright: '#4ADE80', rgb: '34,197,94',
    glowClass: 'glow-dash',
    tagline: 'Greedy first-mover',
  },
};

export const AGENT_ORDER: AgentId[] = ['scout', 'drill', 'compass', 'dice', 'dash'];
