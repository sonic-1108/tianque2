// Who you can be. Pick a hero at the start (that hero's tree only, ultimate from level 30), or stay a 散人:
// every house's three basic moves, capped at level 5, no ultimate; at level 30 a 散人 may 转职 into a hero.
import type { SectId } from './types';

export type HeroId =
  | 'Berserker' | 'Ranger' | 'BuddhistMage' | 'Shadowblade' | 'Emperor' | 'Trader' | 'HeavyHealer'
  | 'Jianke' | 'Qiangwang' | 'Quanshi' | 'Fushi' | 'Qinshi' | 'Yushou' | 'Duzong' | 'Gongshou' | 'Shuangdao' | 'Qizong' | 'Jiguan';

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
  /** five more, opened at MORE_LEVELS (the owner: a house needs many moves) */
  more: [string, string, string, string, string];
  blurb: string;
  /** one of the eleven houses added later (not of 天阙's seven) */
  added?: boolean;
}

export const HEROES: Hero[] = [
  { id: 'Berserker', house: 'kuangren', name: '霍岩', title: '狂刃', model: 'berserker.glb', portrait: 'berserker.png', color: '#e0452b', ranged: false, tree: ['earth_cleave', 'whirlwind_blade', 'bull_charge', 'blood_rage', 'heaven_collapse'], more: ['sunder', 'battle_will', 'drag_slash', 'guillotine', 'boulder_toss'], blurb: '近身硬拼，越打越凶。' },
  { id: 'Ranger', house: 'anqi', name: '沈惊鸿', title: '暗器', model: 'ranger.glb', portrait: 'ranger.png', color: '#2dd4bf', ranged: true, tree: ['boomerang', 'pin_dart', 'swallow_flip', 'snipe', 'rain_of_darts'], more: ['caltrops', 'sleeve_burst', 'smoke_bomb', 'split_dart', 'seven_stars'], blurb: '远远放镖，近了就跑。' },
  { id: 'BuddhistMage', house: 'fanyin', name: '了尘', title: '梵音', model: 'monk.glb', portrait: 'monk.png', color: '#f5b942', ranged: false, tree: ['vajra_palm', 'zen_domain', 'six_syllable_mantra', 'golden_bell_shield', 'ten_thousand_buddhas'], more: ['lion_roar', 'flower_finger', 'great_mercy', 'dharma_step', 'buddha_light'], blurb: '掌力浑厚，金身难破。' },
  { id: 'Shadowblade', house: 'yingren', name: '夜无痕', title: '影刃', model: 'shadowblade.glb', portrait: 'shadowblade.png', color: '#a78bfa', ranged: false, tree: ['shadow_step', 'fan_knives', 'burrow', 'chain_hook', 'thousand_shadows'], more: ['decoy', 'backstab', 'shadow_bind', 'nightfall', 'shadow_seed'], blurb: '来无影去无踪，一击暴击。' },
  { id: 'Emperor', house: 'tianzi', name: '天子', title: '天子', model: 'emperor.glb', portrait: 'emperor.png', color: '#ffd36a', ranged: false, tree: ['edict', 'phantom_guard', 'jade_seal', 'palace_cage', 'true_dragon'], more: ['enfeoff', 'execute_order', 'royal_charge', 'pardon', 'tribute'], blurb: '圣旨一下，跪着挨打。' },
  { id: 'Trader', house: 'jiaoyi', name: '陈百万', title: '交易员', model: 'trader.glb', portrait: 'trader.png', color: '#4ade80', ranged: false, tree: ['rolex_throw', 'make_it_rain', 'patagonia', 'short_sell', 'black_monday'], more: ['leverage', 'halt_trading', 'cash_out', 'harvest', 'bear_market'], blurb: '钱能解决的都不是问题。' },
  { id: 'HeavyHealer', house: 'dixian', name: '青囊翁', title: '地仙', model: 'dixian.glb', portrait: 'dixian.png', color: '#86efac', ranged: false, tree: ['qingfeng', 'drain_surplus', 'earth_spring', 'fold_earth', 'mortal_realm'], more: ['vine_bind', 'rockfall', 'earthquake', 'element_swap', 'lingzhi'], blurb: '能救自己，也能抽干你。' },
  // ---- the eleven added houses (bodies by Tripo, clips borrowed: Rig BODY_AS)
  { id: 'Jianke', house: 'jianke', name: '白羽', title: '剑客', model: 'hero-jianke.glb', portrait: 'hero-jianke.png', color: '#7dd3fc', ranged: false, added: true, tree: ['cloud_thrust', 'sword_qi', 'willow_parry', 'flying_sword', 'ten_thousand_swords'], more: ['throat_seal', 'snow_step', 'sword_array', 'iaido', 'heart_sword'], blurb: '剑走轻灵，以快打快，还能拂开来招。' },
  { id: 'Qiangwang', house: 'qiangwang', name: '赵擎', title: '枪王', model: 'hero-qiangwang.glb', portrait: 'hero-qiangwang.png', color: '#f87171', ranged: false, added: true, tree: ['dragon_thrust', 'sweep_army', 'lift_spear', 'hundred_birds', 'overlord_spear'], more: ['turn_back_spear', 'spear_forest', 'pole_vault', 'snow_twirl', 'mountain_plant'], blurb: '一寸长一寸强，挑飞了再接着打。' },
  { id: 'Quanshi', house: 'quanshi', name: '雷鸣', title: '拳师', model: 'hero-quanshi.glb', portrait: 'hero-quanshi.png', color: '#fb923c', ranged: false, added: true, tree: ['chain_punch', 'crushing_fist', 'grapple_throw', 'whirl_kick', 'hundred_crack'], more: ['stomp', 'taiji_absorb', 'inch_punch', 'tiger_pounce', 'drunken_fist'], blurb: '贴身就是他的天下，抓住了就摔。' },
  { id: 'Fushi', house: 'fushi', name: '玄青', title: '符师', model: 'hero-fushi.glb', portrait: 'hero-fushi.png', color: '#facc15', ranged: true, added: true, tree: ['seal_talisman', 'thunder_talisman', 'paper_double', 'bagua_array', 'five_thunders'], more: ['chain_lightning', 'fire_talisman', 'talisman_wall', 'exorcise', 'soul_bell'], blurb: '贴符引雷，布阵困人。' },
  { id: 'Qinshi', house: 'qinshi', name: '苏婉', title: '琴师', model: 'hero-qinshi.glb', portrait: 'hero-qinshi.png', color: '#c4b5fd', ranged: true, added: true, tree: ['note_gong', 'string_blade', 'calm_song', 'mountain_water', 'guangling'], more: ['ambush_tune', 'soul_charm', 'three_folds', 'broken_string', 'lullaby'], blurb: '琴音伤人于无形，一曲也能救人。' },
  { id: 'Yushou', house: 'yushou', name: '阿岚', title: '御兽师', model: 'hero-yushou.glb', portrait: 'hero-yushou.png', color: '#a3e635', ranged: false, added: true, tree: ['wolf_call', 'hawk_dive', 'bone_strike', 'wolf_pack', 'stampede'], more: ['wild_instinct', 'rend', 'bear_might', 'hawk_eye', 'deer_blessing'], blurb: '狼群和海东青替她打头阵。' },
  { id: 'Duzong', house: 'duzong', name: '蓝蝶', title: '毒宗', model: 'hero-duzong.glb', portrait: 'hero-duzong.png', color: '#84cc16', ranged: false, added: true, tree: ['viper_stab', 'poison_fog', 'gu_swarm', 'venom_burst', 'five_venoms'], more: ['butterfly_step', 'antidote', 'soul_gu', 'toxic_blood', 'bone_rot'], blurb: '毒先下，再催发，一口气要命。' },
  { id: 'Gongshou', house: 'gongshou', name: '穆远', title: '弓手', model: 'hero-gongshou.glb', portrait: 'hero-gongshou.png', color: '#e2b67c', ranged: true, added: true, tree: ['piercing_arrow', 'triple_shot', 'retreat_shot', 'full_draw', 'sunset_arrow'], more: ['scatter_shot', 'explosive_arrow', 'focus', 'snare_arrow', 'whistle_arrow'], blurb: '拉满弓的一箭，能把人钉在墙上。' },
  { id: 'Shuangdao', house: 'shuangdao', name: '燕歌', title: '双刀客', model: 'hero-shuangdao.glb', portrait: 'hero-shuangdao.png', color: '#f43f5e', ranged: false, added: true, tree: ['twin_dragon', 'blade_dance', 'turn_slash', 'bleed_edge', 'asura_prison'], more: ['gale_blade', 'pommel_bash', 'iron_cutter', 'gust_step', 'sheathe_draw'], blurb: '两把刀从不停，越打对面流的血越多。' },
  { id: 'Qizong', house: 'qizong', name: '云鹤', title: '气宗', model: 'hero-qizong.glb', portrait: 'hero-qizong.png', color: '#bae6fd', ranged: true, added: true, tree: ['qi_bolt', 'qi_wave', 'levitate', 'qi_beam', 'heaven_earth'], more: ['qi_barrier', 'remote_point', 'star_absorb', 'qi_vortex', 'circulation'], blurb: '真气外放，隔空伤人，还能凌空而立。' },
  { id: 'Jiguan', house: 'jiguan', name: '墨衡', title: '机关师', model: 'hero-jiguan.glb', portrait: 'hero-jiguan.png', color: '#d6a35c', ranged: true, added: true, tree: ['repeater', 'puppet', 'land_mine', 'turret', 'kite_bombing'], more: ['grapple_line', 'thunder_bomb', 'gear_shield', 'repair', 'overload'], blurb: '木人、弩塔、地雷，人还没到，机关先到。' },
];
export const heroOf = (id: HeroId | null | undefined) => HEROES.find((h) => h.id === id);

export const TRANSFER_LEVEL = 30;
export const ULT_LEVEL = 30;
export const HIGH_LEVEL = 10;
/** the levels the five later moves open at */
export const MORE_LEVELS = [3, 6, 14, 18, 24];
/** 散人's moves: every house's first three */
export const LOW_SKILLS = HEROES.flatMap((h) => h.tree.slice(0, 3));
export const WANDERER = { name: '散人', model: 'wanderer_m.glb', portrait: 'wanderer_m.png' };
