// The seven houses only as the skill tree knows them: who each move came from, a colour and a portrait.
// There are no houses on the map: the 散人 learns every move from his own skill points.
import type { SectId } from './types';

export interface House {
  id: SectId;
  name: string;
  portrait: string;
  color: string;
  skills: [string, string, string];
}

export const HOUSES: House[] = [
  { id: 'kuangren', name: '狂刃', portrait: 'berserker.png', color: '#e0452b', skills: ['earth_cleave', 'whirlwind_blade', 'bull_charge'] },
  { id: 'anqi', name: '暗器', portrait: 'ranger.png', color: '#2dd4bf', skills: ['boomerang', 'pin_dart', 'swallow_flip'] },
  { id: 'fanyin', name: '梵音', portrait: 'monk.png', color: '#f5b942', skills: ['vajra_palm', 'zen_domain', 'six_syllable_mantra'] },
  { id: 'yingren', name: '影刃', portrait: 'shadowblade.png', color: '#a78bfa', skills: ['shadow_step', 'fan_knives', 'burrow'] },
  { id: 'tianzi', name: '天子', portrait: 'emperor.png', color: '#ffd36a', skills: ['edict', 'phantom_guard', 'jade_seal'] },
  { id: 'jiaoyi', name: '交易员', portrait: 'trader.png', color: '#4ade80', skills: ['rolex_throw', 'make_it_rain', 'patagonia'] },
  { id: 'dixian', name: '地仙', portrait: 'dixian.png', color: '#86efac', skills: ['qingfeng', 'drain_surplus', 'earth_spring'] },
];
export const houseOf = (id: SectId | null | undefined) => HOUSES.find((h) => h.id === id);
