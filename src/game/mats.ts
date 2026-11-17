// 铸兵's data (a leaf module: economy.ts, forge.ts, the atlas and the hand all read it). Nine elements, each with three
// grades of material (粗 from the men of one kind, 精 from their leaders, the wanted and the far rings, 极 one per great
// foe), and a weapon line of five stages. Stages one to three are for anyone; four and five only for a house (a hero
// picked at the start, or a 散人 after 转职): the weapons keep climbing after you take up a house.

export type El = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'thunder' | 'wind' | 'ice' | 'venom';
/** the atlas's rows: the five phases first, then the four that aren't */
export const ELS: El[] = ['metal', 'wood', 'water', 'fire', 'earth', 'thunder', 'wind', 'ice', 'venom'];

export interface ElDef {
  id: El;
  name: string;
  /** its light (glows, trails, names) and its dark (seals, steel) */
  color: string;
  deep: string;
  /** who drops its 粗 */
  foe: string;
  /** what it does from the first stage */
  effect: string;
  desc: string;
  /** what the third stage adds (开锋) */
  sub: [string, string];
  /** the fifth stage's 异象 */
  ult: [string, string];
  /** whose stuff goes into its higher stages (五行相生; wind and thunder feed each other, water cools ice, wood breeds venom) */
  partner: El;
  /** the weapon's name at each stage (the form follows: 剑, 刀, 枪 ...) */
  names: [string, string, string, string, string];
}
export const EL: Record<El, ElDef> = {
  metal: {
    id: 'metal', name: '金', color: '#f6c445', deep: '#7a5a12', foe: '奸商', effect: '破甲',
    desc: '出手破开霸体；一成上下的机会暴击，伤害翻倍',
    sub: ['剑气', '暴击时斩出一道金色剑气，穿过一排人'],
    ult: ['万剑', '暴击时三柄金剑从天而降，扎向身边的敌人；身后常浮三柄金剑'],
    partner: 'earth', names: ['流金', '断金', '龙吟', '太白', '万刃'],
  },
  wood: {
    id: 'wood', name: '木', color: '#5fd16b', deep: '#24502a', foe: '妖道', effect: '回春',
    desc: '伤敌吸血，杀敌回血',
    sub: ['藤缚', '一成五的机会生出藤蔓，缠住敌人（头目不受）'],
    ult: ['长生', '气血跌破三成五时春木护体，四秒回两成半气血，四十五秒一次'],
    partner: 'water', names: ['桃木', '青藤', '灵枢', '建木', '长生'],
  },
  water: {
    id: 'water', name: '水', color: '#3ba9f2', deep: '#123f66', foe: '水寇，钓鱼', effect: '潮生',
    desc: '每一击溅起水花，伤到身边的敌人，还回内力',
    sub: ['回澜', '第三击推出一道浪，推开前面的人并减速'],
    ult: ['沧溟', '每八秒，第三击化作一道巨浪，把前方的敌人掀上天'],
    partner: 'metal', names: ['流水', '沧浪', '回澜', '覆海', '沧溟'],
  },
  fire: {
    id: 'fire', name: '火', color: '#ff6a2b', deep: '#6e1d0c', foe: '山贼', effect: '灼烧',
    desc: '点燃敌人，烧三秒，最多叠三层',
    sub: ['爆燃', '烧着的敌人倒下时炸开，点燃身边的人'],
    ult: ['焚天', '第三击在地上烧出一圈火，站在里面的都要烧'],
    partner: 'wood', names: ['赤铁', '赤焰', '烈阳', '朱雀', '焚天'],
  },
  earth: {
    id: 'earth', name: '土', color: '#d19a5b', deep: '#5b3c1c', foe: '野和尚', effect: '镇岳',
    desc: '出手更沉，第三击震地，震开身边的敌人；自己少受些伤',
    sub: ['震荡', '震地叫人头晕眼花'],
    ult: ['不周', '第三击掀起一圈石刺，把人挑上天'],
    partner: 'fire', names: ['顽石', '开山', '降魔', '镇岳', '不周'],
  },
  thunder: {
    id: 'thunder', name: '雷', color: '#8d9cff', deep: '#2b2f6e', foe: '伪朝禁军', effect: '惊雷',
    desc: '时不时落下一道雷，连到旁边的敌人，打得人一麻',
    sub: ['连闪', '一道雷多连两个人'],
    ult: ['九霄', '每打六下，三道天雷劈下来'],
    partner: 'wind', names: ['惊蛰', '奔雷', '紫电', '雷霆', '九霄'],
  },
  wind: {
    id: 'wind', name: '风', color: '#56e3b5', deep: '#155c47', foe: '女飞贼', effect: '疾风',
    desc: '出手快，跑得快，第三击甩出一道风刃',
    sub: ['穿云', '风刃穿过所有人'],
    ult: ['破空', '第三击甩出三道风刃；闪避留下一团旋风，把人卷进去'],
    partner: 'thunder', names: ['青翎', '追风', '流云', '扶摇', '破空'],
  },
  ice: {
    id: 'ice', name: '冰', color: '#a5e8ff', deep: '#2a5a73', foe: '雪狼', effect: '寒霜',
    desc: '打中就减速，连打四下冻住（头目只减速）',
    sub: ['碎冰', '打碎冻住的敌人，多伤八成，冰碴溅到身边'],
    ult: ['霜天', '第三击向前裂出一排冰刺，冻住的人更多'],
    partner: 'water', names: ['寒铁', '霜华', '雪魄', '玄冥', '霜天'],
  },
  venom: {
    id: 'venom', name: '毒', color: '#9be52f', deep: '#2e4a0d', foe: '刺客', effect: '蚀骨',
    desc: '下毒，毒五秒，叠到五层毒爆',
    sub: ['腐甲', '毒到四层的人受伤加重'],
    ult: ['万蛊', '中毒的人一死，毒蛊扑向身边三个人'],
    partner: 'wood', names: ['青蛇', '蝎尾', '碧磷', '七绝', '万蛊'],
  },
};

// ---------------------------------------------------------------- materials
export type Grade = 0 | 1 | 2;
export const GRADE_NAME = ['粗', '精', '极'];
export interface Mat {
  id: string;
  name: string;
  el: El;
  grade: Grade;
  /** at a stall; a buyer pays a third to a half */
  price: number;
  desc: string;
  /** where it comes from, for the atlas */
  from: string;
}
export const matId = (el: El, g: Grade) => `${el}_${'crx'[g]}`;
const LIST: [El, Grade, string, number, string, string][] = [
  ['metal', 0, '碎金', 12, '奸商身上搜出的碎金子，熔进钢里，刃口发亮', '奸商'],
  ['metal', 1, '紫金锭', 70, '成色十足的紫金，打出来的兵器不卷刃', '铁算盘 · 贾仁；外圈的奸商偶尔有'],
  ['metal', 2, '铜人心核', 400, '镇阙铜人胸腔里那颗还在转的铜心', '镇阙铜人（一天一块）'],
  ['wood', 0, '桃木心', 12, '妖道桃木剑的木芯，辟邪，也能做柄', '妖道'],
  ['wood', 1, '千年灵芝', 70, '妖道炼丹用的老灵芝，握在手心发暖', '外圈的妖道偶尔有；玄阴弟子'],
  ['wood', 2, '玄阴灵根', 400, '玄阴真人拿精血养了几十年的灵根', '玄阴真人，跟在啸月天狼身边（一天一块）'],
  ['water', 0, '河蚌珠', 12, '河蚌里剖出的珠子，润，带着水气', '钓鱼时捞起的河蚌；水寇'],
  ['water', 1, '蛟鳞', 70, '蛟身上掉下的鳞，比铁硬，比玉凉', '钓到冰下鲟、金鲤时；水寇偶尔有'],
  ['water', 2, '覆舟蛟骨', 400, '覆舟河蛟的一节脊骨', '覆舟河蛟（一天一块）'],
  ['fire', 0, '火硝', 10, '山贼放火烧村用的硝石，一点就着', '山贼（寨里的，劫村的，截道的）'],
  ['fire', 1, '赤焰晶', 70, '山贼头子贴身藏的火晶，夜里自己发红', '断刀客石猛，独眼狼马彪，血手屠九；外圈的山贼偶尔有'],
  ['fire', 2, '血傀心火', 400, '雷彪胸口那团烧不尽的血火', '血傀 · 雷彪（一天一块）'],
  ['earth', 0, '金刚砂', 12, '野和尚磨禅杖用的金刚砂，硬得能磨铁', '野和尚'],
  ['earth', 1, '伏魔岩', 70, '寺里镇魔用的黑岩，沉得出奇', '外圈的野和尚偶尔有；游方僧了尘'],
  ['earth', 2, '苦寒舍利', 400, '苦寒在冰上坐了几十年结出的舍利，冰凉沉重', '冰窟狂僧 · 苦寒（一天一块）'],
  ['thunder', 0, '霹雳砂', 12, '伪朝禁军霹雳弹里倒出来的砂，一搓就噼啪响', '伪朝禁军，巡逻，关卡，金甲卫'],
  ['thunder', 1, '雷纹钢', 70, '禁军军官佩刀上的雷纹钢', '巡逻队长，关卡校尉，金甲卫；逃营校尉韩烈'],
  ['thunder', 2, '九霄雷魄', 400, '伪帝召下的天雷里落下的一块雷魄', '伪帝 · 萧承乾（天阙，一天一块）'],
  ['wind', 0, '燕翎', 12, '女飞贼镖尾的燕翎，轻得能飘起来', '女飞贼'],
  ['wind', 1, '御风羽', 70, '飞贼头子收着的青羽，一抖就起风', '燕子镖柳飞燕；外圈的女飞贼偶尔有'],
  ['wind', 2, '断剑残魂', 400, '断剑魂散去时留下的一缕剑意，像风', '剑冢守灵 · 断剑魂（一天一块）'],
  ['ice', 0, '雪狼牙', 12, '雪岭雪狼的獠牙，冻得发蓝', '雪岭的雪狼'],
  ['ice', 1, '玄冰魄', 70, '冰窟深处万年不化的冰', '冰窟狂僧 · 苦寒；雪狼偶尔有'],
  ['ice', 2, '天狼寒髓', 400, '啸月天狼骨髓里的寒气，装在玉瓶里还冒白烟', '啸月天狼（一天一块）'],
  ['venom', 0, '乌头毒', 12, '刺客淬刀用的乌头汁', '刺客（寨里的，夜里追杀的）'],
  ['venom', 1, '鹤顶红', 70, '刺客头子随身带的一小瓶鹤顶红', '毒娘子花蕊，鬼手侯三，夜行客莫寒；外圈的刺客偶尔有'],
  ['venom', 2, '天魔蛊心', 400, '天魔本相心口养的蛊王', '天魔本相（一天一块）'],
];
export const MATS: Record<string, Mat> = Object.fromEntries(
  LIST.map(([el, grade, name, price, desc, from]) => [matId(el, grade), { id: matId(el, grade), name, el, grade, price, desc, from }]),
);
/** the plain stuff every weapon's body is made of (economy.ts has them as items) */
export const BASE_MATS: Record<string, { name: string; from: string }> = {
  iron: { name: '铁料', from: '寨里的人身上常有' },
  hide: { name: '兽皮', from: '打猎，偶尔从人身上搜到' },
  xuan: { name: '玄铁', from: '头目，悬赏犯，校尉，擂台魁首' },
};
export const matName = (id: string) => MATS[id]?.name ?? BASE_MATS[id]?.name ?? id;

// ---------------------------------------------------------------- the five stages
export interface StageDef {
  n: number;
  name: string;
  /** the level before 张大锤 will make it */
  lvl: number;
  coins: number;
  dmg: number;
  /** how strong the element's effect is */
  k: number;
  /** only for a house (a hero, or a 散人 after 转职) */
  pro: boolean;
}
export const STAGES: StageDef[] = [
  { n: 1, name: '一阶', lvl: 3, coins: 40, dmg: 0.1, k: 0.6, pro: false },
  { n: 2, name: '二阶', lvl: 10, coins: 120, dmg: 0.18, k: 0.8, pro: false },
  { n: 3, name: '三阶', lvl: 18, coins: 300, dmg: 0.27, k: 1, pro: false },
  { n: 4, name: '四阶', lvl: 24, coins: 700, dmg: 0.38, k: 1.25, pro: true },
  { n: 5, name: '五阶', lvl: 30, coins: 1500, dmg: 0.5, k: 1.5, pro: true },
];
/** what each stage takes: its own element's stuff, its partner's, and the body (iron, then 玄铁); a stage above the first
 * also takes the stage below (it is that weapon, reforged) */
export function recipe(el: El, n: number): Record<string, number> {
  const p = EL[el].partner, c = (e: El) => matId(e, 0), r = (e: El) => matId(e, 1), x = (e: El) => matId(e, 2);
  switch (n) {
    case 1:
      return { iron: 4, [c(el)]: 5 };
    case 2:
      return { iron: 6, [c(el)]: 10, [c(p)]: 4, [r(el)]: 1 };
    case 3:
      return { xuan: 3, [c(el)]: 14, [r(el)]: 3, [r(p)]: 1 };
    case 4:
      return { xuan: 6, [r(el)]: 6, [r(p)]: 2, [x(el)]: 1 };
    default:
      return { xuan: 10, [r(el)]: 10, [r(p)]: 4, [x(el)]: 2, [x(p)]: 1 };
  }
}
/** an element's own extra, stage by stage */
export const SPEED = [0.05, 0.07, 0.09, 0.11, 0.14]; // 风: run and swing
export const GUARD = [0.03, 0.04, 0.05, 0.06, 0.08]; // 土: less damage taken
export const LEECH = [0.03, 0.04, 0.05, 0.06, 0.07]; // 木
export const QI = [0.1, 0.15, 0.2, 0.25, 0.3]; // 水: inner strength comes back quicker
export const CRIT = [0.08, 0.1, 0.12, 0.15, 0.18]; // 金

export const fwId = (el: El, n: number) => `fw:${el}:${n}`;
export function parseFw(id: string | undefined | null): { el: El; n: number } | null {
  if (!id || !id.startsWith('fw:')) return null;
  const [, el, n] = id.split(':');
  return EL[el as El] && +n >= 1 && +n <= 5 ? { el: el as El, n: +n } : null;
}

// ---------------------------------------------------------------- the houses: their element, their weapon's shape
/** each house's own element (本命): its weapons of that element strike harder (共鸣). Each line is one kind of weapon
 * (LINE_FORM), and a house's own line is the kind it holds, so after 转职 its 本命 line climbs in its own hands */
export const AFFINITY: Record<string, El> = {
  kuangren: 'metal', shuangdao: 'metal', jiaoyi: 'metal',
  dixian: 'wood', yushou: 'wood',
  qinshi: 'water',
  qiangwang: 'fire',
  fanyin: 'earth', quanshi: 'earth', qizong: 'earth',
  tianzi: 'thunder', fushi: 'thunder', jiguan: 'thunder',
  gongshou: 'wind',
  jianke: 'ice',
  yingren: 'venom', duzong: 'venom', anqi: 'venom',
};
export const RESONANCE = 1.25;
export type Form = 'jian' | 'dao' | 'bi' | 'qiang' | 'zhang' | 'gong' | 'nu' | 'qin' | 'wan' | 'xia';
/** what each element's line is: 金 a saber, 木 a staff, 水 a guqin, 火 a spear, 土 gauntlets, 雷 and 冰 swords, 风 a bow,
 * 毒 daggers (the owner's Tripo models, FW_ART, follow this) */
export const LINE_FORM: Record<El, Form> = { metal: 'dao', wood: 'zhang', water: 'qin', fire: 'qiang', earth: 'wan', thunder: 'jian', wind: 'gong', ice: 'jian', venom: 'bi' };
/** what a house's forged weapon is (the 散人, no house, carries a 剑) */
export const FORM_OF: Record<string, Form> = {
  kuangren: 'dao', anqi: 'bi', fanyin: 'wan', yingren: 'bi', tianzi: 'jian', jiaoyi: 'xia', dixian: 'zhang',
  jianke: 'jian', qiangwang: 'qiang', quanshi: 'wan', fushi: 'jian', qinshi: 'qin', yushou: 'zhang', duzong: 'bi',
  gongshou: 'gong', shuangdao: 'dao', qizong: 'wan', jiguan: 'nu',
};
export const FORM_NAME: Record<Form, string> = { jian: '剑', dao: '刀', bi: '匕', qiang: '枪', zhang: '杖', gong: '弓', nu: '弩', qin: '琴', wan: '护腕', xia: '匣' };
/** houses that hold one in each hand */
export const PAIRED = new Set(['kuangren', 'shuangdao', 'anqi', 'yingren', 'duzong']);
export const formOf = (house: string | null | undefined): Form => (house ? FORM_OF[house] ?? 'jian' : 'jian');
/** does this body hold the line's own model (a house whose weapon is that kind; a 散人 any one handed blade)? */
export function holdsLine(house: string | null | undefined, el: El) {
  const f = LINE_FORM[el];
  return house ? FORM_OF[house] === f : f === 'jian' || f === 'dao' || f === 'bi';
}
/** a forged weapon's name: 断金刀, 焚天枪 (a pair for the houses that hold one in each hand: 断金双刀) */
export function fwName(el: El, n: number, house: string | null | undefined) {
  const f = LINE_FORM[el];
  return EL[el].names[n - 1] + (house && PAIRED.has(house) && FORM_OF[house] === f ? '双' : '') + FORM_NAME[f];
}

/** the forged weapons that have their Tripo model (public/models/fw-<el>-<n>.glb, a picture portraits/fw-<el>-<n>.png):
 * laid out like weapons.ts PW (long axis by PCA, the grip as a fraction from the lo end) */
export const FW_ART: Record<string, { file: string; dir: [number, number, number]; c: [number, number, number]; lo: number; hi: number; blade: 1 | -1; grip: number; len: number }> = {
  'metal:2': { file: 'fw-metal-2.glb', dir: [-0.6506, -0.6301, 0.424], c: [0.0378, 0.5266, -0.009], lo: -0.6615, hi: 0.8111, blade: 1, grip: 0.14, len: 0.95 },
};
export const fwArt = (el: El, n: number) => FW_ART[`${el}:${n}`];
