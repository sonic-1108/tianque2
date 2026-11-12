// The second book of moves (owner: more moves for every house, eleven new houses, none of it a copy). Each house
// below has its own way of fighting; the old seven get five moves each that their first five didn't have, the new
// eleven ten each. All run on kit.ts. Animation keys: the old houses use their own (kr_ aq_ fy_ yr_ tz_ jy_ dx_), the
// new ones the shared skill_* keys of the house whose clips their bodies borrow.
import { defineMove, houseColor, type MoveSpec } from './kit';

const M = (m: MoveSpec) => defineMove(m);

// ------------------------------------------------------------------ the new houses' colours (yours, theirs)
houseColor('kuangren', '#ff4a1c', '#3fa9ff');
houseColor('anqi', '#2dd4bf', '#a78bfa');
houseColor('fanyin', '#f6c453', '#93c5fd');
houseColor('yingren', '#22d3ee', '#c084fc');
houseColor('tianzi', '#ffd36a', '#ffd36a');
houseColor('jiaoyi', '#9be37a', '#9be37a');
houseColor('dixian', '#86efac', '#86efac');
houseColor('jianke', '#bfe8ff', '#93c5fd');
houseColor('qiangwang', '#f87171', '#fb7185');
houseColor('quanshi', '#fb923c', '#fdba74');
houseColor('fushi', '#facc15', '#fde047');
houseColor('qinshi', '#c4b5fd', '#ddd6fe');
houseColor('yushou', '#a3e635', '#bef264');
houseColor('duzong', '#84cc16', '#a3e635');
houseColor('gongshou', '#e2b67c', '#f5d0a9');
houseColor('shuangdao', '#f43f5e', '#fb7185');
houseColor('qizong', '#e0f2fe', '#bae6fd');
houseColor('jiguan', '#d6a35c', '#e7c08a');

// ================================================================== 狂刃 (five more)
M({ id: 'sunder', name: '破甲重劈', house: 'kuangren', icon: '🪓', mp: 18, cd: 6, ai: 3.5, anim: 'kr_cleave', dur: 0.7, armor: true, sound: 'swingHeavy',
  desc: '双刃举过头顶狠劈，前方 3.2 米 190 伤害，打碎霸体，被劈中的人破甲 4 秒（攻击降低、受伤加重）。',
  steps: [{ at: 0.38, a: { k: 'hit', shape: 'cone', r: 3.2, cos: 0.4, dmg: 190, o: { heavy: true, crit: true, knock: 4 }, weak: 4, strip: true, fx: 'slam' } }] });
M({ id: 'battle_will', name: '战意', house: 'kuangren', icon: '🔥', mp: 15, cd: 16, ai: 5, anim: 'kr_roar', dur: 0.6,
  desc: '咬牙不退：霸体 4 秒，期间每秒回复 3% 生命。',
  steps: [{ at: 0.2, a: { k: 'self', armor: 4, regen: [0.03, 4], fx: 'fire' } }] });
M({ id: 'drag_slash', name: '拖刀斩', house: 'kuangren', icon: '⚔️', mp: 22, cd: 8, ai: 9, ground: true, anim: 'kr_charge', dur: 0.75, armor: true,
  desc: '刀尖拖地冲出 8 米，火星一路，经过的每个敌人受 120 伤害，冲到头一刀挑起前方的人（160，击飞）。',
  move: { dash: [16, 0.5, 1.8, 120, { knock: 5, launch: 2 }] },
  steps: [{ at: 0.52, a: { k: 'hit', shape: 'cone', r: 3, dmg: 160, o: { launch: 9, heavy: true }, fx: 'slash' } }] });
M({ id: 'guillotine', name: '断头台', house: 'kuangren', icon: '💀', mp: 25, cd: 10, ai: 3, anim: 'kr_cleave', dur: 0.75, armor: true, sound: 'swingHeavy',
  desc: '处决一刀：前方 2.6 米 120 伤害，对生命低于三成的人伤害变成三倍。',
  steps: [{ at: 0.42, a: { k: 'hit', shape: 'cone', r: 2.6, cos: 0.5, dmg: 120, o: { heavy: true, crit: true }, exec: true, fx: 'blood' } }] });
M({ id: 'boulder_toss', name: '碎石', house: 'kuangren', icon: '🪨', mp: 20, cd: 7, ai: 14, anim: 'kr_roar', dur: 0.8, armor: true,
  desc: '从地里掀起一块大石砸出去（飞 18 米），砸中 160 伤害，石块碎开再波及 3 米内的人（100）。',
  steps: [{ at: 0.1, a: { k: 'hit', shape: 'circle', r: 0.1, dmg: 0, fx: 'earth' } }, { at: 0.5, a: { k: 'shot', look: 'rock', speed: 22, life: 0.85, dmg: 160, shape: 'glyph', radius: 0.9, knock: 8, splash: [3, 100], color: '#a8a29e' } }] });

// ================================================================== 暗器
M({ id: 'caltrops', name: '铁蒺藜', house: 'anqi', icon: '✳️', mp: 16, cd: 9, ai: 8, anim: 'aq_pin', dur: 0.45,
  desc: '往前方 5 米撒一把铁蒺藜（半径 2.8 米，存 10 秒）：头一个踩上的人被扎住 1.2 秒，受 90 伤害，蒺藜就踩没了。',
  steps: [{ at: 0.2, a: { k: 'zone', at: 'ahead', d: 5, r: 2.8, t: 10, rootOnce: 1.2, dmg: 90, once: true, fx: 'earth', color: '#9ca3af' } }] });
M({ id: 'sleeve_burst', name: '袖箭连发', house: 'anqi', icon: '🎯', mp: 18, cd: 6, ai: 15, anim: 'aq_shot', dur: 0.7,
  desc: '袖中机括连响，六支袖箭一支接一支追向对手，每支 40。',
  steps: [{ at: 0.1, a: { k: 'shot', n: 6, seq: 0.08, speed: 30, life: 0.8, dmg: 40, shape: 'pin', homing: 4, radius: 0.4 } }] });
M({ id: 'smoke_bomb', name: '烟遁', house: 'anqi', icon: '💨', mp: 20, cd: 14, ai: 3, anim: 'aq_flip', dur: 0.35,
  desc: '脚下摔开烟弹：半径 3.5 米的浓烟 4 秒，冲进烟里的敌人发懵 1.5 秒；你短暂无敌，跑速加三成 3 秒。',
  steps: [{ at: 0.05, a: { k: 'zone', r: 3.5, t: 4, dazeOnce: 1.5, fx: 'shadow', color: '#9ca3af', every: 0.6 } }, { at: 0.06, a: { k: 'self', invuln: 0.5, speed: [1.3, 3] } }] });
M({ id: 'split_dart', name: '子母镖', house: 'anqi', icon: '✴️', mp: 18, cd: 7, ai: 14, anim: 'aq_pin', dur: 0.45,
  desc: '一枚大母镖（120），打中人时炸出六枚子镖四散飞开，每枚 54。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 26, life: 0.9, dmg: 120, shape: 'dart', radius: 0.55, split: 6 } }] });
M({ id: 'seven_stars', name: '七星镖', house: 'anqi', icon: '⭐', mp: 24, cd: 15, ai: 3, anim: 'aq_rain', dur: 0.5,
  desc: '七枚飞镖绕身旋转 6 秒，贴身的敌人每 0.3 秒挨一下（22）。',
  steps: [{ at: 0.2, a: { k: 'orbit', n: 7, r: 1.8, t: 6, dmg: 22, every: 0.3 } }] });

// ================================================================== 梵音
M({ id: 'lion_roar', name: '狮子吼', house: 'fanyin', icon: '🦁', mp: 22, cd: 10, ai: 6, anim: 'fy_chant', dur: 0.7,
  desc: '一声佛门狮子吼：前方 7 米扇形 110 伤害，震退，并让他们 1.5 秒出不了招。',
  steps: [{ at: 0.3, a: { k: 'hit', shape: 'cone', r: 7, cos: 0.45, dmg: 110, o: { knock: 10, silence: 1.5 }, fx: 'sound' } }] });
M({ id: 'flower_finger', name: '拈花指', house: 'fanyin', icon: '🌸', mp: 16, cd: 7, ai: 16, anim: 'fy_palm', dur: 0.45,
  desc: '拈花一弹，一道金光直取对手（160），点中定住 1.2 秒。',
  steps: [{ at: 0.18, a: { k: 'shot', look: 'orb', speed: 40, life: 0.6, dmg: 160, shape: 'glyph', radius: 0.45, stun: 1.2, color: '#ffe08a' } }] });
M({ id: 'great_mercy', name: '大慈悲', house: 'fanyin', icon: '🙏', mp: 30, cd: 18, ai: 6, anim: 'fy_chant', dur: 0.9,
  desc: '合十诵经：自己回复 25% 生命，8 米内的同伴回复 15%，并解去定身、减速、封印。',
  steps: [{ at: 0.4, a: { k: 'self', heal: 0.1, cleanse: true, fx: 'holy' } }, { at: 0.45, a: { k: 'allies', r: 8, heal: 0.15, cleanse: true } }] });
M({ id: 'dharma_step', name: '达摩踏江', house: 'fanyin', icon: '🪷', mp: 18, cd: 10, ai: 8, anim: 'skill_dash', dur: 0.6,
  desc: '一苇渡江般滑出 8 米，身后留下一串莲花印（存 6 秒），敌人踩上被定住 1 秒。',
  move: { dash: [14, 0.55] },
  steps: [0.1, 0.25, 0.4, 0.55].map((at) => ({ at, a: { k: 'zone' as const, r: 1.4, t: 6, rootOnce: 1, fx: 'holy' as const, color: '#fbcfe8' } })) });
M({ id: 'buddha_light', name: '佛光普照', house: 'fanyin', icon: '☀️', mp: 28, cd: 20, ai: 6, anim: 'fy_zen', dur: 0.8,
  desc: '脚下佛光铺开（半径 6 米，5 秒，跟着你走）：里面的敌人虚弱（打人轻、挨打重），同伴每秒回 2% 生命。',
  steps: [{ at: 0.3, a: { k: 'zone', r: 6, t: 5, follow: true, weak: true, heal: 0.02, every: 0.5, fx: 'holy', color: '#fde68a' } }] });

// ================================================================== 影刃
M({ id: 'decoy', name: '影分身', house: 'yingren', icon: '👥', mp: 20, cd: 12, ai: 4, anim: 'yr_step', dur: 0.3,
  desc: '原地留下一个影子，人往后闪 5 米；2 秒后影子炸开，3 米内 150 伤害。',
  steps: [{ at: 0.02, a: { k: 'delay', at: 'self', d: 0, r: 3, after: 2, dmg: 150, o: { heavy: true, launch: 4 }, fx: 'shadow' } }, { at: 0.05, a: { k: 'blink', to: 'back', d: 5 } }] });
M({ id: 'backstab', name: '背刺', house: 'yingren', icon: '🗡️', mp: 20, cd: 8, ai: 8, anim: 'yr_step', dur: 0.5,
  desc: '闪到 8 米内对手的背后，一刀 220，必定暴击。',
  steps: [{ at: 0.05, a: { k: 'blink', to: 'behind', d: 8 } }, { at: 0.2, a: { k: 'hit', shape: 'cone', r: 2.4, cos: 0.3, dmg: 220, o: { crit: true, heavy: true }, fx: 'slash' } }] });
M({ id: 'shadow_bind', name: '影缚', house: 'yingren', icon: '🕸️', mp: 18, cd: 9, ai: 13, anim: 'yr_knives', dur: 0.4,
  desc: '甩出一道影子缠住对手：90 伤害，定身 1.5 秒，吸走他 30 点内力。',
  steps: [{ at: 0.15, a: { k: 'shot', speed: 24, life: 0.75, dmg: 90, shape: 'knife', root: 1.5, mpDrain: 30, radius: 0.55, color: '#7c3aed' } }] });
M({ id: 'nightfall', name: '夜幕', house: 'yingren', icon: '🌑', mp: 26, cd: 22, ai: 5, anim: 'yr_ult', dur: 0.5,
  desc: '撒开一片夜色（半径 6 米，6 秒）：你在里面谁也看不见，敌人丢了你的踪迹；你跑快两成。',
  steps: [{ at: 0.2, a: { k: 'zone', r: 6, t: 6, hide: true, every: 0.4, fx: 'shadow', color: '#312e81' } }, { at: 0.22, a: { k: 'self', speed: [1.2, 6] } }] });
M({ id: 'shadow_seed', name: '影爆', house: 'yingren', icon: '💣', mp: 22, cd: 9, ai: 10, anim: 'yr_knives', dur: 0.35,
  desc: '在 10 米内的对手身上种下影种，2.5 秒后炸开：他和他身边 3 米的人受 220 伤害。',
  steps: [{ at: 0.15, a: { k: 'seed', r: 10, after: 2.5, dmg: 220 } }] });

// ================================================================== 天子
M({ id: 'enfeoff', name: '册封', house: 'tianzi', icon: '📜', mp: 25, cd: 18, ai: 6, anim: 'tz_edict', dur: 0.7,
  desc: '展开册封诏书：自己和 10 米内的同伴攻守提升一成，持续 8 秒。',
  steps: [{ at: 0.3, a: { k: 'allies', r: 10, buffAtk: 8, fx: 'gold' } }] });
M({ id: 'execute_order', name: '斩立决', house: 'tianzi', icon: '⚖️', mp: 28, cd: 12, ai: 12, anim: 'tz_seal', dur: 1.2, armor: true,
  desc: '朱笔一勾：前方 12 米一条红线，1 秒后行刑，线上的人 300 伤害。',
  steps: [{ at: 0.1, a: { k: 'zone', r: 0.9, t: 1.05, line: 12, every: 0.2, fx: 'fire', color: '#dc2626' } }, { at: 1.05, a: { k: 'hit', shape: 'line', r: 12, w: 1, dmg: 300, o: { heavy: true, crit: true, down: 0.8 }, fx: 'thrust' } }] });
M({ id: 'royal_charge', name: '御驾亲征', house: 'tianzi', icon: '🐎', mp: 26, cd: 10, ai: 12, ground: true, anim: 'tz_guard', dur: 0.85, armor: true,
  desc: '骑着金色龙驹虚影冲出 12 米，踏过的人受 130 伤害并被挑上天。',
  move: { dash: [17, 0.7, 2, 130, { launch: 8, knock: 4 }] },
  steps: [{ at: 0.05, a: { k: 'hit', shape: 'circle', r: 0.1, dmg: 0, fx: 'gold' } }] });
M({ id: 'pardon', name: '免死金牌', house: 'tianzi', icon: '🥇', mp: 30, cd: 40, ai: 3, anim: 'tz_edict', dur: 0.5,
  desc: '亮出免死金牌：10 秒内要是倒下，立刻以三成生命站起来（无敌 1.5 秒）。',
  steps: [{ at: 0.2, a: { k: 'self', cheat: 10, fx: 'gold' } }] });
M({ id: 'tribute', name: '万国来朝', house: 'tianzi', icon: '🌏', mp: 30, cd: 16, ai: 7, anim: 'tz_dragon', dur: 0.8,
  desc: '天下来朝：9 米内的敌人被拉到你面前，虚弱 3 秒。',
  steps: [{ at: 0.35, a: { k: 'pull', r: 9, power: 16 } }, { at: 0.4, a: { k: 'hit', shape: 'circle', r: 9, dmg: 40, o: { flinch: true }, weak: 3, fx: 'gold' } }] });

// ================================================================== 交易员
M({ id: 'leverage', name: '加杠杆', house: 'jiaoyi', icon: '📈', mp: 15, cd: 14, ai: 5, anim: 'jy_point', dur: 0.4,
  desc: '十倍杠杆：攻防提升一成 6 秒，下一击必定暴击。',
  steps: [{ at: 0.15, a: { k: 'self', buffAtk: 6, crit: true, fx: 'gold' } }] });
M({ id: 'halt_trading', name: '停牌', house: 'jiaoyi', icon: '⛔', mp: 22, cd: 12, ai: 12, anim: 'jy_point', dur: 0.45,
  desc: '对一个对手宣布停牌：一张红色公告飞出（60），打中的人定身又封招 2.5 秒。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 28, life: 0.7, dmg: 60, shape: 'watch', root: 2.5, silence: 2.5, radius: 0.55, color: '#ef4444' } }] });
M({ id: 'cash_out', name: '套现', house: 'jiaoyi', icon: '💵', mp: 0, cd: 15, ai: 3, anim: 'jy_cash', dur: 0.5,
  desc: '落袋为安：把一半内力变成三倍的生命回复。',
  steps: [{ at: 0.2, a: { k: 'self', mpToHp: 0.5, fx: 'gold' } }] });
M({ id: 'harvest', name: '割韭菜', house: 'jiaoyi', icon: '🌱', mp: 15, cd: 6, ai: 3.5, anim: 'jy_throw', dur: 0.55,
  desc: '公文箱横扫前方 4 米，140 伤害，每打中一个人回 12 点内力。',
  steps: [{ at: 0.28, a: { k: 'hit', shape: 'cone', r: 4, cos: 0.1, dmg: 140, o: { knock: 6 }, mpGain: 12, fx: 'slash' } }] });
M({ id: 'bear_market', name: '熊市', house: 'jiaoyi', icon: '📉', mp: 26, cd: 18, ai: 7, anim: 'jy_cash', dur: 0.6,
  desc: '行情一路向下：前方 4 米展开半径 6 米的绿色 K 线阵 6 秒，里面的敌人减速，每秒掉 8 点内力，每秒 30 伤害。',
  steps: [{ at: 0.25, a: { k: 'zone', at: 'ahead', d: 4, r: 6, t: 6, slow: 0.5, mpBurn: 8, every: 1, dmg: 30, fx: 'poison', color: '#16a34a' } }] });

// ================================================================== 地仙
M({ id: 'vine_bind', name: '藤缚', house: 'dixian', icon: '🌿', mp: 18, cd: 9, ai: 9, anim: 'dx_spring', dur: 0.6,
  desc: '杖头点地，前方 10 米一路钻出藤蔓：线上的人 80 伤害，被缠住 2 秒。',
  steps: [{ at: 0.3, a: { k: 'hit', shape: 'line', r: 10, w: 1.3, dmg: 80, o: { root: 2 }, fx: 'wood' } }, { at: 0.31, a: { k: 'zone', r: 1.3, t: 1.2, line: 10, every: 0.15, fx: 'wood', color: '#4d7c0f' } }] });
M({ id: 'rockfall', name: '落石', house: 'dixian', icon: '⛰️', mp: 24, cd: 10, ai: 12, anim: 'dx_fold', dur: 0.6,
  desc: '山上落下巨石：8 米外的对手脚下先现出阴影，0.9 秒后砸下（半径 3 米，200，打倒）。',
  steps: [{ at: 0.3, a: { k: 'delay', at: 'target', d: 8, r: 3, after: 0.9, dmg: 200, o: { heavy: true, down: 1 }, fx: 'slam' } }] });
M({ id: 'earthquake', name: '地龙翻身', house: 'dixian', icon: '🌋', mp: 30, cd: 16, ai: 5, anim: 'dx_ult', dur: 1.5, armor: true,
  desc: '地龙翻身：脚下连震三下，每下 7 米内 70 伤害并把人颠起来。',
  loop: [0.45, 0.2, 1.2, { k: 'hit', shape: 'circle', r: 7, dmg: 70, o: { launch: 4 }, fx: 'slam' }], steps: [] });
M({ id: 'element_swap', name: '五行遁', house: 'dixian', icon: '☯️', mp: 20, cd: 12, ai: 12, anim: 'dx_fold', dur: 0.35,
  desc: '借土遁和 12 米内的一个对手对调位置，换完他发懵 1 秒。',
  steps: [{ at: 0.1, a: { k: 'blink', to: 'swap', d: 12 } }, { at: 0.12, a: { k: 'hit', shape: 'circle', r: 1.5, at: 'self', dmg: 0 } }, { at: 0.13, a: { k: 'zone', at: 'self', r: 0.1, t: 0.01 } }] });
M({ id: 'lingzhi', name: '灵芝护脉', house: 'dixian', icon: '🍄', mp: 26, cd: 20, ai: 4, anim: 'dx_spring', dur: 0.6,
  desc: '吞下一株灵芝：8 秒里每秒回 3% 生命，细小的伤害碰不到你。',
  steps: [{ at: 0.25, a: { k: 'self', regen: [0.03, 8], immune: 8, fx: 'holy' } }] });

// ================================================================== 剑客 (jianke): quick and exact, sword breath, parry
M({ id: 'cloud_thrust', name: '流云剑', house: 'jianke', icon: '🌫️', mp: 14, cd: 4, ai: 5, anim: 'skill_dash', dur: 0.5,
  desc: '身随剑走，向前刺出 4 米：一线上的人都受 150 伤害。',
  move: { lunge: [14, 0.28] },
  steps: [{ at: 0.22, a: { k: 'hit', shape: 'line', r: 4.2, w: 1, dmg: 150, o: { knock: 4 }, fx: 'thrust' } }] });
M({ id: 'sword_qi', name: '剑气斩', house: 'jianke', icon: '🌙', mp: 16, cd: 5, ai: 14, anim: 'skill_slash', dur: 0.45,
  desc: '一剑挥出月牙剑气，穿过 16 米，一路上的人受 120 伤害并被推开。',
  steps: [{ at: 0.2, a: { k: 'shot', look: 'crescent', speed: 30, life: 0.55, dmg: 120, shape: 'knife', pierce: true, radius: 0.9, knock: 5 } }] });
M({ id: 'willow_parry', name: '回风拂柳', house: 'jianke', icon: '🍃', mp: 12, cd: 7, ai: 3, anim: 'skill_raise', dur: 0.8,
  desc: '横剑当胸 0.8 秒：这期间挨的第一下被拂开（不掉血），立刻反手一剑 200，打晕 1 秒。',
  steps: [{ at: 0, a: { k: 'self', parry: [0.8, 200] } }] });
M({ id: 'flying_sword', name: '御剑', house: 'jianke', icon: '🗡️', mp: 24, cd: 9, ai: 16, anim: 'skill_point', dur: 0.6,
  desc: '剑诀一引，三柄飞剑先后追向对手，每柄 100。',
  steps: [{ at: 0.25, a: { k: 'shot', n: 3, seq: 0.12, speed: 22, life: 1.2, dmg: 100, shape: 'knife', homing: 6, radius: 0.6, spread: 0.6 } }] });
M({ id: 'ten_thousand_swords', name: '万剑归宗', house: 'jianke', icon: '⚜️', mp: 50, cd: 24, ai: 8, ult: true, anim: 'skill_raise', dur: 2.4, armor: true,
  desc: '万剑归宗：前方 6 米半径 7 米的天上落下剑雨，2 秒里每 0.15 秒落一阵（每阵 45），最后一柄巨剑插地 300。',
  loop: [0.15, 0.3, 2.0, { k: 'hit', shape: 'circle', at: 'ahead', d: 6, r: 7, dmg: 45, o: { flinch: true }, fx: 'slash' }],
  steps: [{ at: 0.25, a: { k: 'zone', at: 'ahead', d: 6, r: 7, t: 2, every: 0.1, fx: 'slash', color: '#bfe8ff' } }, { at: 2.1, a: { k: 'delay', at: 'ahead', d: 6, r: 4, after: 0.15, dmg: 300, o: { heavy: true, crit: true, launch: 8 }, fx: 'lightning' } }] });
M({ id: 'throat_seal', name: '一剑封喉', house: 'jianke', icon: '🤐', mp: 16, cd: 8, ai: 3, anim: 'skill_slash', dur: 0.4,
  desc: '一剑点向咽喉：正前方 2.4 米 140 伤害，被点中的人 2 秒出不了招。',
  steps: [{ at: 0.18, a: { k: 'hit', shape: 'cone', r: 2.4, cos: 0.75, dmg: 140, o: { silence: 2, crit: true }, fx: 'thrust' } }] });
M({ id: 'snow_step', name: '踏雪无痕', house: 'jianke', icon: '❄️', mp: 12, cd: 6, ai: 6, anim: 'skill_flip', dur: 0.55,
  desc: '轻功一纵，向前飘出 7 米，起身那一刻刀剑不侵；落地处剑尖一点（3 米内 60）。',
  move: { leap: [7, 12] },
  steps: [{ at: 0.02, a: { k: 'self', invuln: 0.35 } }, { at: 9, a: { k: 'hit', shape: 'circle', r: 3, dmg: 60, o: { flinch: true }, fx: 'ice' } }] });
M({ id: 'sword_array', name: '剑阵', house: 'jianke', icon: '🔱', mp: 26, cd: 16, ai: 5, anim: 'skill_raise', dur: 0.6,
  desc: '以身为心布下剑阵（半径 4.5 米，7 秒）：谁跨过阵边，进出都挨一剑（90，减速）。',
  steps: [{ at: 0.25, a: { k: 'zone', r: 4.5, t: 7, edge: 90, every: 0.5, fx: 'ring', color: '#bfe8ff' } }] });
M({ id: 'iaido', name: '拔剑式', house: 'jianke', icon: '🎴', mp: 22, cd: 10, ai: 8, anim: 'skill_slash', dur: 0.4, charge: 0.6, armor: true,
  desc: '按剑凝神 0.6 秒，一瞬拔剑：前方 8 米一线 260 伤害，必定暴击。',
  steps: [{ at: 0.05, a: { k: 'hit', shape: 'line', r: 8, w: 1.1, dmg: 260, o: { crit: true, heavy: true, knock: 3 }, fx: 'thrust' } }, { at: 0.06, a: { k: 'blink', to: 'ahead', d: 6 } }] });
M({ id: 'heart_sword', name: '心剑', house: 'jianke', icon: '💠', mp: 20, cd: 18, ai: 4, anim: 'skill_raise', dur: 0.4,
  desc: '人剑合一 8 秒：每一下普攻都顺势放出一道剑气（45，穿透）。',
  steps: [{ at: 0.15, a: { k: 'self', qiBlade: 8, fx: 'qi' } }] });

// ================================================================== 枪王 (qiangwang): reach, sweeps, launches
M({ id: 'dragon_thrust', name: '毒龙出洞', house: 'qiangwang', icon: '🐉', mp: 14, cd: 4, ai: 5, anim: 'skill_dash', dur: 0.5,
  desc: '长枪直刺 5.5 米，一线上的人 160 伤害，推出去 6 米。',
  move: { lunge: [8, 0.2] },
  steps: [{ at: 0.24, a: { k: 'hit', shape: 'line', r: 5.5, w: 0.9, dmg: 160, o: { knock: 12 }, fx: 'thrust' } }] });
M({ id: 'sweep_army', name: '横扫千军', house: 'qiangwang', icon: '🌪️', mp: 18, cd: 6, ai: 4, anim: 'skill_spin', dur: 0.6,
  desc: '长枪抡圆一扫，身前大半圈 4.2 米 110 伤害，扫倒在地 0.8 秒。',
  steps: [{ at: 0.3, a: { k: 'hit', shape: 'cone', r: 4.2, cos: -0.5, dmg: 110, o: { down: 0.8, knock: 4 }, fx: 'wind' } }] });
M({ id: 'lift_spear', name: '挑枪', house: 'qiangwang', icon: '⤴️', mp: 14, cd: 5, ai: 3.5, anim: 'skill_slash', dur: 0.5,
  desc: '枪尖一挑，把前方 3.2 米的人挑上半空（120），可以趁他落地前再打。',
  steps: [{ at: 0.22, a: { k: 'hit', shape: 'cone', r: 3.2, cos: 0.5, dmg: 120, o: { launch: 11 }, fx: 'slash' } }] });
M({ id: 'hundred_birds', name: '百鸟朝凤', house: 'qiangwang', icon: '🕊️', mp: 26, cd: 10, ai: 4.5, anim: 'skill_dash', dur: 1.3, armor: true,
  desc: '枪出如百鸟：1.2 秒里朝前方 4.5 米连刺十二枪，每枪 26，可以慢慢走。',
  move: { walk: 0.3 },
  loop: [0.1, 0.05, 1.2, { k: 'hit', shape: 'cone', r: 4.5, cos: 0.6, dmg: 26, o: { flinch: true }, fx: 'thrust' }], steps: [] });
M({ id: 'overlord_spear', name: '霸王枪', house: 'qiangwang', icon: '🏯', mp: 50, cd: 22, ai: 7, ult: true, anim: 'skill_flip', dur: 1.6, armor: true,
  desc: '纵身而起，长枪自天而降钉进地里：6 米内 380 伤害并击飞，地上裂开三圈冲击波（每圈 60）。',
  move: { leap: [12, 7] },
  steps: [{ at: 9, a: { k: 'hit', shape: 'circle', r: 6, dmg: 380, o: { heavy: true, crit: true, launch: 10, breakArmor: true }, fx: 'slam' } }, { at: 9, a: { k: 'delay', at: 'self', d: 0, r: 8, after: 0.25, dmg: 60, fx: 'ring', n: 3 } }] });
M({ id: 'turn_back_spear', name: '回马枪', house: 'qiangwang', icon: '↩️', mp: 16, cd: 7, ai: 5, anim: 'skill_dash', dur: 0.7,
  desc: '佯败后撤 4 米，回身一枪刺出 6 米（200，必暴）。',
  move: { back: [9, 0.3] },
  steps: [{ at: 9, a: { k: 'hit', shape: 'line', r: 6, w: 1, dmg: 200, o: { crit: true, knock: 8 }, fx: 'thrust' } }] });
M({ id: 'spear_forest', name: '枪林', house: 'qiangwang', icon: '🌾', mp: 24, cd: 11, ai: 9, anim: 'skill_stomp', dur: 1.0,
  desc: '枪尾顿地，前方 9 米地下接连钻出三波枪尖，每波 70，定身 0.5 秒。',
  loop: [0.25, 0.2, 0.75, { k: 'hit', shape: 'line', r: 9, w: 1.4, dmg: 70, o: { root: 0.5, launch: 3 }, fx: 'earth' }], steps: [] });
M({ id: 'pole_vault', name: '撑杆跳', house: 'qiangwang', icon: '🤸', mp: 14, cd: 8, ai: 10, anim: 'skill_flip', dur: 0.8,
  desc: '长枪撑地一跃 9 米（能翻过矮墙），落地横扫 2.8 米（100）。',
  move: { leap: [10, 13] },
  steps: [{ at: 9, a: { k: 'hit', shape: 'circle', r: 2.8, dmg: 100, o: { knock: 6 }, fx: 'wind' } }] });
M({ id: 'snow_twirl', name: '雪花盖顶', house: 'qiangwang', icon: '❄️', mp: 20, cd: 12, ai: 4, anim: 'skill_spin', dur: 1.6, armor: true,
  desc: '长枪在头顶舞成一片雪花 1.5 秒：飞来的暗器、箭矢全被拨落，贴身的人每 0.25 秒挨一下（20）。',
  move: { walk: 0.35 },
  steps: [{ at: 0.05, a: { k: 'zone', r: 2.8, t: 1.5, follow: true, killProj: true, every: 0.25, dmg: 20, fx: 'wind', color: '#e5e7eb' } }] });
M({ id: 'mountain_plant', name: '镇岳', house: 'qiangwang', icon: '🗻', mp: 22, cd: 16, ai: 3, anim: 'skill_stomp', dur: 0.6,
  desc: '长枪顿地如山：霸体 4 秒，身边 3 米一圈枪风，敌人减速，每 0.5 秒 25 伤害。',
  steps: [{ at: 0.25, a: { k: 'self', armor: 4 } }, { at: 0.26, a: { k: 'zone', r: 3, t: 4, follow: true, slow: 0.5, every: 0.5, dmg: 25, fx: 'wind', color: '#fca5a5' } }] });

// ================================================================== 拳师 (quanshi): fists, grabs, close work
M({ id: 'chain_punch', name: '连环拳', house: 'quanshi', icon: '👊', mp: 12, cd: 4, ai: 2.5, anim: 'attack_2', dur: 0.75,
  desc: '贴身五连拳，每拳 34，最后一拳把人打出去。',
  loop: [0.12, 0.05, 0.53, { k: 'hit', shape: 'cone', r: 2.3, cos: 0.4, dmg: 34, o: { flinch: true }, fx: 'burst' }],
  steps: [{ at: 0.62, a: { k: 'hit', shape: 'cone', r: 2.4, cos: 0.4, dmg: 60, o: { knock: 10 }, fx: 'burst' } }] });
M({ id: 'crushing_fist', name: '崩拳', house: 'quanshi', icon: '💥', mp: 16, cd: 6, ai: 2.5, anim: 'skill_palm', dur: 0.6,
  desc: '半步崩拳：前冲一步，一拳 200，把人打飞 7 米。',
  move: { lunge: [10, 0.18] },
  steps: [{ at: 0.25, a: { k: 'hit', shape: 'cone', r: 2.5, cos: 0.55, dmg: 200, o: { heavy: true, knock: 18, launch: 3 }, fx: 'burst' } }] });
M({ id: 'grapple_throw', name: '擒拿', house: 'quanshi', icon: '🤼', mp: 14, cd: 7, ai: 2, anim: 'skill_raise', dur: 0.7,
  desc: '一把揪住身前 2.4 米的人，过肩摔到身后：160 伤害，倒地 1.2 秒。',
  steps: [{ at: 0.3, a: { k: 'grab', r: 2.4, dmg: 160 } }] });
M({ id: 'whirl_kick', name: '旋风腿', house: 'quanshi', icon: '🦶', mp: 20, cd: 8, ai: 5, anim: 'skill_flip', dur: 0.7,
  desc: '腾空旋身连踢，飞出 4 米：路上的人挨两腿（每腿 90），第二腿踢上天。',
  move: { leap: [6, 8] },
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'circle', r: 2.4, dmg: 90, o: { knock: 3 }, fx: 'wind' } }, { at: 9, a: { k: 'hit', shape: 'circle', r: 2.6, dmg: 90, o: { launch: 9 }, fx: 'burst' } }] });
M({ id: 'hundred_crack', name: '天罡百裂拳', house: 'quanshi', icon: '🌟', mp: 50, cd: 22, ai: 6, ult: true, anim: 'attack_2', dur: 2.2, armor: true,
  desc: '冲到 6 米内的对手面前，1.6 秒里打出二十拳（每拳 18），最后一拳 260 打上天。',
  steps: [{ at: 0.02, a: { k: 'rush', r: 6 } }, { at: 1.85, a: { k: 'hit', shape: 'cone', r: 2.6, cos: 0.3, dmg: 260, o: { heavy: true, crit: true, launch: 12, breakArmor: true }, fx: 'burst' } }],
  loop: [0.08, 0.15, 1.75, { k: 'hit', shape: 'cone', r: 2.4, cos: 0.3, dmg: 18, o: { flinch: true }, fx: 'burst' }] });
M({ id: 'stomp', name: '震脚', house: 'quanshi', icon: '🦵', mp: 14, cd: 6, ai: 3, anim: 'skill_stomp', dur: 0.5,
  desc: '一跺脚震得地动：3.5 米内 80 伤害，把人颠起来。',
  steps: [{ at: 0.25, a: { k: 'hit', shape: 'circle', r: 3.5, dmg: 80, o: { launch: 5 }, fx: 'slam' } }] });
M({ id: 'taiji_absorb', name: '太极卸力', house: 'quanshi', icon: '☯️', mp: 18, cd: 14, ai: 3, anim: 'skill_raise', dur: 0.4,
  desc: '沉肩坠肘 2 秒：挨的打只受两成，其余存进身上；2 秒后一齐放出，把 4 米内的人推飞（存得越多打得越重）。',
  steps: [{ at: 0.05, a: { k: 'self', absorb: 2, fx: 'qi' } }] });
M({ id: 'inch_punch', name: '寸劲', house: 'quanshi', icon: '✊', mp: 18, cd: 9, ai: 2, anim: 'skill_palm', dur: 0.55, charge: 0.25,
  desc: '贴身一寸发力：1.7 米内一拳 280，打穿霸体和护体。',
  steps: [{ at: 0.05, a: { k: 'hit', shape: 'cone', r: 2.2, cos: 0.4, dmg: 280, o: { heavy: true, crit: true, knock: 14 }, strip: true, fx: 'burst' } }] });
M({ id: 'tiger_pounce', name: '猛虎下山', house: 'quanshi', icon: '🐅', mp: 20, cd: 9, ai: 8, anim: 'skill_flip', dur: 0.8,
  desc: '扑向 8 米内的对手，落地一记重拳（150），砸倒在地。',
  steps: [{ at: 0.05, a: { k: 'rush', r: 8 } }, { at: 0.3, a: { k: 'hit', shape: 'cone', r: 2.6, cos: 0.3, dmg: 150, o: { heavy: true, down: 1 }, fx: 'slam' } }] });
M({ id: 'drunken_fist', name: '醉拳', house: 'quanshi', icon: '🍶', mp: 15, cd: 18, ai: 4, anim: 'skill_spin', dur: 0.5,
  desc: '仰头一口酒，东倒西歪 6 秒：四成的打躲得开，回 10% 生命。',
  steps: [{ at: 0.2, a: { k: 'self', evade: [0.4, 6], heal: 0.1, fx: 'wind' } }] });

// ================================================================== 符师 (fushi): talismans, thunder, the paper double
M({ id: 'seal_talisman', name: '镇邪符', house: 'fushi', icon: '📃', mp: 12, cd: 3.5, ai: 15, anim: 'skill_throw', dur: 0.4,
  desc: '甩出一张镇邪符（110），贴上的人记一层符印（最多三层，8 秒），引雷、天雷打他更狠。',
  steps: [{ at: 0.16, a: { k: 'shot', speed: 26, life: 0.75, dmg: 110, shape: 'glyph', radius: 0.5, mark: true, color: '#facc15' } }] });
M({ id: 'thunder_talisman', name: '天雷符', house: 'fushi', icon: '⚡', mp: 20, cd: 6, ai: 12, anim: 'skill_raise', dur: 0.55,
  desc: '符纸烧起，0.5 秒后天雷劈在 7 米外的对手脚下：半径 2.2 米 180 伤害，麻 0.6 秒。',
  steps: [{ at: 0.2, a: { k: 'delay', at: 'target', d: 7, r: 2.2, after: 0.5, dmg: 180, o: { stun: 0.6 }, fx: 'lightning' } }] });
M({ id: 'paper_double', name: '纸人替身', house: 'fushi', icon: '🎎', mp: 18, cd: 14, ai: 3, anim: 'skill_spell', dur: 0.35,
  desc: '原地立一个纸人，自己向后遁出 6 米；纸人 3 秒后起火炸开（3 米内 120）。遁走时 0.6 秒刀枪不入。',
  steps: [{ at: 0.02, a: { k: 'delay', at: 'self', d: 0, r: 3, after: 3, dmg: 120, o: { knock: 6 }, fx: 'fire' } }, { at: 0.04, a: { k: 'self', invuln: 0.6 } }, { at: 0.05, a: { k: 'blink', to: 'back', d: 6 } }] });
M({ id: 'bagua_array', name: '八卦阵', house: 'fushi', icon: '☯️', mp: 26, cd: 15, ai: 7, anim: 'skill_spell', dur: 0.7,
  desc: '前方 5 米铺开八卦阵（半径 5 米，6 秒）：踏进阵的人迷了路，晕头转向 2 秒，在阵里一直减速。',
  steps: [{ at: 0.3, a: { k: 'zone', at: 'ahead', d: 5, r: 5, t: 6, dazeOnce: 2, slow: 0.5, every: 0.6, fx: 'gold', color: '#facc15' } }] });
M({ id: 'five_thunders', name: '五雷正法', house: 'fushi', icon: '🌩️', mp: 50, cd: 22, ai: 10, ult: true, anim: 'skill_raise', dur: 1.6, armor: true,
  desc: '五雷正法：12 米内最近的五个敌人各挨一道天雷（300，麻 1.2 秒），身上有符印的人更重。',
  steps: [{ at: 0.5, a: { k: 'strikes', n: 5, r: 12, dmg: 300, o: { stun: 1.2, heavy: true, crit: true }, fx: 'lightning' } }] });
M({ id: 'chain_lightning', name: '引雷', house: 'fushi', icon: '🔗', mp: 22, cd: 8, ai: 12, anim: 'skill_point', dur: 0.5,
  desc: '引一道雷在敌人之间跳四次，每跳 100，优先跳向贴了符印的人（伤害一倍半）。',
  steps: [{ at: 0.2, a: { k: 'chain', n: 4, r: 12, dmg: 100, o: { flinch: true } } }] });
M({ id: 'fire_talisman', name: '火符', house: 'fushi', icon: '🔥', mp: 18, cd: 7, ai: 5, anim: 'skill_throw', dur: 0.45,
  desc: '火符一扬，前方 5 米扇形烈火 90，烧着的人 4 秒里每秒 15。',
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'cone', r: 5, cos: 0.45, dmg: 90, dot: [15, 4, 'burn'], fx: 'fire' } }] });
M({ id: 'talisman_wall', name: '符墙', house: 'fushi', icon: '🧱', mp: 20, cd: 14, ai: 10, anim: 'skill_spell', dur: 0.5,
  desc: '前方 3 米立起一道符墙（8 米长，6 秒）：敌人的暗器、箭、气功打到墙上就散了，穿墙的人减速。',
  steps: [{ at: 0.2, a: { k: 'zone', at: 'ahead', d: 3, r: 4, t: 6, killProj: true, slow: 0.5, every: 0.4, fx: 'gold', color: '#fde047' } }] });
M({ id: 'exorcise', name: '驱邪', house: 'fushi', icon: '🔔', mp: 16, cd: 16, ai: 3, anim: 'skill_spell', dur: 0.4,
  desc: '一摇铜铃：解去自己身上的定身、晕眩、封印、减速，回 15% 生命，1 秒刀枪不入。',
  steps: [{ at: 0.15, a: { k: 'self', cleanse: true, heal: 0.15, invuln: 1, fx: 'holy' } }] });
M({ id: 'soul_bell', name: '招魂铃', house: 'fushi', icon: '🛎️', mp: 22, cd: 12, ai: 6, anim: 'skill_raise', dur: 0.6,
  desc: '招魂铃响：6 米内的人被勾到你身边，2 秒出不了招。',
  steps: [{ at: 0.25, a: { k: 'pull', r: 6, power: 12 } }, { at: 0.3, a: { k: 'hit', shape: 'circle', r: 6, dmg: 50, o: { silence: 2 }, fx: 'sound' } }] });

// ================================================================== 琴师 (qinshi): music from afar, songs for friends
M({ id: 'note_gong', name: '宫音', house: 'qinshi', icon: '🎵', mp: 12, cd: 3.5, ai: 15, anim: 'skill_point', dur: 0.4,
  desc: '拨弦三响，三枚音符成扇形飞出，每枚 70。',
  steps: [{ at: 0.15, a: { k: 'shot', n: 3, spread: 0.5, speed: 24, life: 0.8, dmg: 70, shape: 'glyph', radius: 0.5, color: '#c4b5fd' } }] });
M({ id: 'string_blade', name: '弦刃', house: 'qinshi', icon: '🎼', mp: 16, cd: 6, ai: 5, anim: 'skill_slash', dur: 0.45,
  desc: '琴弦化刃，前方 5 米一片无形弦光：100 伤害，被割的人减速 2 秒。',
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'cone', r: 5, cos: 0.5, dmg: 100, o: { slow: 2 }, fx: 'sound' } }] });
M({ id: 'calm_song', name: '清心曲', house: 'qinshi', icon: '🎶', mp: 22, cd: 14, ai: 6, anim: 'skill_spell', dur: 0.6,
  desc: '奏一曲清心（跟着你，半径 7 米，8 秒）：圈里的同伴和你每秒回 2.5% 生命。',
  steps: [{ at: 0.25, a: { k: 'zone', r: 7, t: 8, follow: true, heal: 0.025, every: 0.8, fx: 'holy', color: '#ddd6fe' } }] });
M({ id: 'mountain_water', name: '高山流水', house: 'qinshi', icon: '🏞️', mp: 28, cd: 11, ai: 8, anim: 'skill_spell', dur: 2.1,
  desc: '抚琴 2 秒，琴音一浪接一浪推向前方 8 米（每 0.3 秒一浪，30 伤害，减速），可以慢慢走。',
  move: { walk: 0.25 },
  loop: [0.3, 0.1, 2, { k: 'hit', shape: 'cone', r: 8, cos: 0.55, dmg: 30, o: { slow: 1, flinch: true }, fx: 'sound' }], steps: [] });
M({ id: 'guangling', name: '广陵散', house: 'qinshi', icon: '🪕', mp: 50, cd: 24, ai: 8, ult: true, anim: 'skill_spell', dur: 2.6, armor: true,
  desc: '广陵散绝响：10 米内连响六声（每声 100，封招），最后一声裂弦 300，把人掀飞。',
  loop: [0.32, 0.2, 1.9, { k: 'hit', shape: 'circle', r: 10, dmg: 100, o: { silence: 0.6, flinch: true }, fx: 'sound' }],
  steps: [{ at: 2.3, a: { k: 'hit', shape: 'circle', r: 10, dmg: 300, o: { heavy: true, crit: true, launch: 9 }, fx: 'burst' } }] });
M({ id: 'ambush_tune', name: '十面埋伏', house: 'qinshi', icon: '🎯', mp: 20, cd: 9, ai: 6, anim: 'skill_raise', dur: 0.5,
  desc: '十面埋伏：八枚音刃向四面八方射出，每枚 80。',
  steps: [{ at: 0.2, a: { k: 'shot', n: 8, ring: true, speed: 20, life: 0.6, dmg: 80, shape: 'glyph', radius: 0.55, color: '#a78bfa' } }] });
M({ id: 'soul_charm', name: '摄魂', house: 'qinshi', icon: '🌀', mp: 18, cd: 10, ai: 10, anim: 'skill_point', dur: 0.45,
  desc: '一段摄魂调直入人心：打中的人失魂落魄 2.5 秒（40）。',
  steps: [{ at: 0.18, a: { k: 'shot', speed: 20, life: 0.6, dmg: 40, shape: 'glyph', radius: 0.6, daze: 2.5, color: '#e879f9' } }] });
M({ id: 'three_folds', name: '阳关三叠', house: 'qinshi', icon: '🔊', mp: 24, cd: 12, ai: 6, anim: 'skill_spell', dur: 1.3,
  desc: '一曲三叠：三圈琴音一圈比一圈大（4 / 6 / 8 米，60 / 90 / 130，最后一圈推开）。',
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'circle', r: 4, dmg: 60, fx: 'sound' } }, { at: 0.65, a: { k: 'hit', shape: 'circle', r: 6, dmg: 90, fx: 'sound' } }, { at: 1.1, a: { k: 'hit', shape: 'circle', r: 8, dmg: 130, o: { knock: 10 }, fx: 'sound' } }] });
M({ id: 'broken_string', name: '断弦', house: 'qinshi', icon: '🪡', mp: 20, cd: 9, ai: 10, anim: 'skill_slash', dur: 0.45,
  desc: '一根弦崩断飞出，穿过 10 米：线上的人 200 伤害，伤口流血 4 秒（每秒 18）。',
  steps: [{ at: 0.18, a: { k: 'hit', shape: 'line', r: 10, w: 0.8, dmg: 200, dot: [18, 4, 'bleed'], fx: 'thrust' } }] });
M({ id: 'lullaby', name: '安魂', house: 'qinshi', icon: '😴', mp: 26, cd: 18, ai: 5, anim: 'skill_spell', dur: 0.8,
  desc: '一曲安魂：6 米内的人昏昏睡去 2.5 秒。',
  steps: [{ at: 0.4, a: { k: 'hit', shape: 'circle', r: 6, dmg: 20, o: { stun: 2.5, stagger: false }, fx: 'holy' } }] });

// ================================================================== 御兽师 (yushou): wolves, a hawk, the wild
M({ id: 'wolf_call', name: '狼啸', house: 'yushou', icon: '🐺', mp: 18, cd: 10, ai: 10, anim: 'skill_raise', dur: 0.6,
  desc: '一声长啸唤来一头灰狼（18 秒）：跟着你，咬身边的敌人（每口 45）。',
  steps: [{ at: 0.3, a: { k: 'pet', kind: 'wolf', n: 1, life: 18, dmg: 45, every: 0.9, range: 14 } }] });
M({ id: 'hawk_dive', name: '鹰击', house: 'yushou', icon: '🦅', mp: 14, cd: 5, ai: 16, anim: 'skill_point', dur: 0.45,
  desc: '海东青从天上扑向对手：140 伤害，抓得他发懵 0.5 秒。',
  steps: [{ at: 0.18, a: { k: 'shot', look: 'orb', speed: 26, life: 0.9, dmg: 140, shape: 'dart', homing: 5, radius: 0.7, daze: 0.5, color: '#f1f5f9' } }] });
M({ id: 'bone_strike', name: '兽骨杖击', house: 'yushou', icon: '🦴', mp: 12, cd: 4, ai: 3, anim: 'skill_slash', dur: 0.5,
  desc: '狼头骨杖砸下：前方 2.8 米 120 伤害，减速 2 秒。',
  steps: [{ at: 0.25, a: { k: 'hit', shape: 'cone', r: 2.8, cos: 0.4, dmg: 120, o: { slow: 2, knock: 3 }, fx: 'earth' } }] });
M({ id: 'wolf_pack', name: '群狼', house: 'yushou', icon: '🐾', mp: 30, cd: 18, ai: 10, anim: 'skill_raise', dur: 0.7,
  desc: '狼群应声而来：一次唤出三头狼（12 秒）。',
  steps: [{ at: 0.35, a: { k: 'pet', kind: 'wolf', n: 3, life: 12, dmg: 40, every: 1, range: 14 } }] });
M({ id: 'stampede', name: '百兽奔腾', house: 'yushou', icon: '🦬', mp: 50, cd: 24, ai: 10, ult: true, anim: 'skill_stomp', dur: 1.8, armor: true,
  desc: '百兽奔腾：兽群虚影从身后冲向前方 14 米（宽 5 米），1.5 秒里踩六波，每波 80 并撞飞。',
  loop: [0.25, 0.2, 1.5, { k: 'hit', shape: 'line', r: 14, w: 2.6, dmg: 80, o: { knock: 9, launch: 3 }, fx: 'earth' }],
  steps: [{ at: 0.2, a: { k: 'zone', r: 2.6, t: 1.4, line: 14, every: 0.08, fx: 'earth', color: '#a16207' } }] });
M({ id: 'wild_instinct', name: '野性', house: 'yushou', icon: '💢', mp: 18, cd: 16, ai: 5, anim: 'skill_raise', dur: 0.5,
  desc: '野性勃发 6 秒：你跑得快两成五，攻守提升一成；你的狼和鹰咬得更勤。',
  steps: [{ at: 0.2, a: { k: 'self', speed: [1.25, 6], buffAtk: 6, fx: 'wind' } }, { at: 0.21, a: { k: 'pets', cmd: 'wild', t: 6 } }] });
M({ id: 'rend', name: '撕咬', house: 'yushou', icon: '🩸', mp: 14, cd: 12, ai: 8, anim: 'skill_point', dur: 0.4,
  desc: '一声令下：你的狼 5 秒内咬一口顶两口，被咬的人流血。',
  steps: [{ at: 0.15, a: { k: 'pets', cmd: 'rend', t: 5 } }, { at: 0.16, a: { k: 'text', text: '撕咬！' } }] });
M({ id: 'bear_might', name: '熊罴之力', house: 'yushou', icon: '🐻', mp: 20, cd: 8, ai: 3, anim: 'skill_slash', dur: 0.65, armor: true,
  desc: '借来熊罴之力，一杖横扫 3.2 米：170 伤害，打飞 8 米。',
  steps: [{ at: 0.32, a: { k: 'hit', shape: 'cone', r: 3.2, cos: 0.2, dmg: 170, o: { heavy: true, knock: 16 }, fx: 'earth' } }] });
M({ id: 'hawk_eye', name: '鹰眼', house: 'yushou', icon: '👁️', mp: 22, cd: 20, ai: 16, anim: 'skill_raise', dur: 0.5,
  desc: '放海东青上天盘旋 12 秒，见着敌人就俯冲下去抓一把（每次 60）。',
  steps: [{ at: 0.2, a: { k: 'pet', kind: 'hawk', n: 1, life: 12, dmg: 60, every: 1.6, range: 18 } }] });
M({ id: 'deer_blessing', name: '唤鹿', house: 'yushou', icon: '🦌', mp: 24, cd: 22, ai: 4, anim: 'skill_raise', dur: 0.6,
  desc: '唤来一头灵鹿绕着你跑 10 秒，它身边 5 米的同伴和你每 0.8 秒回 3% 生命。',
  steps: [{ at: 0.3, a: { k: 'pet', kind: 'deer', n: 1, life: 10, dmg: 0, every: 0.8, range: 0 } }] });

// ================================================================== 毒宗 (duzong): poison that waits, then bites
M({ id: 'viper_stab', name: '蛇信刺', house: 'duzong', icon: '🐍', mp: 10, cd: 3.5, ai: 2.5, anim: 'attack_1', dur: 0.4,
  desc: '银匕首一刺 90，刀上的蛇毒 6 秒里每秒 20（能叠三层）。',
  move: { lunge: [8, 0.12] },
  steps: [{ at: 0.18, a: { k: 'hit', shape: 'cone', r: 2.3, cos: 0.5, dmg: 90, dot: [20, 6, 'poison'], fx: 'poison' } }] });
M({ id: 'poison_fog', name: '毒雾', house: 'duzong', icon: '☁️', mp: 18, cd: 8, ai: 8, anim: 'skill_throw', dur: 0.45,
  desc: '前方 6 米炸开一团毒雾（半径 4 米，6 秒）：进雾的人中毒（每秒 22，5 秒），在雾里减速。',
  steps: [{ at: 0.2, a: { k: 'zone', at: 'ahead', d: 6, r: 4, t: 6, dot: [22, 5, 'poison'], slow: 0.5, every: 0.5, fx: 'poison', color: '#65a30d' } }] });
M({ id: 'gu_swarm', name: '蛊虫', house: 'duzong', icon: '🪲', mp: 16, cd: 6, ai: 14, anim: 'skill_throw', dur: 0.45,
  desc: '放出三群蛊虫自己去找人，每群 50，钻进身体每秒 15（5 秒）。',
  steps: [{ at: 0.18, a: { k: 'shot', n: 3, spread: 0.9, speed: 14, life: 1.6, dmg: 50, shape: 'pin', homing: 5, radius: 0.6, dot: [15, 5, 'poison'], color: '#84cc16' } }] });
M({ id: 'venom_burst', name: '万毒噬心', house: 'duzong', icon: '☠️', mp: 26, cd: 12, ai: 12, anim: 'skill_spell', dur: 0.6,
  desc: '催动 12 米内所有中了你毒的人体内的毒，一口气全发出来：剩下的毒伤一倍半，立刻打完。',
  steps: [{ at: 0.3, a: { k: 'detonate', r: 12, mult: 1.5 } }] });
M({ id: 'five_venoms', name: '五毒天罗', house: 'duzong', icon: '🕷️', mp: 50, cd: 24, ai: 9, ult: true, anim: 'skill_spell', dur: 1.2, armor: true,
  desc: '五毒天罗：脚下 9 米铺开一张毒网 7 秒，进网先封招 1 秒，在网里每 0.5 秒 40、减速，中毒每秒 30。',
  steps: [{ at: 0.5, a: { k: 'zone', r: 9, t: 7, silenceOnce: 1, slow: 0.5, every: 0.5, dmg: 40, dot: [30, 5, 'poison'], fx: 'poison', color: '#4d7c0f' } }] });
M({ id: 'butterfly_step', name: '蝶影', house: 'duzong', icon: '🦋', mp: 12, cd: 7, ai: 3, anim: 'skill_flip', dur: 0.55,
  desc: '像蝴蝶一样向后翻出 6 米，原地留下一团毒粉（半径 2.5 米，3 秒，中毒每秒 18）。',
  move: { back: [11, 0.3] },
  steps: [{ at: 0.02, a: { k: 'zone', r: 2.5, t: 3, dot: [18, 4, 'poison'], every: 0.5, fx: 'poison', color: '#a3e635' } }] });
M({ id: 'antidote', name: '解毒丹', house: 'duzong', icon: '💊', mp: 15, cd: 18, ai: 3, anim: 'skill_spell', dur: 0.4,
  desc: '吞下解毒丹：回 20% 生命，解去所有异常，6 秒里细小的伤害碰不到你。',
  steps: [{ at: 0.15, a: { k: 'self', heal: 0.2, cleanse: true, immune: 6, fx: 'holy' } }] });
M({ id: 'soul_gu', name: '噬魂蛊', house: 'duzong', icon: '🪱', mp: 18, cd: 10, ai: 12, anim: 'skill_point', dur: 0.45,
  desc: '一只噬魂蛊钻进对手身体（60），8 秒里每秒吸 25，吸到的一半变成你的血。',
  steps: [{ at: 0.18, a: { k: 'shot', speed: 22, life: 0.8, dmg: 60, shape: 'pin', homing: 6, radius: 0.5, color: '#b91c1c' } }, { at: 0.5, a: { k: 'hit', shape: 'cone', r: 16, cos: 0.85, dmg: 0, dot: [25, 8, 'poison'] } }] });
M({ id: 'toxic_blood', name: '毒血', house: 'duzong', icon: '🧪', mp: 16, cd: 18, ai: 4, anim: 'skill_spell', dur: 0.4,
  desc: '以身饲毒 8 秒：近身打你的人沾上毒血（每秒 25，4 秒）。',
  steps: [{ at: 0.15, a: { k: 'self', thorns: [25, 8], fx: 'poison' } }] });
M({ id: 'bone_rot', name: '腐骨', house: 'duzong', icon: '🦠', mp: 18, cd: 9, ai: 4, anim: 'skill_throw', dur: 0.45,
  desc: '一把腐骨散撒向前方 4 米：60 伤害，沾上的人骨头发软 5 秒（打人轻、挨打重）。',
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'cone', r: 4, cos: 0.4, dmg: 60, weak: 5, fx: 'poison' } }] });

// ================================================================== 弓手 (gongshou): the bow drawn, shot placed
M({ id: 'piercing_arrow', name: '穿杨箭', house: 'gongshou', icon: '🏹', mp: 12, cd: 4, ai: 18, anim: 'throw', dur: 0.45,
  desc: '一箭穿杨：快箭穿过 26 米上的所有人，每人 140。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 48, life: 0.55, dmg: 140, shape: 'dart', pierce: true, radius: 0.45, color: '#e2b67c' } }] });
M({ id: 'triple_shot', name: '三连珠', house: 'gongshou', icon: '🎯', mp: 14, cd: 5, ai: 18, anim: 'throw', dur: 0.6,
  desc: '一口气连射三箭，每箭 70，稍微追人。',
  steps: [{ at: 0.12, a: { k: 'shot', n: 3, seq: 0.14, speed: 40, life: 0.6, dmg: 70, shape: 'dart', homing: 2.5, radius: 0.45 } }] });
M({ id: 'retreat_shot', name: '后撤射', house: 'gongshou', icon: '↩️', mp: 12, cd: 6, ai: 5, anim: 'skill_flip', dur: 0.6,
  desc: '向后跃开 5 米，半空回身一箭（100，减速 2 秒）。',
  move: { back: [10, 0.3] },
  steps: [{ at: 0.2, a: { k: 'shot', speed: 40, life: 0.6, dmg: 100, shape: 'dart', radius: 0.5, slow: 2 } }] });
M({ id: 'full_draw', name: '蓄力满弓', house: 'gongshou', icon: '🌕', mp: 24, cd: 10, ai: 20, anim: 'throw', dur: 0.35, charge: 1.1, armor: true,
  desc: '站定拉满弓 1.1 秒，一箭破空：360 伤害，穿透，把人钉飞。',
  steps: [{ at: 0.05, a: { k: 'shot', speed: 60, life: 0.6, dmg: 360, shape: 'dart', pierce: true, radius: 0.6, knock: 14, color: '#fde68a' } }] });
M({ id: 'sunset_arrow', name: '落日箭', house: 'gongshou', icon: '🌇', mp: 50, cd: 24, ai: 14, ult: true, anim: 'skill_raise', dur: 1.4, armor: true,
  desc: '朝天一箭，1 秒后化作火流星砸在 12 米外：半径 6 米 450 伤害并击飞，地上烧 4 秒（每秒 25）。',
  steps: [{ at: 0.3, a: { k: 'delay', at: 'target', d: 12, r: 6, after: 1, dmg: 450, o: { heavy: true, crit: true, launch: 10 }, fx: 'fire', burn: [25, 4] } }] });
M({ id: 'scatter_shot', name: '散射', house: 'gongshou', icon: '🎇', mp: 18, cd: 7, ai: 10, anim: 'throw', dur: 0.45,
  desc: '一弓七箭扇形散开（60 度），每箭 60。',
  steps: [{ at: 0.2, a: { k: 'shot', n: 7, spread: 1.05, speed: 36, life: 0.5, dmg: 60, shape: 'dart', radius: 0.45 } }] });
M({ id: 'explosive_arrow', name: '爆裂箭', house: 'gongshou', icon: '💥', mp: 18, cd: 8, ai: 16, anim: 'throw', dur: 0.45,
  desc: '箭头绑着火药：射中 130，炸开 3 米再伤身边的人（110）。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 36, life: 0.7, dmg: 130, shape: 'dart', radius: 0.55, splash: [3, 110], color: '#fb923c' } }] });
M({ id: 'focus', name: '凝神', house: 'gongshou', icon: '🧘', mp: 16, cd: 20, ai: 10, anim: 'skill_raise', dur: 0.5,
  desc: '屏息凝神 5 秒：这期间每一箭（每一击）都是暴击。',
  steps: [{ at: 0.2, a: { k: 'self', focus: 5, fx: 'qi' } }] });
M({ id: 'snare_arrow', name: '绊马索', house: 'gongshou', icon: '🪢', mp: 14, cd: 8, ai: 16, anim: 'throw', dur: 0.45,
  desc: '一支带绳的箭缠住腿脚：80 伤害，绊倒 1.4 秒。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 34, life: 0.7, dmg: 80, shape: 'dart', radius: 0.5, down: 1.4, color: '#a16207' } }] });
M({ id: 'whistle_arrow', name: '鸣镝', house: 'gongshou', icon: '📯', mp: 14, cd: 9, ai: 18, anim: 'throw', dur: 0.45,
  desc: '鸣镝尖啸：射中 90，那人耳朵嗡嗡响，2.5 秒出不了招。',
  steps: [{ at: 0.2, a: { k: 'shot', speed: 42, life: 0.6, dmg: 90, shape: 'dart', radius: 0.5, silence: 2.5, color: '#fef3c7' } }] });

// ================================================================== 双刀客 (shuangdao): two blades, never still, bleeding
M({ id: 'twin_dragon', name: '双龙斩', house: 'shuangdao', icon: '✖️', mp: 12, cd: 4, ai: 3, anim: 'attack_3', dur: 0.5,
  desc: '双刀交叉一斩：前方 3 米两刀，各 70。',
  steps: [{ at: 0.18, a: { k: 'hit', shape: 'cone', r: 3, cos: 0.35, dmg: 70, o: { flinch: true }, fx: 'slash' } }, { at: 0.32, a: { k: 'hit', shape: 'cone', r: 3, cos: 0.35, dmg: 70, o: { knock: 5 }, fx: 'slash' } }] });
M({ id: 'blade_dance', name: '刀舞', house: 'shuangdao', icon: '💃', mp: 20, cd: 7, ai: 3, anim: 'skill_spin', dur: 1.1, armor: true,
  desc: '双刀翻飞着往前舞 1 秒（一边舞一边走），前方 2.6 米每 0.15 秒一刀（34）。',
  move: { lunge: [3.5, 1.0] },
  loop: [0.15, 0.08, 1.0, { k: 'hit', shape: 'cone', r: 2.6, cos: 0.2, dmg: 34, o: { flinch: true }, fx: 'slash' }], steps: [] });
M({ id: 'turn_slash', name: '回身斩', house: 'shuangdao', icon: '🔄', mp: 16, cd: 6, ai: 5, anim: 'skill_dash', dur: 0.75,
  desc: '贴着对手穿过去 5 米（路上一刀 90），落脚回身再两刀（各 90）。',
  move: { dash: [16, 0.3, 1.8, 90, { flinch: true }] },
  steps: [{ at: 0.35, a: { k: 'turn' } }, { at: 0.42, a: { k: 'hit', shape: 'cone', r: 3, cos: 0.3, dmg: 90, fx: 'slash' } }, { at: 0.58, a: { k: 'hit', shape: 'cone', r: 3, cos: 0.3, dmg: 90, o: { knock: 6 }, fx: 'slash' } }] });
M({ id: 'bleed_edge', name: '血刃', house: 'shuangdao', icon: '🩸', mp: 18, cd: 16, ai: 4, anim: 'skill_raise', dur: 0.4,
  desc: '刀刃抹血 8 秒：每一下（普攻也算）都让人流血（每秒 18，4 秒）。',
  steps: [{ at: 0.15, a: { k: 'self', bleedHits: 8, fx: 'blood' } }] });
M({ id: 'asura_prison', name: '修罗刀狱', house: 'shuangdao', icon: '👹', mp: 50, cd: 24, ai: 5, ult: true, anim: 'skill_spin', dur: 2.6, armor: true,
  desc: '修罗刀狱：刀光在身边 6 米织成一座刀牢 2.4 秒，把人往里卷，每 0.12 秒一刀（26），最后双刀落下 300。',
  move: { walk: 0.3 },
  loop: [0.12, 0.2, 2.2, { k: 'hit', shape: 'circle', r: 6, dmg: 26, o: { flinch: true }, fx: 'slash' }],
  steps: [{ at: 0.15, a: { k: 'zone', r: 6, t: 2.2, follow: true, pull: 6, every: 0.1, fx: 'slash', color: '#f43f5e' } }, { at: 2.35, a: { k: 'hit', shape: 'circle', r: 4, dmg: 300, o: { heavy: true, crit: true, launch: 9 }, vsBleed: 1.3, fx: 'blood' } }] });
M({ id: 'gale_blade', name: '狂风刀', house: 'shuangdao', icon: '🌬️', mp: 18, cd: 7, ai: 6, anim: 'skill_flip', dur: 0.7,
  desc: '旋身跃出 6 米，落地双刀卷起一阵刀风（3 米内 120，挑起）。',
  move: { leap: [7, 11] },
  steps: [{ at: 9, a: { k: 'hit', shape: 'circle', r: 3, dmg: 120, o: { launch: 8 }, fx: 'wind' } }] });
M({ id: 'pommel_bash', name: '刀背砸', house: 'shuangdao', icon: '🔨', mp: 14, cd: 8, ai: 2.5, anim: 'attack_2', dur: 0.45,
  desc: '翻过刀背砸脑门：80 伤害，晕 1.5 秒。',
  steps: [{ at: 0.2, a: { k: 'hit', shape: 'cone', r: 2.4, cos: 0.5, dmg: 80, o: { stun: 1.5 }, fx: 'burst' } }] });
M({ id: 'iron_cutter', name: '斩铁', house: 'shuangdao', icon: '⛓️', mp: 20, cd: 9, ai: 3, anim: 'attack_3', dur: 0.6, armor: true,
  desc: '双刀合斩如断铁：3 米 200 伤害，劈开霸体、金钟和护体真气。',
  steps: [{ at: 0.3, a: { k: 'hit', shape: 'cone', r: 3, cos: 0.4, dmg: 200, o: { heavy: true, crit: true }, strip: true, fx: 'slash' } }] });
M({ id: 'gust_step', name: '疾风步', house: 'shuangdao', icon: '👟', mp: 12, cd: 14, ai: 8, anim: 'skill_dash', dur: 0.3,
  desc: '脚下生风 5 秒：跑快四成。',
  steps: [{ at: 0.1, a: { k: 'self', speed: [1.4, 5], fx: 'wind' } }] });
M({ id: 'sheathe_draw', name: '双刀归鞘', house: 'shuangdao', icon: '🗡️', mp: 22, cd: 11, ai: 3, anim: 'skill_spin', dur: 0.45, charge: 0.55,
  desc: '收刀入鞘 0.55 秒，一瞬双刀出鞘斩一圈：3.5 米内 180，对流血的人再重三成。',
  steps: [{ at: 0.05, a: { k: 'hit', shape: 'circle', r: 3.5, dmg: 180, o: { heavy: true, crit: true, knock: 7 }, vsBleed: 1.3, fx: 'slash' } }] });

// ================================================================== 气宗 (qizong): breath made into force
M({ id: 'qi_bolt', name: '气弹', house: 'qizong', icon: '🔵', mp: 10, cd: 3, ai: 15, anim: 'skill_palm', dur: 0.4,
  desc: '掌心推出一颗气弹，飞 20 米，110 伤害，推开 3 米。',
  steps: [{ at: 0.16, a: { k: 'shot', speed: 28, life: 0.75, dmg: 110, shape: 'glyph', radius: 0.6, knock: 7, color: '#e0f2fe' } }] });
M({ id: 'qi_wave', name: '气浪', house: 'qizong', icon: '🌊', mp: 16, cd: 6, ai: 5, anim: 'skill_stomp', dur: 0.5,
  desc: '周身气劲一震，一圈气浪往外推：6 米内 90，全都推开。',
  steps: [{ at: 0.22, a: { k: 'hit', shape: 'circle', r: 6, dmg: 90, o: { knock: 13 }, fx: 'qi' } }] });
M({ id: 'levitate', name: '凌空', house: 'qizong', icon: '🕊️', mp: 14, cd: 10, ai: 6, anim: 'skill_raise', dur: 2.2,
  desc: '提一口真气浮上半空 2 秒，能在空中走动，这时打不倒、挑不飞。',
  move: { float: true, walk: 0.6 },
  steps: [{ at: 0, a: { k: 'self', protect: 2.2 } }, { at: 0.01, a: { k: 'text', text: '凌空' } }] });
M({ id: 'qi_beam', name: '气贯长虹', house: 'qizong', icon: '🌈', mp: 28, cd: 10, ai: 12, anim: 'skill_palm', dur: 1.6, armor: true,
  desc: '双掌推出一道 14 米长的气柱 1.5 秒：线上的人每 0.15 秒 25。',
  loop: [0.15, 0.1, 1.5, { k: 'hit', shape: 'line', r: 14, w: 1, dmg: 25, o: { flinch: true }, fx: 'thrust' }], steps: [] });
M({ id: 'heaven_earth', name: '天地无极', house: 'qizong', icon: '🌐', mp: 50, cd: 24, ai: 12, ult: true, anim: 'skill_raise', dur: 1.6, armor: true,
  desc: '聚天地之气成一颗巨大的气团，慢慢推出去，撞上人或飞到 16 米炸开：半径 8 米 500 伤害。',
  steps: [{ at: 0.9, a: { k: 'shot', speed: 12, life: 1.35, dmg: 300, shape: 'glyph', radius: 1.4, splash: [8, 500], knock: 10, color: '#bae6fd' } }] });
M({ id: 'qi_barrier', name: '护体真气', house: 'qizong', icon: '🛡️', mp: 20, cd: 16, ai: 4, anim: 'skill_raise', dur: 0.4,
  desc: '真气护体：一层能吃下 25% 最大生命的气盾，6 秒。',
  steps: [{ at: 0.15, a: { k: 'self', ward: 0.25, fx: 'qi' } }] });
M({ id: 'remote_point', name: '隔空点穴', house: 'qizong', icon: '☝️', mp: 16, cd: 9, ai: 10, anim: 'skill_point', dur: 0.4,
  desc: '隔空一指点向 10 米内的穴道：线上第一个人 60 伤害，点住 2 秒。',
  steps: [{ at: 0.15, a: { k: 'shot', look: 'orb', speed: 50, life: 0.25, dmg: 60, shape: 'pin', radius: 0.4, stun: 2, color: '#f0f9ff' } }] });
M({ id: 'star_absorb', name: '吸星', house: 'qizong', icon: '✨', mp: 0, cd: 14, ai: 7, anim: 'skill_spell', dur: 0.6,
  desc: '吸星之法：7 米内每个敌人被吸走 35 点内力，都归你。',
  steps: [{ at: 0.3, a: { k: 'drain', r: 7, mp: 35 } }] });
M({ id: 'qi_vortex', name: '气旋', house: 'qizong', icon: '🌀', mp: 22, cd: 12, ai: 9, anim: 'skill_palm', dur: 0.5,
  desc: '前方 6 米卷起一团气旋（半径 4 米，4 秒），把人往中间吸，每 0.4 秒 20。',
  steps: [{ at: 0.2, a: { k: 'zone', at: 'ahead', d: 6, r: 4, t: 4, pull: 7, every: 0.4, dmg: 20, fx: 'wind', color: '#e0f2fe' } }] });
M({ id: 'circulation', name: '周天', house: 'qizong', icon: '🔁', mp: 0, cd: 20, ai: 2, anim: 'skill_spell', dur: 2.0,
  desc: '原地运转一个大周天 2 秒（不能动）：回 40% 内力、15% 生命。',
  steps: [{ at: 1.9, a: { k: 'self', mp: 0.4, heal: 0.15, fx: 'qi' } }] });

// ================================================================== 机关师 (jiguan): engines that fight for you
M({ id: 'repeater', name: '连弩', house: 'jiguan', icon: '🎯', mp: 10, cd: 3.5, ai: 16, anim: 'throw', dur: 0.6,
  desc: '诸葛连弩连发五矢，每矢 40。',
  steps: [{ at: 0.08, a: { k: 'shot', n: 5, seq: 0.09, speed: 38, life: 0.6, dmg: 40, shape: 'pin', radius: 0.45, color: '#d6a35c' } }] });
M({ id: 'puppet', name: '木人桩', house: 'jiguan', icon: '🪆', mp: 22, cd: 16, ai: 8, anim: 'skill_point', dur: 0.6,
  desc: '放出一具机关木人（15 秒）：慢慢走过去跟人对打，每下 70，打得人退。',
  steps: [{ at: 0.3, a: { k: 'pet', kind: 'puppet', n: 1, life: 15, dmg: 70, every: 1.2, range: 12 } }] });
M({ id: 'land_mine', name: '地雷', house: 'jiguan', icon: '💣', mp: 14, cd: 7, ai: 6, anim: 'skill_point', dur: 0.4,
  desc: '在前方 2 米埋一颗地雷（存 20 秒）：有人踩上就炸，3 米内 180，炸上天。',
  steps: [{ at: 0.2, a: { k: 'trap', d: 2, r: 3, dmg: 180, o: { launch: 9 }, life: 20 } }] });
M({ id: 'turret', name: '连弩塔', house: 'jiguan', icon: '🗼', mp: 26, cd: 16, ai: 12, anim: 'skill_point', dur: 0.6,
  desc: '架起一座连弩塔（18 秒）：16 米内见人就射，每 0.6 秒一矢（45）。',
  steps: [{ at: 0.3, a: { k: 'pet', kind: 'turret', n: 1, life: 18, dmg: 45, every: 0.6, range: 16 } }] });
M({ id: 'kite_bombing', name: '木鸢轰炸', house: 'jiguan', icon: '🪁', mp: 50, cd: 24, ai: 12, ult: true, anim: 'skill_raise', dur: 1.8, armor: true,
  desc: '放出墨家木鸢从头顶飞过前方 20 米，沿路丢下八颗炸弹，每颗半径 3 米 140。',
  steps: [{ at: 0.3, a: { k: 'zone', r: 1.5, t: 1.4, line: 20, every: 0.12, fx: 'fire', color: '#fb923c' } }, ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ at: 0.4 + k * 0.15, a: { k: 'delay' as const, at: 'ahead' as const, d: 3 + k * 2.4, r: 3, after: 0.3, dmg: 140, o: { heavy: true, launch: 5 }, fx: 'fire' as const } }))] });
M({ id: 'grapple_line', name: '钩索', house: 'jiguan', icon: '🪝', mp: 10, cd: 8, ai: 10, anim: 'skill_point', dur: 0.4,
  desc: '腕上机关射出钩索，把自己拽向前方 10 米。',
  steps: [{ at: 0.12, a: { k: 'blink', to: 'ahead', d: 10 } }] });
M({ id: 'thunder_bomb', name: '霹雳弹', house: 'jiguan', icon: '🧨', mp: 18, cd: 9, ai: 10, anim: 'skill_throw', dur: 0.45,
  desc: '扔出一颗霹雳弹，落在 8 米外炸开：半径 3 米 100，震得人发懵 1.5 秒。',
  steps: [{ at: 0.2, a: { k: 'delay', at: 'ahead', d: 8, r: 3, after: 0.45, dmg: 100, o: { daze: 1.5 }, fx: 'burst' } }] });
M({ id: 'gear_shield', name: '机关盾', house: 'jiguan', icon: '⚙️', mp: 24, cd: 18, ai: 5, anim: 'skill_point', dur: 0.5,
  desc: '展开一面机关盾阵（半径 3.5 米，6 秒）：阵里的你和同伴挨打少六成五。',
  steps: [{ at: 0.2, a: { k: 'zone', r: 3.5, t: 6, guard: true, every: 0.6, fx: 'gold', color: '#d6a35c' } }] });
M({ id: 'repair', name: '修理', house: 'jiguan', icon: '🔧', mp: 16, cd: 14, ai: 4, anim: 'skill_spell', dur: 0.6,
  desc: '修修补补：你回 15% 生命，木人和弩塔续上一半的时间。',
  steps: [{ at: 0.3, a: { k: 'self', heal: 0.15, fx: 'wood' } }, { at: 0.31, a: { k: 'pets', cmd: 'mend' } }] });
M({ id: 'overload', name: '超载', house: 'jiguan', icon: '🔥', mp: 20, cd: 14, ai: 8, anim: 'skill_point', dur: 0.4,
  desc: '机关超载：你的木人和弩塔全部炸开，各自 4 米内 250。',
  steps: [{ at: 0.15, a: { k: 'pets', cmd: 'explode', dmg: 250 } }] });
