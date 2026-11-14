// The things to do in the village and at court, as data: money (铜钱), what each stall sells, what folk wish for
// (委托: bring it, get paid), fish, lantern riddles, the imperial exam, the cases at the drum, and the court debates.
// Pure data; sim.ts carries it out, ui/Games.tsx and ui/Dialog.tsx show it.

export type ItemKind = 'food' | 'service' | 'keep' | 'tool' | 'fish' | 'catch' | 'mat' | 'game';
export interface Item {
  id: string;
  name: string;
  /** price at a stall (in 文); what a buyer pays is a third to a half of it */
  price: number;
  kind: ItemKind;
  desc: string;
}
export const ITEMS: Record<string, Item> = {
  noodle: { id: 'noodle', name: '热汤面', price: 8, kind: 'food', desc: '一大碗，回六成气血' },
  peach: { id: 'peach', name: '鲜桃', price: 2, kind: 'keep', desc: '甜，回一点气血，也能送人' },
  tanghulu: { id: 'tanghulu', name: '糖葫芦', price: 3, kind: 'keep', desc: '吃了脚下生风（跑得快一阵），孩子们最爱' },
  tea: { id: 'tea', name: '清茶', price: 4, kind: 'food', desc: '回两成气血，顺便听一段书' },
  wine: { id: 'wine', name: '杏花酿', price: 12, kind: 'keep', desc: '喝了气血慢慢回，也是好礼' },
  mooncake: { id: 'mooncake', name: '月饼', price: 6, kind: 'food', desc: '中秋才有，回满气血' },
  plaster: { id: 'plaster', name: '金疮药', price: 15, kind: 'keep', desc: '随身带着，按 H 敷上回满气血' },
  whet: { id: 'whet', name: '磨刀', price: 20, kind: 'service', desc: '三分钟内伤害提高一成半' },
  lantern: { id: 'lantern', name: '红灯笼', price: 10, kind: 'tool', desc: '夜里提着，照亮身边' },
  thrush: { id: 'thrush', name: '画眉鸟', price: 60, kind: 'tool', desc: '跟着你飞，时不时唱两句' },
  book: { id: 'book', name: '《江湖杂记》', price: 25, kind: 'keep', desc: '读一读，长些见识（经验）' },
  rouge: { id: 'rouge', name: '桃花胭脂', price: 20, kind: 'keep', desc: '宫里同款，送姑娘家' },
  silk: { id: 'silk', name: '一匹绸缎', price: 40, kind: 'keep', desc: '柳三娘织的，城里卖三倍价' },
  jar: { id: 'jar', name: '腌菜坛子', price: 6, kind: 'keep', desc: '摔不烂的瓦罐' },
  // what you catch
  crucian: { id: 'crucian', name: '鲫鱼', price: 6, kind: 'fish', desc: '河里最常见' },
  grass: { id: 'grass', name: '草鱼', price: 9, kind: 'fish', desc: '肉厚，面摊爱收' },
  carp: { id: 'carp', name: '鲤鱼', price: 12, kind: 'fish', desc: '红尾巴，过年要吃' },
  eel: { id: 'eel', name: '黄鳝', price: 16, kind: 'fish', desc: '下雨天才出来' },
  mandarin: { id: 'mandarin', name: '鳜鱼', price: 24, kind: 'fish', desc: '桃花流水鳜鱼肥' },
  goldcarp: { id: 'goldcarp', name: '金鲤', price: 120, kind: 'fish', desc: '传说夜里才露头，见者有福' },
  shrimp: { id: 'shrimp', name: '河虾', price: 8, kind: 'fish', desc: '夏天河边一抓一把' },
  crab: { id: 'crab', name: '螃蟹', price: 20, kind: 'fish', desc: '秋风起，蟹脚痒' },
  sturgeon: { id: 'sturgeon', name: '冰下鲟', price: 60, kind: 'fish', desc: '冬天凿冰才钓得到' },
  // what the smith works (jianghu.ts), and what the hunt brings home
  iron: { id: 'iron', name: '铁料', price: 6, kind: 'mat', desc: '山贼身上搜来的，铁匠用得着' },
  hide: { id: 'hide', name: '兽皮', price: 8, kind: 'mat', desc: '打猎得的，做皮甲靴子' },
  xuan: { id: 'xuan', name: '玄铁', price: 40, kind: 'mat', desc: '头目和悬赏犯身上才有，打好兵器离不了' },
  venison: { id: 'venison', name: '鹿肉', price: 14, kind: 'game', desc: '酒楼、面摊都收，也能送人' },
  hare: { id: 'hare', name: '野兔', price: 8, kind: 'game', desc: '烤着吃最香' },
  bow: { id: 'bow', name: '猎弓', price: 50, kind: 'tool', desc: '面朝猎物（26 米内）按 F 射猎；秋天收获加倍' },
  firefly: { id: 'firefly', name: '萤火虫', price: 3, kind: 'keep', desc: '夏夜水边抓的，孩子们最喜欢' },
  tofu: { id: 'tofu', name: '豆花', price: 4, kind: 'food', desc: '嫩，回三成气血' },
  feast: { id: 'feast', name: '一桌酒席', price: 30, kind: 'food', desc: '回满气血，三分钟里慢慢回血' },
  herb: { id: 'herb', name: '血参', price: 24, kind: 'catch', desc: '野外长的红参，御医收' },
  lotus: { id: 'lotus', name: '天山雪莲', price: 70, kind: 'catch', desc: '雪岭高处才有，能续断骨；孙伯、御医和雪岭营地都收' },
  ginger: { id: 'ginger', name: '姜汤', price: 6, kind: 'food', desc: '雪岭营地的，一碗下肚好一阵不怕冷，回两成气血' },
  hen: { id: 'hen', name: '芦花鸡', price: 0, kind: 'catch', desc: '王婆婆跑丢的那只' },
};

/** who sells what (by the folk's name) */
export const SHOPS: Record<string, string[]> = {
  '菜农 · 老刘': ['peach'],
  '面摊 · 胖大海': ['noodle'],
  '糖葫芦 · 小石头': ['tanghulu'],
  '云游道人 · 卖药': ['plaster'],
  '卖刀的 · 屠铁塔': ['whet'],
  '灯笼匠 · 胡老爹': ['lantern'],
  '雪岭 · 老参客': ['ginger', 'plaster'],
  '鸟贩 · 八哥张': ['thrush'],
  '书摊 · 老夫子': ['book'],
  '胭脂铺 · 柳嫂': ['rouge'],
  '绸缎庄 · 苏娘子': ['silk'],
  '窑工 · 陶三': ['jar'],
  '酒肆掌柜 · 杏娘': ['wine'],
  '茶博士': ['tea'],
  '跑堂 · 小六子': ['noodle', 'wine'],
  '猎户 · 韩老三': ['bow'],
  '豆腐坊 · 孙二娘': ['tofu'],
  '货郎 · 钱小二': ['plaster', 'lantern', 'jar'],
  '药铺 · 白掌柜': ['plaster'],
  '酒楼 · 何掌柜': ['feast', 'wine'],
  '绣娘 · 阿秀': ['silk', 'rouge'],
};
/** who buys your catch, and of what kinds */
export const BUYERS: Record<string, ItemKind[]> = {
  '渔翁 · 老钓': ['fish'],
  '面摊 · 胖大海': ['fish'],
  '御医 · 钱济生': ['catch'],
  '猎户 · 韩老三': ['game', 'mat'],
  '雪岭 · 老参客': ['catch', 'mat', 'game'],
  '酒楼 · 何掌柜': ['game', 'fish'],
};

/** 委托: folk who wish for something; bring it and they reward you (once each) */
export interface Want {
  folk: string;
  item: string;
  coins: number;
  xp: number;
  /** where to find them, for the notice board */
  where: string;
  ask: string;
  thanks: string;
  /** a name the deed earns you */
  title?: string;
}
export const WANTS: Want[] = [
  { folk: '药农 · 孙伯', item: 'lotus', coins: 150, xp: 220, where: '村里孙家', ask: '雪线上有一种白花，叫天山雪莲，能续断骨。我这把老骨头爬不上去了……你从雪岭营地的传送阵上去，高处的雪地里找找，夜里它会发一点光。', thanks: '是它！花瓣上的冰都还没化。这一朵够救三个摔断腿的樵夫了。好孩子，这些铜板你拿着。' },
  { folk: '小丫头 · 糖糖', item: 'tanghulu', coins: 10, xp: 30, where: '青石集', ask: '我想吃糖葫芦，可是娘不给钱……', thanks: '甜！比我娘做的还甜！我长大了也要当大侠！' },
  { folk: '王婆婆', item: 'hen', coins: 40, xp: 60, where: '村里王家', ask: '我那只芦花鸡又跑了，满村子乱窜。你腿脚快，帮我逮回来？（村里的鸡跑得快，悄悄靠近再按 F）', thanks: '哎呀我的芦花鸡！就数它下蛋最勤。好孩子，婆婆给你攒的铜板，拿着。' },
  { folk: '樵夫 · 老周', item: 'noodle', coins: 15, xp: 30, where: '村里（白天上山）', ask: '砍了一天柴，就想吃胖大海那碗热汤面……', thanks: '就是这个味儿！吃饱了，明天多砍一担。' },
  { folk: '更夫', item: 'lantern', coins: 20, xp: 40, where: '村里（夜里打更）', ask: '我的灯笼让风吹破了，黑灯瞎火的怎么打更？', thanks: '有灯就好，有灯就好。夜里你要是看见什么怪事，来跟我说。' },
  { folk: '小少爷', item: 'book', coins: 30, xp: 40, where: '清风茶楼', ask: '我爹不让我看闲书，你能帮我买本《江湖杂记》吗？', thanks: '嘘！别告诉我爹。等我看完了，借你看。' },
  { folk: '顽童 · 狗蛋', item: 'tanghulu', coins: 6, xp: 20, where: '永安城外', ask: '我姐跳舞挣的钱都给我买药了，我好久没吃过糖了。', thanks: '嘿嘿，我分我姐一半！' },
  { folk: '长公主 · 萧清徽', item: 'rouge', coins: 80, xp: 120, where: '永安城宫中', ask: '宫外头柳嫂家的桃花胭脂……我出不了宫，你能替我买一盒吗？', thanks: '是这个颜色。母后从前也用这个。……谢谢你，这份情我记着。', title: '公主的朋友' },
  { folk: '御医 · 钱济生', item: 'herb', coins: 60, xp: 80, where: '永安城宫中', ask: '丞相的病，要一味血参做药引。宫里的都是假货，野外山坡上才有真的，夜里会发红光。', thanks: '是真血参！丞相有救了。这点诊金你拿着，以后头疼脑热来找我。' },
  { folk: '渔翁 · 老钓', item: 'goldcarp', coins: 150, xp: 150, where: '村外河边', ask: '我钓了四十年鱼，就想再见一回金鲤。听说雨夜里才露头。', thanks: '金鲤！……四十年了。放了吧，它是河神的孩子。这钱你拿着，你比我有福。', title: '钓得金鲤' },
  { folk: '镇国大将军 · 霍铮', item: 'wine', coins: 50, xp: 80, where: '永安城宫中', ask: '宫里的酒没滋味。听说青石村杏娘酿的杏花酿，当年七家的人最爱喝。', thanks: '就是这个……当年我跟七家的人对饮，喝的也是这个。来，陪我喝一口。', title: '将军的酒友' },
  { folk: '学童 · 小满', item: 'firefly', coins: 12, xp: 30, where: '村里祠堂', ask: '先生讲囊萤夜读，我也想要一袋萤火虫……夏天夜里水边才有。', thanks: '亮了亮了！今晚我也要囊萤夜读！' },
  { folk: '王老汉', item: 'jar', coins: 12, xp: 20, where: '村里王家', ask: '老婆子腌菜的坛子让我打碎了，可别让她知道……', thanks: '一模一样！嘿嘿，她看不出来。' },
  { folk: '宫女 · 碧桃', item: 'tanghulu', coins: 8, xp: 20, where: '永安城宫中', ask: '外头的糖葫芦……我进宫以后再没吃过。', thanks: '就是这个味道！我想起我娘了。' },
];

/** fish by when and where: [item, weight, when it bites] */
export type FishWhen = (c: { season: number; night: boolean; rain: boolean }) => boolean;
export const FISH: [string, number, FishWhen][] = [
  ['crucian', 10, () => true],
  ['grass', 6, (c) => c.season !== 3],
  ['carp', 4, () => true],
  ['eel', 6, (c) => c.rain],
  ['mandarin', 3, (c) => c.season === 0 || c.season === 2],
  ['goldcarp', 1.2, (c) => c.night && c.rain],
  ['shrimp', 6, (c) => c.season === 1],
  ['crab', 4, (c) => c.season === 2],
  ['sturgeon', 1.5, (c) => c.season === 3],
];

/** a question with three answers (the first is right; the game shuffles them) */
export interface Quiz {
  q: string;
  a: [string, string, string];
  /** said after */
  why?: string;
}
/** 灯谜 (riddles on the characters) */
export const RIDDLES: Quiz[] = [
  { q: '一口咬掉牛尾巴（打一字）', a: ['告', '生', '吽'], why: '“牛”去了尾巴，上面加个“口”。' },
  { q: '千里相逢（打一字）', a: ['重', '逢', '里'], why: '“千”和“里”叠在一起。' },
  { q: '半个月亮（打一字）', a: ['胖', '朋', '明'], why: '“月”加上“半”。' },
  { q: '十张口，一颗心（打一字）', a: ['思', '叶', '忠'], why: '十个口是“田”，下面一颗“心”。' },
  { q: '画时圆，写时方，冬时短，夏时长（打一字）', a: ['日', '月', '口'], why: '太阳画出来是圆的，写出来是方的。' },
  { q: '二人顶破天（打一字）', a: ['夫', '天', '仁'], why: '“二”“人”叠起来，冒出了“天”的头。' },
  { q: '七十二小时（打一字）', a: ['晶', '旦', '昌'], why: '三天，三个“日”。' },
  { q: '人有它大，天没它大（打一字）', a: ['一', '人', '口'], why: '“人”加一是“大”，“天”去一也是“大”。' },
  { q: '自大一点（打一字）', a: ['臭', '犬', '息'], why: '“自”下面一个“大”，再加一点。' },
  { q: '一人在内（打一字）', a: ['肉', '囚', '内'], why: '“内”里面再多一个“人”。' },
  { q: '大丈夫不得出头（打一字）', a: ['天', '夫', '太'], why: '“夫”字不出头，就是“天”。' },
  { q: '四个人抬一根木头（打一字）', a: ['杰', '林', '休'], why: '“木”下面四点，像四个人。' },
];
/** 科举 (the imperial exam): the world's own lore, and the classics */
export const EXAM: Quiz[] = [
  { q: '百年前于西北雪山之巅筑天阙、歃血为盟的，共有几家？', a: ['七家', '五家', '九家'] },
  { q: '当今年号为何？', a: ['承乾', '永安', '天阙'] },
  { q: '“床前明月光”的下一句是？', a: ['疑是地上霜', '低头思故乡', '举头望明月'], why: '李白《静夜思》。' },
  { q: '一年二十四节气，春天的第一个是？', a: ['立春', '雨水', '惊蛰'] },
  { q: '“桃花流水鳜鱼肥”，此句写的是哪个时节？', a: ['春天', '秋天', '夏天'], why: '张志和《渔歌子》。' },
  { q: '冬至这一天，北方人家家要吃什么？', a: ['饺子', '汤圆', '粽子'] },
  { q: '“欲穷千里目”的下一句是？', a: ['更上一层楼', '黄河入海流', '白日依山尽'], why: '王之涣《登鹳雀楼》。' },
  { q: '天阙古道山脚下的石牌坊，匾上题的是哪两个字？', a: ['天阙', '青石', '望阙'] },
  { q: '六部之中，掌管科举礼仪的是？', a: ['礼部', '吏部', '工部'] },
  { q: '“七家散，天阙寒”的下一句是？', a: ['钟不鸣，人不还', '雪满山，路漫漫', '剑已断，玉犹温'], why: '阿萝唱的《七家谣》。' },
  { q: '端午节要做什么？', a: ['赛龙舟、吃粽子', '赏月、吃月饼', '登高、插茱萸'] },
  { q: '一更天是什么时辰？', a: ['戌时', '子时', '酉时'], why: '一更是戌时，三更才是子时。' },
];
export const EXAM_RANKS = ['落第', '落第', '同进士', '进士', '探花', '榜眼', '状元'];

/** 断案: a wrong at the drum; three people speak, one of them lies */
export interface Case {
  title: string;
  wrong: string;
  /** [who, what they say]; the first is guilty (shuffled in the game) */
  say: [string, string][];
  /** why the guilty one gave themself away */
  tell: string;
  verdict: string;
}
export const CASES: Case[] = [
  {
    title: '绸缎失窃案',
    wrong: '苏娘子摊上一匹上好的云锦，昨夜不翼而飞。摊子用油布盖着，早上油布还好好的，只有布底下的锦没了。昨夜集上只有三个人留得晚。',
    say: [
      ['窑工 · 陶三', '我收了摊就回家了，一直睡到天亮。那油布是我帮她盖的，四个角都压了石头，谁动得了？'],
      ['灯笼匠 · 胡老爹', '我点着灯笼守到三更，只看见一只野猫钻过去，没看见人。'],
      ['面摊 · 胖大海', '我收拾锅碗到很晚，听见陶三那边有动静，像搬东西，我以为他在收坛子。'],
    ],
    tell: '油布是早上才被人发现“压着石头”，可陶三说自己收了摊就走了。他怎么知道四个角都压了石头？那是偷完锦以后才压回去的。',
    verdict: '陶三认了：他欠了赌债，想拿云锦去城里换钱。锦还在他家坛子里。',
  },
  {
    title: '御膳房的鸡汤',
    wrong: '给丞相熬的参鸡汤被人下了泻药，丞相拉了一夜。御膳房里那天只进过三个人。',
    say: [
      ['小太监 · 来福', '我只是去端了一回汤，一路上没停，端到门口就交给碧桃姐姐了。那汤上面漂着一层白沫，我还以为是参熬出来的。'],
      ['宫女 · 碧桃', '我接过汤就送进去了，汤是清的，什么都没有。'],
      ['厨子 · 老马', '汤是我熬的，我自己尝过，好好的。'],
    ],
    tell: '碧桃接汤时汤是清的，老马熬好时也是好的。只有来福说汤上“漂着白沫”：药是他端汤的路上下的，药粉化开才起了沫，他自己说漏了嘴。',
    verdict: '来福招了：是冯公公叫他干的，冯公公不想让丞相上朝。',
  },
  {
    title: '王小石失踪案',
    wrong: '击鼓的老汉说，他儿子王小石一年前被官兵抓去修天阙的石阶，再没回来。官府说人是自己跑了。三个当时在场的人这样说：',
    say: [
      ['监工 · 刘把头', '王小石半夜自己跑的，我亲眼看见他往东边林子跑了。那天夜里黑得伸手不见五指。'],
      ['民夫 · 赵二', '那天夜里月亮很亮，刘把头把王小石叫走了，说是去搬石头，后来就没回来。'],
      ['民夫 · 孙七', '我睡着了，什么也不知道。第二天刘把头发了我们一人一斗米，叫我们别多嘴。'],
    ],
    tell: '刘把头说夜里“黑得伸手不见五指”，却又说“亲眼看见”王小石往东跑。看不见还能看见？他在撒谎。',
    verdict: '刘把头招了：王小石撞见他们往天阙送童男童女，被他推下了山崖。老汉跪在鼓前，哭了很久。',
  },
];

/** 朝议: the morning court asks; what you counsel stands for a while (three days) and the world feels it */
export interface Debate {
  q: string;
  options: { say: string; policy: string; note: string; coins: number }[];
}
export const DEBATES: Debate[] = [
  {
    q: '南边三县大旱，颗粒无收。户部说国库也不宽裕。',
    options: [
      { say: '开仓放粮，先救百姓', policy: 'grain', note: '朝廷开仓放粮，集上的米面便宜了。', coins: 0 },
      { say: '以工代赈，叫灾民去修路', policy: 'roads', note: '灾民修路，驿道好走了，马也跑得快。', coins: 20 },
      { say: '国库要紧，让地方自己想办法', policy: 'none', note: '朝廷不管。南边逃荒的人越来越多。', coins: 40 },
    ],
  },
  {
    q: '山贼越来越多，兵部请旨增兵剿匪，可这要加征赋税。',
    options: [
      { say: '增兵剿匪，长痛不如短痛', policy: 'troops', note: '官兵出城剿匪，寨子里的贼人人心惶惶，没那么凶了。', coins: 0 },
      { say: '不加税，招安那些被逼上山的', policy: 'amnesty', note: '朝廷招安，有些贼人下山回家了。', coins: 10 },
      { say: '加税，多多益善', policy: 'tax', note: '加征赋税，集上东西都贵了一截。', coins: 60 },
    ],
  },
  {
    q: '天阙上的那位又下了旨，要各地进贡童男童女。满朝无人敢言。',
    options: [
      { say: '抗旨不遵', policy: 'defy', note: '丞相带头抗旨。宫里人心大振，天阙那边……没有动静。', coins: 0 },
      { say: '拖着，先不办也不驳', policy: 'none', note: '朝廷装聋作哑，旨意压在案头。', coins: 10 },
      { say: '照办', policy: 'obey', note: '朝廷照办。村里的人把孩子藏了起来，集上冷清了好几天。', coins: 30 },
    ],
  },
  {
    q: '元宵将至，礼部请拨银子办灯会，工部说城墙也该修了。',
    options: [
      { say: '办灯会，与民同乐', policy: 'festival', note: '城里城外张灯结彩，人人脸上有了笑。', coins: 0 },
      { say: '修城墙，防着天阙', policy: 'walls', note: '工部修城墙，宫门的禁军多了一倍。', coins: 20 },
      { say: '两样都不办，省下银子', policy: 'none', note: '银子省下了，冷冷清清又一年。', coins: 40 },
    ],
  },
];
/** what a policy does while it stands */
export const POLICY: Record<string, { price?: number; foes?: number; ride?: number; name: string }> = {
  grain: { price: 0.75, name: '开仓放粮' },
  roads: { ride: 1.2, name: '以工代赈' },
  troops: { foes: 0.85, name: '增兵剿匪' },
  amnesty: { foes: 0.92, name: '招安' },
  tax: { price: 1.3, name: '加征赋税' },
  defy: { foes: 0.95, name: '抗旨' },
  obey: { price: 1.1, name: '奉旨进贡' },
  festival: { price: 0.9, name: '元宵灯会' },
  walls: { name: '修城墙' },
  none: { name: '' },
};

/** where the herbs grow (血参, in the wild beyond the village): generated by world.ts */
export const HERB_N = 14;
