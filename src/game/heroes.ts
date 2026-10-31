// Who you can be. Pick a hero at the start (that hero's tree only, ultimate from level 30), or stay a 散人:
// every house's three basic moves, capped at level 5, no ultimate; at level 30 a 散人 may 转职 into a hero.
import type { SectId } from './types';

export type HeroId = 'Berserker' | 'Ranger' | 'BuddhistMage' | 'Shadowblade' | 'Emperor' | 'Trader' | 'HeavyHealer';

export interface Hero {
  id: HeroId;
  house: SectId;
  name: string;
  title: string;
  model: string;
  portrait: string;
  color: string;
  ranged: boolean; // basic attack is a throw
  /** three basic, one advanced (from level 10), the ultimate (from level 30, hold R) */
  tree: [string, string, string, string, string];
  blurb: string;
}

export const HEROES: Hero[] = [
  { id: 'Berserker', house: 'kuangren', name: '霍岩', title: '狂刃', model: 'berserker.glb', portrait: 'berserker.png', color: '#e0452b', ranged: false, tree: ['earth_cleave', 'whirlwind_blade', 'bull_charge', 'blood_rage', 'heaven_collapse'], blurb: '近身硬拼，越打越凶。' },
  { id: 'Ranger', house: 'anqi', name: '沈惊鸿', title: '暗器', model: 'ranger.glb', portrait: 'ranger.png', color: '#2dd4bf', ranged: true, tree: ['boomerang', 'pin_dart', 'swallow_flip', 'snipe', 'rain_of_darts'], blurb: '远远放镖，近了就跑。' },
  { id: 'BuddhistMage', house: 'fanyin', name: '了尘', title: '梵音', model: 'monk.glb', portrait: 'monk.png', color: '#f5b942', ranged: false, tree: ['vajra_palm', 'zen_domain', 'six_syllable_mantra', 'golden_bell_shield', 'ten_thousand_buddhas'], blurb: '掌力浑厚，金身难破。' },
  { id: 'Shadowblade', house: 'yingren', name: '夜无痕', title: '影刃', model: 'shadowblade.glb', portrait: 'shadowblade.png', color: '#a78bfa', ranged: false, tree: ['shadow_step', 'fan_knives', 'burrow', 'chain_hook', 'thousand_shadows'], blurb: '来无影去无踪，一击暴击。' },
  { id: 'Emperor', house: 'tianzi', name: '天子', title: '天子', model: 'emperor.glb', portrait: 'emperor.png', color: '#ffd36a', ranged: false, tree: ['edict', 'phantom_guard', 'jade_seal', 'palace_cage', 'true_dragon'], blurb: '圣旨一下，跪着挨打。' },
  { id: 'Trader', house: 'jiaoyi', name: '陈百万', title: '交易员', model: 'trader.glb', portrait: 'trader.png', color: '#4ade80', ranged: false, tree: ['rolex_throw', 'make_it_rain', 'patagonia', 'short_sell', 'black_monday'], blurb: '钱能解决的都不是问题。' },
  { id: 'HeavyHealer', house: 'dixian', name: '青囊翁', title: '地仙', model: 'dixian.glb', portrait: 'dixian.png', color: '#86efac', ranged: false, tree: ['qingfeng', 'drain_surplus', 'earth_spring', 'fold_earth', 'mortal_realm'], blurb: '能救自己，也能抽干你。' },
];
export const heroOf = (id: HeroId | null | undefined) => HEROES.find((h) => h.id === id);

export const TRANSFER_LEVEL = 30;
export const ULT_LEVEL = 30;
export const HIGH_LEVEL = 10;
/** 散人's moves: every house's first three */
export const LOW_SKILLS = HEROES.flatMap((h) => h.tree.slice(0, 3));
export const WANDERER = { name: '散人', model: 'wanderer_m.glb', portrait: 'wanderer_m.png' };
