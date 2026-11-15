// 衣柜 (owner: the clothes stalls should sell clothes your 散人 can wear, with a screen to dress in): four places to
// dress (衣 a dyed robe, 头 a hat or crown, 披 a cloak, 腰 a belt and what hangs from it). Bought from the cloth and
// sundries sellers, kept in progress.ward (owned, worn), drawn by render/Rig (the robe as a dye over the clothes, the
// rest as pieces worn on the bones), chosen in ui/Wardrobe.tsx (C, or 看衣裳 at a seller).
import type { Progress } from './progress';

export type Slot = 'robe' | 'hat' | 'cloak' | 'belt';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'robe', name: '衣' },
  { id: 'hat', name: '头' },
  { id: 'cloak', name: '披' },
  { id: 'belt', name: '腰' },
];
export type HatShape = 'douli' | 'crown' | 'scarf' | 'felt' | 'veil';
export type BeltShape = 'cloth' | 'jade' | 'gold' | 'gourd';
export interface Garment {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  /** the colours: a robe's light and dark cloth; a piece's main and its trim */
  a: string;
  b: string;
  shape?: HatShape | BeltShape | 'cloak' | 'fur';
  note: string;
}

export const GARMENTS: Garment[] = [
  // robes: the clothes dyed (skin and hair stay)
  { id: 'robe-qing', name: '青衫', slot: 'robe', price: 60, a: '#4f8a87', b: '#1d3a3b', note: '书生和剑客都爱的青色，耐脏。' },
  { id: 'robe-bai', name: '白衣胜雪', slot: 'robe', price: 120, a: '#e8e4da', b: '#8d887c', note: '一身白，走到哪都显眼，也最难打理。' },
  { id: 'robe-xuan', name: '玄色夜行衣', slot: 'robe', price: 90, a: '#2b2b33', b: '#0d0d12', note: '黑里透青，夜里看不见人。' },
  { id: 'robe-fei', name: '绯色劲装', slot: 'robe', price: 100, a: '#a83a32', b: '#4f1614', note: '红得像火，打架的时候看着就凶。' },
  { id: 'robe-zi', name: '紫绶锦袍', slot: 'robe', price: 180, a: '#7a4f9a', b: '#33204a', note: '紫是贵气，掌柜说京城的公子都穿这个。' },
  { id: 'robe-ma', name: '粗麻短褐', slot: 'robe', price: 20, a: '#b3a07a', b: '#5e5240', note: '庄稼人的衣裳，结实，不怕刮。' },
  { id: 'robe-jin', name: '金缕战袍', slot: 'robe', price: 360, a: '#d9b04a', b: '#6b4e12', note: '金线织的，太阳底下晃眼。' },
  { id: 'robe-mo', name: '墨竹长衫', slot: 'robe', price: 140, a: '#5d6b58', b: '#1f2a1e', note: '淡墨染的竹叶纹，文雅。' },
  // hats
  { id: 'hat-douli', name: '竹斗笠', slot: 'hat', price: 25, a: '#c9a96a', b: '#6b5432', shape: 'douli', note: '遮雨遮阳，走江湖的标配。' },
  { id: 'hat-veil', name: '纱帘斗笠', slot: 'hat', price: 80, a: '#3a3330', b: '#e8e4da', shape: 'veil', note: '垂着一圈白纱，谁也看不清你的脸。' },
  { id: 'hat-crown', name: '白玉发冠', slot: 'hat', price: 150, a: '#e9efe6', b: '#b8902f', shape: 'crown', note: '束发用的玉冠，配一根金簪。' },
  { id: 'hat-scarf', name: '儒生方巾', slot: 'hat', price: 40, a: '#2e3b4a', b: '#1a222b', shape: 'scarf', note: '读书人戴的方巾。' },
  { id: 'hat-felt', name: '狐皮毡帽', slot: 'hat', price: 70, a: '#8a5a32', b: '#e8dcc8', shape: 'felt', note: '雪岭上的猎户都戴，暖和。' },
  // cloaks
  { id: 'cloak-qing', name: '青布披风', slot: 'cloak', price: 70, a: '#3d6e6a', b: '#1d3a3b', shape: 'cloak', note: '一领青披风，风一吹就飘起来。' },
  { id: 'cloak-hei', name: '黑绒大氅', slot: 'cloak', price: 130, a: '#1d1d22', b: '#7a1f1f', shape: 'cloak', note: '黑面红里，侠客出场都穿这个。' },
  { id: 'cloak-hong', name: '猩红斗篷', slot: 'cloak', price: 160, a: '#9c1f22', b: '#e2c27a', shape: 'cloak', note: '红得扎眼，金线锁边。' },
  { id: 'cloak-hu', name: '白狐裘', slot: 'cloak', price: 300, a: '#f1ede4', b: '#cfc6b4', shape: 'fur', note: '整张白狐皮，雪地里披着不冷。' },
  // belts
  { id: 'belt-bu', name: '布腰带', slot: 'belt', price: 10, a: '#6b5432', b: '#3a2c18', shape: 'cloth', note: '扎紧了好使劲。' },
  { id: 'belt-yu', name: '白玉腰带', slot: 'belt', price: 120, a: '#2a2a2a', b: '#e9efe6', shape: 'jade', note: '黑革缀着白玉扣。' },
  { id: 'belt-jin', name: '鎏金带', slot: 'belt', price: 200, a: '#b8902f', b: '#5c4410', shape: 'gold', note: '金光闪闪，有钱人系的。' },
  { id: 'belt-hulu', name: '酒葫芦', slot: 'belt', price: 35, a: '#6b4a24', b: '#c9a96a', shape: 'gourd', note: '腰间挂个葫芦，装满了杏娘的酒。' },
];
export const garment = (id: string | undefined) => GARMENTS.find((g) => g.id === id);

/** who sells what (their 看衣裳 button opens the wardrobe at their stall) */
export const WARD_SHOPS: Record<string, Slot[]> = {
  '绸缎庄 · 苏娘子': ['robe', 'cloak'],
  '绣娘 · 阿秀': ['robe', 'belt'],
  '货郎 · 钱小二': ['hat', 'belt'],
  '胭脂铺 · 柳嫂': ['hat'],
};

export interface Ward {
  owned: string[];
  worn: Partial<Record<Slot, string>>;
}
export function ward(P: Progress): Ward {
  const p = P as any;
  p.ward ??= { owned: [], worn: {} };
  return p.ward as Ward;
}
export const owns = (P: Progress, id: string) => ward(P).owned.includes(id);
/** buy (and put it on); false if you can't afford it */
export function buyGarment(P: Progress, id: string) {
  const g = garment(id);
  if (!g || owns(P, id)) return false;
  const coins = P.coins ?? 0;
  if (coins < g.price) return false;
  P.coins = coins - g.price;
  ward(P).owned.push(id);
  ward(P).worn[g.slot] = id;
  return true;
}
export function wear(P: Progress, slot: Slot, id: string | undefined) {
  const w = ward(P);
  if (id && !w.owned.includes(id)) return;
  if (id) w.worn[slot] = id;
  else delete w.worn[slot];
}
/** a key that changes whenever what you wear changes (Rig rebuilds the pieces on it) */
export const wornKey = (P: Progress) => JSON.stringify(ward(P).worn);
