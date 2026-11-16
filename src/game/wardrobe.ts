// 衣柜 (owner: design the clothes the 散人 can wear, properly). Four places to dress:
//   衣装  a whole outfit: each is its own body (a Tripo model of the 散人 in it, borrowing his clips and weapons);
//         some bring their own hat or cape
//   头饰  a hat over a bare-headed outfit
//   披风  a cloak (render/outfit.ts hangs it as cloth that swings and blows)
//   佩挂  something hung at the hip: a purse, a jade, a token, a gourd, a sachet
// Sold by the cloth, sundry and craft folk (and a few odd ones: the night clothes come from 钱八, the furs from the
// hunter, the armour from the smith), kept in progress.ward (owned, worn), chosen in ui/Games.tsx Wardrobe (C, or
// 看衣裳 when talking to a seller). Clothes are for looks; two have a small use (warm on 雪岭, dark at night).
import type { Progress } from './progress';

export type Slot = 'robe' | 'hat' | 'cloak' | 'belt';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'robe', name: '衣装' },
  { id: 'hat', name: '头饰' },
  { id: 'cloak', name: '披风' },
  { id: 'belt', name: '佩挂' },
];
export type HatShape = 'douli' | 'crown' | 'scarf' | 'felt' | 'veil';
export type HangShape = 'purse' | 'jade' | 'token' | 'gourd' | 'sachet';
export type Perk = 'warm' | 'dark';
export interface Garment {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  /** its colours (a piece's main and its trim; an outfit's for the swatch) */
  a: string;
  b: string;
  shape?: HatShape | HangShape | 'cloak' | 'fur';
  note: string;
  /** an outfit's own body; none: the clothes he set out in */
  body?: string;
  /** its picture in the wardrobe (public/portraits) */
  pic?: string;
  /** the outfit brings its own hat (no 头饰 over it) / its own cape (no 披风 over it) */
  hat?: boolean;
  cape?: boolean;
  /** carries a pack on the back (the bedroll): no cloak goes over it */
  pack?: boolean;
  perk?: Perk;
  /** who sells it (talk to them, 看衣裳) */
  sellers: string[];
  /** worn from the start, never bought */
  start?: boolean;
}
export const PERK_TEXT: Record<Perk, string> = {
  warm: '雪岭上寒气涨得慢一半',
  dark: '夜里山贼和刺客要走得更近才发现你',
};

const SU = '绸缎庄 · 苏娘子', XIU = '绣娘 · 阿秀', QIAN2 = '货郎 · 钱小二', LIU = '胭脂铺 · 柳嫂', QIAN8 = '赌客 · 钱八', HAN = '猎户 · 韩老三', SHEN = '雪岭 · 老参客', ZHANG = '铁匠 · 张大锤';

export const GARMENTS: Garment[] = [
  // ---- 衣装: whole outfits
  { id: 'robe-ma', name: '粗麻短褐', slot: 'robe', price: 0, a: '#cfc3a6', b: '#5e5240', start: true, pack: true, pic: 'ward-robe-ma.png', sellers: [], note: '离家时穿的粗麻衣裳，背着铺盖卷，走到哪睡到哪。结实，不怕刮。' },
  { id: 'robe-qing', name: '青衫', slot: 'robe', price: 120, a: '#4f8a87', b: '#1d3a3b', body: 'wanderer-qingshan.glb', pic: 'ward-robe-qing.png', sellers: [SU], note: '青布长衫，月白里领，腰间藏青绦带垂一块白玉佩。读书人穿它赶考，剑客穿它走江湖。' },
  { id: 'robe-fei', name: '绯色劲装', slot: 'robe', price: 150, a: '#a83a32', b: '#2a1714', body: 'wanderer-jinzhuang.glb', pic: 'ward-robe-fei.png', sellers: [XIU], note: '绯红短打，牛皮铜钉护腕，黑布绑腿，头上一条红抹额。打起架来袖子不碍事。' },
  { id: 'robe-xuan', name: '夜行衣', slot: 'robe', price: 180, a: '#2b2b33', b: '#0d0d12', body: 'wanderer-yexing.glb', pic: 'ward-robe-xuan.png', perk: 'dark', sellers: [QIAN8], note: '从头黑到脚，面巾往上一拉谁也认不出。腰带里插着一排飞刀。钱八说这身是他「朋友」的。' },
  { id: 'robe-suo', name: '蓑衣斗笠', slot: 'robe', price: 60, a: '#8a6a44', b: '#c9a96a', body: 'wanderer-suoyi.glb', pic: 'ward-robe-suo.png', hat: true, cape: true, sellers: [QIAN2], note: '棕丝蓑衣，竹编斗笠，草鞋绑腿。一蓑烟雨任平生，下雨天走江湖就这一身最自在。' },
  { id: 'robe-dao', name: '云游道袍', slot: 'robe', price: 160, a: '#2f3f63', b: '#e8e2cf', body: 'wanderer-daopao.glb', pic: 'ward-robe-dao.png', sellers: [SU], note: '藏青道袍，白领宽袖，杏黄丝绦，头戴乌木莲花冠。往山门前一站，人都当你是哪座观里的道长。' },
  { id: 'robe-qiu', name: '猎户皮袄', slot: 'robe', price: 200, a: '#7a5634', b: '#e8dcc8', body: 'wanderer-piqiu.glb', pic: 'ward-robe-qiu.png', hat: true, perk: 'warm', sellers: [HAN, SHEN], note: '羊皮袄子毛朝里，狐皮帽子护着耳朵，腰挎猎刀。韩老三说穿它上雪岭，冷得慢一半。' },
  { id: 'robe-bai', name: '白衣胜雪', slot: 'robe', price: 260, a: '#ece8de', b: '#9aa3ad', body: 'wanderer-baiyi.glb', pic: 'ward-robe-bai.png', sellers: [SU], note: '雪白绸袍，袖口衣摆银线绣云，白玉腰带。走到哪都有人回头看，就是最难打理。' },
  { id: 'robe-zi', name: '紫绶锦袍', slot: 'robe', price: 380, a: '#6a3f8a', b: '#d4ae4a', body: 'wanderer-jinpao.glb', pic: 'ward-robe-zi.png', sellers: [SU], note: '紫锦织金，云鹤满身，玉銙腰带，头上一顶小金冠。苏娘子说京城的公子爷都穿这个。' },
  { id: 'robe-jin', name: '将门轻甲', slot: 'robe', price: 480, a: '#5a3a22', b: '#a83a32', body: 'wanderer-qingjia.glb', pic: 'ward-robe-jin.png', sellers: [ZHANG], note: '皮甲缀铜片，衬着绯袍，铜肩吞口，狮面带扣。张大锤照着边军将官的样子打的，穿上像个少年将军。' },
  // ---- 头饰 (over a bare-headed outfit)
  { id: 'hat-douli', name: '竹斗笠', slot: 'hat', price: 25, a: '#c9a96a', b: '#6b5432', shape: 'douli', sellers: [QIAN2], note: '细篾编的斗笠，遮雨遮阳，走江湖的标配。' },
  { id: 'hat-veil', name: '纱帘斗笠', slot: 'hat', price: 80, a: '#3a3330', b: '#e8e4da', shape: 'veil', sellers: [LIU], note: '斗笠垂一圈白纱，风一吹才看得见脸。' },
  { id: 'hat-scarf', name: '儒生方巾', slot: 'hat', price: 40, a: '#2e3b4a', b: '#1a222b', shape: 'scarf', sellers: [QIAN2], note: '读书人戴的方巾，脑后垂两根带子。' },
  { id: 'hat-crown', name: '白玉发冠', slot: 'hat', price: 150, a: '#e9efe6', b: '#b8902f', shape: 'crown', sellers: [LIU], note: '羊脂白玉的莲花冠，横一根金簪。' },
  { id: 'hat-felt', name: '狐皮毡帽', slot: 'hat', price: 70, a: '#8a5a32', b: '#e8dcc8', shape: 'felt', sellers: [HAN], note: '雪岭上的猎户都戴，护耳朵，暖和。' },
  // ---- 披风
  { id: 'cloak-qing', name: '青布披风', slot: 'cloak', price: 70, a: '#3d6e6a', b: '#c9d4cf', shape: 'cloak', sellers: [SU], note: '一领青布披风，风一吹就扬起来。' },
  { id: 'cloak-hei', name: '黑绒大氅', slot: 'cloak', price: 130, a: '#1d1d22', b: '#7a1f1f', shape: 'cloak', sellers: [SU], note: '黑面红里，走起来里子一翻，侠客出场都穿这个。' },
  { id: 'cloak-hong', name: '猩红斗篷', slot: 'cloak', price: 160, a: '#9c1f22', b: '#e2c27a', shape: 'cloak', sellers: [SU], note: '红得扎眼，金线锁边，雪地里老远就看得见。' },
  { id: 'cloak-hu', name: '白狐裘', slot: 'cloak', price: 300, a: '#f1ede4', b: '#cfc6b4', shape: 'fur', perk: 'warm', sellers: [HAN], note: '整张白狐皮缝的大裘，毛领围着脖子。雪地里披着不冷。' },
  // ---- 佩挂 (at the right hip)
  { id: 'belt-bu', name: '布钱袋', slot: 'belt', price: 10, a: '#6b5432', b: '#c0392b', shape: 'purse', sellers: [QIAN2], note: '粗布缝的钱袋，红绳扎口，铜钱叮当响。' },
  { id: 'belt-xiang', name: '绣香囊', slot: 'belt', price: 30, a: '#2f6f5e', b: '#e2c27a', shape: 'sachet', sellers: [XIU], note: '阿秀绣的香囊，装着艾草和丁香，驱蚊。' },
  { id: 'belt-hulu', name: '酒葫芦', slot: 'belt', price: 35, a: '#b8843e', b: '#c0392b', shape: 'gourd', sellers: [QIAN2], note: '腰间挂个葫芦，灌满了杏娘的酒。' },
  { id: 'belt-yu', name: '白玉佩', slot: 'belt', price: 120, a: '#e9efe6', b: '#c0392b', shape: 'jade', sellers: [XIU], note: '一块白玉环佩，红丝穗子，走起路来轻轻晃。' },
  { id: 'belt-jin', name: '鎏金令牌', slot: 'belt', price: 200, a: '#c99a36', b: '#6b1a1a', shape: 'token', sellers: [ZHANG], note: '鎏金的铜令牌，正面一个「侠」字，背后是你的名字。' },
];
export const garment = (id: string | undefined) => GARMENTS.find((g) => g.id === id);

/** who sells what: a seller's 看衣裳 lists only theirs */
export const WARD_SHOPS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const g of GARMENTS) for (const s of g.sellers) (out[s] ??= []).push(g.id);
  return out;
})();

export interface Ward {
  owned: string[];
  worn: Partial<Record<Slot, string>>;
}
/** the wardrobe in a save (older saves: the dyed robes became whole outfits, 墨竹长衫 the 青衫, the belts things that
 * hang at the hip) */
export function ward(P: Progress): Ward {
  const p = P as any;
  p.ward ??= { owned: [], worn: {} };
  const w = p.ward as Ward;
  if (!(p.ward as any).v2) {
    (p.ward as any).v2 = true;
    w.owned = [...new Set(w.owned.map((id) => (id === 'robe-mo' ? 'robe-qing' : id)).filter((id) => garment(id) && !garment(id)!.start))];
    if (w.worn.robe === 'robe-mo') w.worn.robe = 'robe-qing';
    // whatever no longer exists, sits in the wrong place or isn't owned comes off
    for (const slot of Object.keys(w.worn) as Slot[]) {
      const g = garment(w.worn[slot]);
      if (!g || g.start || g.slot !== slot || !w.owned.includes(g.id)) delete w.worn[slot];
    }
  }
  return w;
}
export const owns = (P: Progress, id: string) => !!garment(id)?.start || ward(P).owned.includes(id);
/** buy (and put it on); false if you can't afford it */
export function buyGarment(P: Progress, id: string) {
  const g = garment(id);
  if (!g || owns(P, id)) return false;
  const coins = P.coins ?? 0;
  if (coins < g.price) return false;
  P.coins = coins - g.price;
  ward(P).owned.push(id);
  wear(P, g.slot, id);
  return true;
}
export function wear(P: Progress, slot: Slot, id: string | undefined) {
  const w = ward(P);
  const g = garment(id);
  if (id && !owns(P, id)) return;
  if (!g || g.start) delete w.worn[slot];
  else w.worn[slot] = id;
}
/** the outfit on now (the 粗麻 he set out in when none) */
export const outfitOf = (P: Progress) => garment(ward(P).worn.robe) ?? GARMENTS[0];
/** what's worn and shows: a hat over an outfit with its own is put away, so is a cloak over a cape */
export function shown(P: Progress): Partial<Record<Slot, string>> {
  const w = ward(P).worn, o = outfitOf(P);
  return { robe: w.robe, hat: o.hat ? undefined : w.hat, cloak: o.cape || o.pack ? undefined : w.cloak, belt: w.belt };
}
/** why a piece can't show over this outfit (for the panel) */
export function hidden(P: Progress, slot: Slot): string | null {
  const o = outfitOf(P);
  if (slot === 'hat' && o.hat) return `${o.name}自带帽子，头饰先收着`;
  if (slot === 'cloak' && o.cape) return `${o.name}自带蓑衣，披风先收着`;
  if (slot === 'cloak' && o.pack) return '背上捆着铺盖卷，披风没处搭，换身衣裳再披';
  return null;
}
/** a small use of what you wear */
export const hasPerk = (P: Progress, perk: Perk) => Object.values(shown(P)).some((id) => garment(id)?.perk === perk);
/** the body the 散人 wears now (his own when none) */
export const outfitBody = (P: Progress) => outfitOf(P).body;
/** a key that changes whenever what shows changes (Rig rebuilds the pieces on it) */
export const wornKey = (P: Progress) => JSON.stringify(shown(P));

/** what folk say about how you're dressed (the dialog mixes these into their remarks) */
const OUTFIT_TALK: Record<string, string[]> = {
  'robe-qing': ['这位相公一身青衫，是进京赶考的吧？', '青衫配玉佩，好个读书人。'],
  'robe-fei': ['一身红，看着就能打。', '这身劲装利落，是练家子吧？'],
  'robe-xuan': ['大白天穿一身黑，你这是要去做贼？', '这身黑衣裳，夜里走路可别吓着人。'],
  'robe-suo': ['好一身蓑衣，下雨也不怕了。', '斗笠压得这么低，我还以为是哪来的渔翁。'],
  'robe-dao': ['道长，给我看看手相？', '这位道长从哪座山上下来的？'],
  'robe-qiu': ['穿这么厚，是要上雪岭吧？', '这皮袄好，雪岭的风都吹不透。'],
  'robe-bai': ['好一身白衣，跟画里走出来的似的。', '这么白的衣裳，可别溅上泥。'],
  'robe-zi': ['哟，哪家的公子爷？', '这身紫袍，怕是比县太爷的还贵。'],
  'robe-jin': ['小将军，边关打完仗回来了？', '这身甲穿上，山贼见了都得绕着走。'],
};
export const outfitTalk = (P: Progress) => OUTFIT_TALK[outfitOf(P).id] ?? [];
