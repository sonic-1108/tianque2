// The houses (天阙's seven and the eleven added) as the skill tree knows them: who each move came from, a colour and a portrait.
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
  // the eleven added houses
  { id: 'jianke', name: '剑客', portrait: 'hero-jianke.png', color: '#7dd3fc', skills: ['cloud_thrust', 'sword_qi', 'willow_parry'] },
  { id: 'qiangwang', name: '枪王', portrait: 'hero-qiangwang.png', color: '#f87171', skills: ['dragon_thrust', 'sweep_army', 'lift_spear'] },
  { id: 'quanshi', name: '拳师', portrait: 'hero-quanshi.png', color: '#fb923c', skills: ['chain_punch', 'crushing_fist', 'grapple_throw'] },
  { id: 'fushi', name: '符师', portrait: 'hero-fushi.png', color: '#facc15', skills: ['seal_talisman', 'thunder_talisman', 'paper_double'] },
  { id: 'qinshi', name: '琴师', portrait: 'hero-qinshi.png', color: '#c4b5fd', skills: ['note_gong', 'string_blade', 'calm_song'] },
  { id: 'yushou', name: '御兽师', portrait: 'hero-yushou.png', color: '#a3e635', skills: ['wolf_call', 'hawk_dive', 'bone_strike'] },
  { id: 'duzong', name: '毒宗', portrait: 'hero-duzong.png', color: '#84cc16', skills: ['viper_stab', 'poison_fog', 'gu_swarm'] },
  { id: 'gongshou', name: '弓手', portrait: 'hero-gongshou.png', color: '#e2b67c', skills: ['piercing_arrow', 'triple_shot', 'retreat_shot'] },
  { id: 'shuangdao', name: '双刀客', portrait: 'hero-shuangdao.png', color: '#f43f5e', skills: ['twin_dragon', 'blade_dance', 'turn_slash'] },
  { id: 'qizong', name: '气宗', portrait: 'hero-qizong.png', color: '#bae6fd', skills: ['qi_bolt', 'qi_wave', 'levitate'] },
  { id: 'jiguan', name: '机关师', portrait: 'hero-jiguan.png', color: '#d6a35c', skills: ['repeater', 'puppet', 'land_mine'] },
];
export const houseOf = (id: SectId | null | undefined) => HOUSES.find((h) => h.id === id);
