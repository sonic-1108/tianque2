// The main story: the village elder sends you out den by den, nearest first, back to him every few dens, out to the
// last boss at the far edge. Built from the den layout, so it always matches the map.
import { DENS, FOE_KINDS, bossNameOf, menNameOf } from './foes';
import { FOLK, PLACES, placeOf } from './places';
import { GD_PAV, roadPoint } from './layout';
import { HOME } from './village';
import { RIVALS, roadPath, type EscortSpec } from './jianghu';

export type Goal =
  | { type: 'learn' } // learn a first move (K)
  | { type: 'talk'; npc: NpcRole } // go and talk to someone
  | { type: 'kill'; den: number; count: number } // beat this many at a den
  | { type: 'boss'; den: number } // beat the den's boss
  | { type: 'level'; level: number }
  | { type: 'visit'; at: [number, number]; r: number; place: string } // go there
  | { type: 'folk'; name: string } // talk to one of the folk (FOLK, by name)
  // story 4 (jianghu.ts): each new thing in the world met through the story
  | { type: 'raid' } // hold the village through a raid (counted when one is won)
  | { type: 'rival'; id: string } // beat one of the wanted (RIVALS id)
  | { type: 'home' } // step into your house
  | { type: 'hunt' } // bring down game with the bow
  | { type: 'gear'; n: number } // own this many forged pieces
  // story 5: fewer dens, more kinds of thing to do
  | { type: 'patrol' } // rout a patrol of the false court
  | { type: 'post' } // raze a checkpoint
  | { type: 'escort' }; // bring someone safely along a road (Quest.escort)

export type NpcRole = 'elder' | 'doctor' | 'teller';

export interface Quest {
  title: string;
  giver: NpcRole; // who gives it (and takes it back)
  intro: string; // what they say when they give it
  done: string; // what they say when you bring it back
  goal: Goal;
  xp: number;
  /** the first quest of a chapter: its title and the narration shown on the chapter card */
  chapter?: { name: string; text: string };
  /** starts as soon as the one before is handed in (nobody to fetch it from) */
  direct?: boolean;
  /** hands itself in the moment it's done; `done` shows as a story card (folk: what they tell you) */
  auto?: boolean;
  /** a keepsake the quest gives (sword: the broken sword made whole, +10% damage) */
  relic?: 'sword';
  /** added in story 3 (older saves' quest numbers skip these) */
  v3?: boolean;
  /** added in story 4 */
  v4?: boolean;
  /** auto quests: hand in with a toast, not a story card (the den-clearing ones) */
  quiet?: boolean;
  /** what starting it does: give the house's key, a hunting bow, bring the raiders tonight */
  start?: 'home' | 'bow' | 'raid';
  /** a forged piece it gives when handed in (jianghu.ts GEAR id) */
  gear?: string;
  /** added in story 5 */
  v5?: boolean;
  /** story 5 no longer asks for it (most den clearing): the line steps over it, numbers stay put */
  skip?: boolean;
  /** who to bring where (goal 'escort') */
  escort?: EscortSpec;
}

export const NPCS: { role: NpcRole; name: string; model: string; x: number; z: number; greet: string }[] = [
  { role: 'elder', name: '村长 · 石伯', model: 'npc-elder.glb', x: 0, z: -9, greet: '天冷了，山上的火光一夜比一夜多。' },
  { role: 'doctor', name: '僧医 · 慧明', model: 'npc-monk.glb', x: 9, z: 4, greet: '受伤了就来找我，药钱先欠着。' },
  { role: 'teller', name: '说书人', model: 'npc-oldman.glb', x: -9, z: 4, greet: '客官，听段江湖事？' },
];

/** what the elder says about each kind of outlaw, ring by ring (the story moves on as you go further out) */
const KIND_LINES: string[][] = [
  ['那伙山贼抢了李家的粮，还烧了草垛', '那伙山贼使的刀法大开大合，像是狂刃门的路数', '那帮山贼是狂刃门叛出来的老手，一刀能劈开石头'],
  ['有个女飞贼在路上放冷镖，商队都不敢走了', '那伙女飞贼的针上淬了麻药，是暗器门的手法', '暗器门的叛徒聚在那儿，百步之外取人眼睛'],
  ['来了几个野和尚，化缘化到抢的地步', '那伙野和尚掌力很重，梵音寺的功夫没学全就下了山', '那几个和尚念的是梵音寺的六字真言，一开口人就站不稳'],
  ['夜里有刺客摸进村子，偷了刘家的牛', '那伙刺客会遁地，是影刃的身法', '影刃的刺客在那儿扎了根，专替人杀人'],
  ['有伙人穿着金甲，自称"奉旨收粮"', '那伙伪朝禁军喊着"奉天承运"，像是真有人给他们封了官', '那儿驻着伪朝的兵，列阵如军，盔甲在山口晃眼'],
  ['有个奸商拿假银票换了全村的鸡', '那伙奸商撒钱买命，钱上沾着毒粉', '那帮人做的是买空卖空的大买卖，交易所的人都怕他们'],
  ['林子里来了个妖道，说能点石成金', '那伙妖道吸人精气，地仙门的禁术', '妖道们在那儿布了阵，草木都枯了'],
];

const byLevel = DENS.map((d, i) => ({ d, i })).sort((a, b) => a.d.level - b.d.level);

export const QUESTS: Quest[] = (() => {
  const q: Quest[] = [];
  // ---------------- 序章 · 青石村
  q.push({
    title: '晨钟',
    giver: 'elder',
    chapter: {
      name: '序章 · 青石村',
      text: '百年前，七家在西北雪山之巅筑起天阙，歃血为盟，守护江湖。\n二十年前的一个雪夜，天阙的钟声断了，七家从此各奔东西。\n那年冬天，青石村的石伯在村口捡到一个襁褓，里面裹着一柄断剑和一块刻着"阙"字的玉佩。\n那个孩子，就是你。',
    },
    intro: '醒了？昨夜北边山上又有火光。你从小跟着我练剑，可还没正经学过一招。按 K 打开技能树，用技能点学一招防身，学会了回来找我。',
    done: '好，有几分样子了。剑是断的，人不能软。',
    goal: { type: 'learn' },
    xp: 60,
  });
  q.push({
    title: '僧医的药',
    giver: 'elder',
    intro: '出去之前，先去找僧医慧明要些伤药。把你那块玉佩也给他看看，他读的经书多，杂书也多。',
    done: '慧明说那玉佩他在书里见过？……先别想了，眼前的事要紧。',
    goal: { type: 'talk', npc: 'doctor' },
    xp: 40,
  });
  q.push({
    title: '张大锤的刀',
    giver: 'elder',
    direct: true,
    auto: true,
    v4: true,
    gear: 'w1',
    intro: '空着手可不行。出村往张记铁铺走一趟，铁匠张大锤欠我一个人情，让他给你打把刀。',
    done: '石伯让你来的？早给你备着了。\n（他从炉边拎出一把刀，刀背上还留着锤印。）\n精铁刀，不算好，够你砍山贼。往后打来铁料、兽皮，碰上玄铁更好，都拿来，我给你打更好的家伙。\n\n（得到 精铁刀，已经佩上。以后在铁铺跟他说话就能打造装备。）',
    goal: { type: 'folk', name: '铁匠 · 张大锤' },
    xp: 60,
  });
  // ---------------- the dens, ring by ring
  const CH = [
    { name: '第一章 · 山雨欲来', text: '这一年，七条官道上的贼人忽然多了起来。\n他们抢粮、放火、劫商队，像是有人在背后催着。\n石伯把断剑交还给你：「去吧，先把村子周围清干净。」' },
    { name: '第二章 · 七家散落', text: '雷彪身上那封信，印着一个金色的"阙"字：\n「奉天阙敕令，收七家散众，听候调遣。」\n天阙沉寂了二十年，如今却在招兵买马。越往外走，你越发现，那些贼人使的都是七家的功夫。' },
    { name: '第三章 · 雪线之下', text: '玄阴真人死前笑着说：「天阙上坐着的，是皇帝。」\n慧明翻出一本旧医书，书里画着你那块玉佩：天阙守阙人的信物。\n守阙人一家，二十年前那一夜，全死了。\n只有一个婴儿，不知所踪。' },
  ];
  const BOSS_DONE = [
    '雷彪倒了？他怀里搜出一封信……你自己看吧。「奉天阙敕令」，天阙二十年没有声音了，怎么会？',
    '玄阴真人……他说天阙上坐着皇帝？天阙从来不是谁的宫殿，那是七家共守的地方。',
    '无面说他当年抱过一个婴儿下山？……孩子，你过来，有些事我该告诉你了。',
  ];
  const BOSS_INTRO = [
    (dir: string, d: (typeof DENS)[number]) => `${dir}那伙山贼的头子叫雷彪，人称黑风寨主（${d.level + 3} 级）。这一圈的贼都听他的，打倒他，村子周围就太平了。`,
    (dir: string, d: (typeof DENS)[number]) => `${dir}的林子里住着个玄阴真人（${d.level + 3} 级），中环的贼人都给他上供。他知道天阙的事，去问问他，问不出就打。`,
    (dir: string, d: (typeof DENS)[number]) => `${dir}有个杀手头子叫无面（${d.level + 3} 级），影阁之主。听说二十年前那一夜，他就在天阙上。`,
  ];
  let ring = -1;
  let inRing = 0;
  for (const { d, i } of byLevel) {
    if (d.peak) continue;
    if (d.ring !== ring) {
      ring = d.ring;
      inRing = 0;
      if (ring === 2) q.push({ title: '登峰造极', giver: 'elder', intro: '最外一圈的贼人都是七家的叛徒，个个是狠角色。先把自己练到 18 级再去，别急着送命。', done: '你出剑的样子，越来越像一个人了。', goal: { type: 'level', level: 18 }, xp: 300 });
    }
    const kind = FOE_KINDS[d.kind];
    const dir = dirName(d.x, d.z);
    const chapter = inRing === 0 ? CH[ring] : undefined;
    inRing++;
    const extras: Quest[] = [];
    if (ring === 0 && inRing === 1)
      extras.push({
        title: '守夜',
        giver: 'elder',
        v4: true,
        start: 'raid',
        intro: '不好！你打掉的那伙人放出话来，今晚就来烧村。天黑前回村，守住寨门，别让他们靠近房子。（天黑以后山贼分三波杀来，打退最后一波就算赢。）',
        done: '守住了……守住了！二十年了，青石村头一回没让人欺负了去。\n村里人都说，有你在，往后日子能过了。（村子会跟着你一点点兴旺起来。）',
        goal: { type: 'raid' },
        xp: 220,
      });
    if (ring === 0 && inRing === 2)
      extras.push({
        title: '柴房里的人',
        giver: 'elder',
        direct: true,
        auto: true,
        v5: true,
        intro: '寨子的柴房里关着一个人，手脚都捆着，是秀兰的丈夫周大！他腿上有伤，跑不快。护着他走官道回村，路上怕是有人截。',
        done: '周大一进寨门就瘫坐在地上，抱着秀兰哭了。\n他说寨子里的人提起过“上面”，抢来的东西都往西北送。',
        escort: { name: '周大', model: 'npc-farmer.glb', path: roadPath(d.road, d.r, 34, [d.x, d.z]), hello: '恩人！快，带我回村……我腿伤了，你走慢些。' },
        goal: { type: 'escort' },
        xp: 260,
      });
    if (ring === 0 && inRing === 2)
      extras.push({ title: '报个平安', giver: 'elder', direct: true, auto: true, v3: true, intro: '你从寨子的柴房里放出一个人，是秀兰的丈夫周大。回村跟秀兰说一声。', done: '他回来了？……谢谢你，谢谢你。\n他说在寨子里听那些贼人讲，抢来的粮食不分，全往西北山里送，说是孝敬"上面"的。\n上面是谁，他们自己也不知道。', goal: { type: 'folk', name: '村妇 · 秀兰' }, xp: 80 });
    if (ring === 0 && inRing === 2)
      extras.push({
        title: '断刀客',
        giver: 'elder',
        v4: true,
        intro: `周大说，寨子里的人都怕一个叫石猛的断刀客。他原是黑风寨的二当家，叛出来以后伪朝出了悬赏。${rivalWhere('shimeng')}。他知道雷彪的老窝，去会会他。（打赢他，他会服你。）`,
        done: '石猛跟着你？……也好，多一把刀。\n他说雷彪的寨子在哪儿，有几道岗，他都画给你了。这人眼神不坏，你多跟他说说话。',
        goal: { type: 'rival', id: 'shimeng' },
        xp: 240,
      });
    if (ring === 0 && inRing === 2)
      extras.push({
        title: '冲散巡逻',
        giver: 'elder',
        direct: true,
        auto: true,
        v5: true,
        intro: '石猛说，伪朝的巡逻队沿着驿道一路搜过来，见了带刀的就抓，抓去天阙当苦力。驿道上碰见他们（大地图上的红点），把那一队人打散。',
        done: '巡逻队长扔下腰牌就跑了。腰牌背面刻着：“天阙敕令 · 青石一带 · 搜守阙人余孽”。\n……他们在找的，是你。',
        goal: { type: 'patrol' },
        xp: 280,
      });
    if (ring === 1 && inRing === 2) {
      extras.push({
        title: '燕子镖',
        giver: 'elder',
        v4: true,
        intro: `伪朝悬赏一个劫税银的女飞贼，叫柳飞燕。石猛说她爹是燕家的镖师，那年给天阙押过贡品，再没回来。${rivalWhere('liufeiyan')}。她也许知道天阙那一夜的事。`,
        done: '燕家的丫头……她爹押的那趟贡品，送到天阙山门的那天夜里，钟就停了。\n她说她这些年劫的税银，箱子上都烙着同一个"阙"字。',
        goal: { type: 'rival', id: 'liufeiyan' },
        xp: 320,
      });
      extras.push({
        title: '劫税银',
        giver: 'elder',
        direct: true,
        auto: true,
        v5: true,
        intro: '柳飞燕说：伪朝在驿道上设了关卡，过路的一律抽三成，抽来的银子全往天阙送。一个人劫不动，咱俩一起去，把关卡拔了。（大地图上的“关卡”）',
        done: '关卡的箱子撬开了，满满的税银，箱盖上都烙着“阙”字。\n柳飞燕抓起一把：“这些，都是七条官道上的人的血汗。”她把银子分给了过路的人，一文没留。',
        goal: { type: 'post' },
        xp: 380,
      });
      extras.push({
        title: '护送药材',
        giver: 'elder',
        direct: true,
        auto: true,
        v5: true,
        intro: `伪朝封了路，慧明的药材压在驿站运不进来。货郎周小乙敢走这一趟，你护着他从寨门出去，送到${dirName(...roadPoint(5, 300))}的驿站。`,
        done: '周小乙把药材卸在驿站门口，腿还在抖：“大侠，下回您再走这条路，我请您喝酒！”',
        escort: { name: '货郎 · 周小乙', model: 'npc-peddler.glb', path: roadPath(5, 40, innR(5) - 6, undefined, innAt(5)), hello: '走吧走吧，趁天亮！路上要是有人截，您可得护着我。' },
        goal: { type: 'escort' },
        xp: 360,
      });
      extras.push({
        title: '秋猎',
        giver: 'elder',
        direct: true,
        v4: true,
        start: 'bow',
        intro: '外头越来越凶，光靠一把刀不够。猎户韩老三送你一张猎弓：面朝猎物，二十六步之内按 F 拉弓。打一头鹿或者野猪，皮子拿去让张大锤给你做甲。秋天山里的猎物最肥。',
        done: '韩老三说你的箭法不赖。兽皮留着，去铁铺做身鹿皮甲。',
        goal: { type: 'hunt' },
        xp: 200,
      });
    }
    if (ring === 1 && inRing === 3)
      extras.push({ title: '百炼', giver: 'elder', direct: true, auto: true, v4: true, intro: '张大锤托人带话：中环的贼人身上有铁料，头目身上有玄铁。凑够了料去找他，再打一件。（身上有两件打造的装备就算成。）', done: '张大锤摸着新打的家伙，乐得合不拢嘴：“这手艺，搁二十年前，够给天阙供货了。”', goal: { type: 'gear', n: 2 }, xp: 260 });
    if (ring === 2 && inRing === 1)
      extras.push({
        title: '七家遗孤',
        giver: 'elder',
        direct: true,
        auto: true,
        v5: true,
        intro: '那伙人寨子里押着个少年，是七家里燕家的后人，叫燕小六，伪朝要拿他上天阙“认罪”。把他带出来，送去最近的驿站藏着。',
        done: '燕小六在驿站的马厩里躲下了。他说：“我爹说过，守阙人的孩子要是还活着，天阙的钟就还有人敲。”',
        escort: { name: '燕小六', model: 'npc-novice.glb', path: [...roadPath(d.road, d.r, innR(d.road) + 6, [d.x, d.z], innAt(d.road))], hello: '你……你是来救我的？我跟你走！' },
        goal: { type: 'escort' },
        xp: 600,
      });
    if (ring === 2 && inRing === 1)
      extras.push({
        title: '游方僧',
        giver: 'elder',
        v4: true,
        intro: `慧明说有个游方僧叫了尘，出家前在天阙山下行医，因为给逃兵治伤被伪朝通缉。${rivalWhere('liaochen')}。他也许见过你娘。`,
        done: '了尘说，二十年前那个雪夜，他给一个抱着婴儿的女人包扎过伤口。\n女人求他别问名字，只说了一句："孩子戴着玉，玉上有字。"\n……孩子，你娘是活着下的山。',
        goal: { type: 'rival', id: 'liaochen' },
        xp: 420,
      });
    if (ring === 1 && inRing === 1) {
      const jz = placeOf('jianzhong');
      extras.push({
        title: '断剑冢',
        giver: 'elder',
        v3: true,
        auto: true,
        intro: `${dirName(jz.x, jz.z)}的荒原上有片古战场，人叫断剑冢。二十年前天阙出事那一夜，七家在那儿死了很多人，剑都插在地上没人收。你那柄断剑，说不定另一半就在那儿。`,
        done: '断剑冢里插着上千柄剑，大半已经锈穿。\n你在一块断碑下找到半截剑身，剑脊上七道纹，和你那半截严丝合缝。\n碑上刻着几个字，被人用刀刮过，只剩一个"守"字。',
        goal: { type: 'visit', at: [jz.x, jz.z], r: 9, place: '断剑冢' },
        xp: 260,
      });
      extras.push({ title: '断剑重铸', giver: 'elder', direct: true, auto: true, relic: 'sword', v3: true, intro: '两截剑都在你手上了。村外铁铺的张大锤，他师父那一辈给天阙打过剑。', done: '这……这是天阙的剑！剑脊七道纹，七家各一道。我师父的师父打的，我只在图上见过。\n（叮，叮，叮。炉火烧了一夜。）\n接好了。剑是好剑，就是认主，你拿着它，比拿别的剑快三分。', goal: { type: 'folk', name: '铁匠 · 张大锤' }, xp: 200 });
    }
    if (ring === 2 && inRing === 1)
      extras.push({ title: '面具客', giver: 'elder', v3: true, auto: true, intro: '杏花酒肆的杏娘说，每年冬天有个戴面具的客人。你去问问她。', done: '那个戴面具的？每年头一场雪他就来，喝一碗杏花酿，不说话，往北走。\n有一年他喝多了，盯着村口看了半天，说了一句："那孩子该长大了。"\n我问他哪个孩子，他把碗一扣就走了。', goal: { type: 'folk', name: '酒肆掌柜 · 杏娘' }, xp: 160 });
    if (d.boss && ring === 2)
      q.push({
        title: '夜行客',
        giver: 'elder',
        v4: true,
        intro: `影阁出了个叛徒，叫莫寒，是无面的亲传弟子。${rivalWhere('mohan')}。要找无面，先找他。`,
        done: '莫寒说，无面每年头一场雪都要下山一趟，去一个没有名字的坟前站一夜。\n他还说，当年师父让他去杀的那个人，就是你。',
        goal: { type: 'rival', id: 'mohan' },
        xp: 520,
      });
    if (d.boss) {
      q.push({
        title: `擒贼擒王 · ${bossNameOf(d)}`,
        giver: 'elder',
        intro: BOSS_INTRO[ring](dir, d),
        done: BOSS_DONE[ring],
        goal: { type: 'boss', den: i },
        xp: 200 + d.level * 30,
      });
      if (ring === 0) q.push({ title: '天阙旧事', giver: 'elder', intro: '天阙的事，说书人比我清楚。去听他讲讲。', done: '他讲的那些，有一半是真的。剩下一半，等你自己去看。', goal: { type: 'talk', npc: 'teller' }, xp: 80 });
      if (ring === 0)
        q.push({
          title: '安家',
          giver: 'elder',
          direct: true,
          auto: true,
          v4: true,
          start: 'home',
          intro: '村东北那间空屋，二十年前一个过路的女人托我留着，说"给那孩子"。如今你长大了，钥匙给你。进去看看吧。',
          done: '屋里落满了灰。床底下有个木匣，里面是一件小孩的棉袄，襟上绣着一个"阙"字。\n这是你的家。\n\n（床可以睡到天亮，兵器架上换装备；不跟着你的同伴会在院子里等你。）',
          goal: { type: 'home' },
          xp: 120,
        });
      if (ring === 1) q.push({ title: '玉佩', giver: 'elder', intro: '慧明说他查到了那块玉佩的来历，让你过去一趟。', done: '……守阙人的信物。我早该想到的。', goal: { type: 'talk', npc: 'doctor' }, xp: 120 });
      if (ring === 1)
        q.push({
          title: '进京',
          giver: 'elder',
          direct: true,
          auto: true,
          v4: true,
          intro: '玉佩的事，京里也许有人知道。顺着官道去永安城，城里每季第二天开擂台，天下的武人都去。找擂台官包金刚，打听打听天阙的风声。',
          done: '包金刚压低了嗓子：“京里都在传，天阙上那位要七家的人上山朝拜，不去的，就是反贼。”\n“你要是有本事，就上我的擂台，五阵连胜，名字能传遍七条官道。”\n\n（擂台每季第二天辰时到戌时开，赢了有名号和金丝软甲。）',
          goal: { type: 'folk', name: '擂台官 · 包金刚' },
          xp: 260,
        });
    } else {
      q.push({
        title: `清剿${menNameOf(d)}`,
        giver: 'elder',
        chapter,
        intro: `${dir}${KIND_LINES[d.kind][ring]}（${d.level} 级）。去打倒他们 ${d.count} 个人。`,
        direct: inRing > 1 ? true : undefined,
        auto: inRing > 1 ? true : undefined,
        quiet: inRing > 1 ? true : undefined,
        skip: inRing > (ring === 2 ? 1 : 2) ? true : undefined,
        done: ring === 0 ? '干得漂亮。' : ring === 1 ? '又是七家的功夫……这些人原本都是名门弟子。' : '好。离天阙越来越近了。',
        goal: { type: 'kill', den: i, count: d.count },
        xp: 60 + d.level * 18,
      });
      if (ring === 0 && inRing === 2) q[q.length - 1].done = '干得漂亮。寨子里还关着人？快，先把人带回来。';
    }
    q.push(...extras);
  }
  // ---------------- 终章 · 天阙
  const tq = DENS.findIndex((d) => d.peak);
  q.push({
    title: '身世',
    giver: 'elder',
    chapter: {
      name: '终章 · 天阙',
      text: '二十年前，天子一脉的萧承乾想独占天阙，在一个雪夜杀了守阙人满门。\n影阁的无面奉命斩草除根，却在最后一刻抱着婴儿下了山，把他留在一个小村的村口。\n萧承乾自立为帝，封了天阙的钟。\n如今他要用七家的叛徒，把整个江湖收进他的天阙。',
    },
    intro: '你是守阙人的孩子。这些年我没说，是怕你去送死。可你已经不是当年那个孩子了。去练到 28 级，然后上天阙，把钟敲响。',
    done: '去吧。路在西北，沿着官道一直走，走到雪线下的那座山。山道只有一条。',
    goal: { type: 'level', level: 28 },
    xp: 400,
  });
  q.push({
    title: '逃营校尉',
    giver: 'elder',
    direct: true,
    v4: true,
    intro: `天阙的山门有金甲卫守着。伪朝的逃将韩烈认得上山的路，${rivalWhere('hanlie')}。先把他找着。`,
    done: '韩烈说，那一夜他就守在山门下，奉命不许任何人下山。\n他放走了一个抱孩子的女人。\n“我数过台阶，三千级。这一回，我陪你走上去。”',
    goal: { type: 'rival', id: 'hanlie' },
    xp: 600,
  });
  const tomb = placeOf('tomb');
  q.push({
    title: '守阙人之墓',
    giver: 'elder',
    direct: true,
    auto: true,
    v3: true,
    intro: '无面临死前说，那一夜之后，他回去把守阙人夫妇葬在了古道山脚下，就在牌坊不远处。上山之前，去给你爹娘磕个头。',
    done: '一座孤坟，没有名字，只有一块素碑，碑前的石台上却很干净，有人年年来扫。\n碑后插着一柄木剑，是给孩子玩的。\n你跪下，磕了三个头。山风很大，雪线就在头顶。',
    goal: { type: 'visit', at: [tomb.x, tomb.z], r: 7, place: '守阙人之墓' },
    xp: 300,
  });
  q.push({
    title: '望阙台',
    giver: 'elder',
    direct: true,
    auto: true,
    v3: true,
    intro: '沿着古道往上走，半山腰的望阙台上能看清天阙的山门。',
    done: '从望阙台望上去，钟楼顶上那颗金珠在雪里发亮。\n山门前站着金甲卫，旗子上的"阙"字是新绣的。\n你想起石伯的话：剑是断的，人不能软。现在剑也不断了。',
    goal: { type: 'visit', at: [GD_PAV[0], GD_PAV[1]], r: 9, place: '望阙台' },
    xp: 200,
  });
  q.push({
    title: '天阙钟鸣',
    giver: 'elder',
    direct: true,
    auto: true,
    intro: '山门就在上面。萧承乾在大殿前等着，金甲卫守着山门。',
    done: '萧承乾倒在大殿的台阶上，金冠滚进了雪里。\n你走上钟楼，抓住那根二十年没人碰过的钟杵。\n咚。\n钟声顺着七条官道传下去，青石村的人都抬起了头。',
    goal: { type: 'boss', den: tq },
    xp: 2000,
  });
  q.push({
    title: '回村',
    giver: 'elder',
    direct: true,
    v3: true,
    chapter: {
      name: '尾声 · 钟鸣',
      text: '天阙的钟响了三天三夜。\n散落各地的七家弟子，有的扔下了刀，有的上了山。\n没有人再坐在天阙上。钟楼的门开着，谁都能去敲。\n石伯在村口等你，像二十年前那个雪夜一样。',
    },
    intro: '回青石村去，石伯在等你。',
    done: '回来了。我听见钟声的时候，就在这儿站着。\n你爹娘要是知道，会高兴的。',
    goal: { type: 'talk', npc: 'elder' },
    xp: 300,
  });
  q.push({ title: '散人之道', giver: 'elder', intro: '你学过七家的招，一家都不属于。到了三十级，按 K 可以转职，学一家的大招。也可以一直做个散人。路怎么走，你自己定。', done: '青石村记住你了。天阙的钟，往后由你来敲。', goal: { type: 'level', level: 30 }, xp: 500 });
  // fewer dens to clear, so each story step pays more
  for (const x of q) x.xp = Math.round(x.xp * 1.6);
  return q;
})();

function innAt(road: number): [number, number] {
  const p = PLACES.find((pl) => pl.kind === 'inn' && pl.road === road)!;
  return [p.x, p.z];
}
function innR(road: number) {
  return Math.hypot(...innAt(road));
}

function dirName(x: number, z: number) {
  const a = Math.atan2(-z, x); // east 0, north +90
  const names = ['东边', '东北边', '北边', '西北边', '西边', '西南边', '南边', '东南边'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

/** where the current goal is on the map (null = in the village / anywhere) */
export function goalPos(g: Goal): [number, number] | null {
  if (g.type === 'kill' || g.type === 'boss') return [DENS[g.den].x, DENS[g.den].z];
  if (g.type === 'talk') {
    const n = NPCS.find((x) => x.role === g.npc)!;
    return [n.x, n.z];
  }
  if (g.type === 'visit') return g.at;
  if (g.type === 'folk') {
    const f = FOLK.find((x) => x.name === g.name);
    return f ? [f.x, f.z] : null;
  }
  if (g.type === 'rival') {
    const r = RIVALS.find((x) => x.id === g.id)!;
    return roadPoint(r.road, (r.r0 + r.r1) / 2);
  }
  if (g.type === 'home') return HOME.door;
  if (g.type === 'post') return roadPoint(2, 330);
  if (g.type === 'escort') return null; // questTarget follows the escortee
  if (g.type === 'gear') {
    const sm = placeOf('smithy');
    return [sm.x, sm.z];
  }
  return null;
}
/** "he walks the road out to the north, 180 to 290 steps out" */
function rivalWhere(id: string) {
  const r = RIVALS.find((x) => x.id === id)!;
  const [x, z] = roadPoint(r.road, (r.r0 + r.r1) / 2);
  return `听说常在村子${dirName(x, z)}的官道上来回走，离村 ${r.r0} 到 ${r.r1} 步，大地图上标着红色的“悬”`;
}

export const TELLER_LINES = [
  '天阙？那是七家一起修的。山门朝东，钟楼在最高处，钟一响，七条官道上都听得见。',
  '七家：狂刃、暗器、梵音、影刃、天子、交易、地仙。当年谁也不服谁，可钟一响，全都上山。',
  '二十年前那一夜，雪下得很大。第二天，天阙的钟就再也没响过。',
  '西边是雪山，越往深处贼人越凶，没到二十级别去送命。',
  '东边是河，过河要蹚水，水里走得慢，被追着打可别往河里跑。',
  '每圈山贼窝都有个头目，头目窝的旗子是黑的。',
  '路边有凉亭，迷路了就找凉亭，顺着路回村。',
  '听说有个散人学全了七家的招，三十级转了职，大招一出天地变色。',
  '打不过就闪避，Shift 一滚，刀剑近不了身。',
];

/** where the player should go right now: the goal, or back to whoever gives / takes the quest */
export function questTarget(sim: { progress: { quest: { idx: number; state: string } }; jh?: any; fighters?: any[] }): [number, number] | null {
  const Q = sim.progress.quest;
  const q = QUESTS[Q.idx];
  if (!q) return null;
  if (Q.state !== 'active' && !(q.direct && Q.state === 'ready')) {
    const n = NPCS.find((x) => x.role === q.giver)!;
    return [n.x, n.z];
  }
  if (q.goal.type === 'escort' && sim.jh?.escort && sim.fighters) {
    const E = sim.jh.escort, f = sim.fighters[sim.jh.escortId];
    return E.waiting ? [f.pos[0], f.pos[2]] : E.path[E.path.length - 1];
  }
  return goalPos(q.goal);
}

/** an older story's quest number in this one (story 2 had none of the v3 or v4 quests, story 3 none of the v4) */
export function fromStory(idx: number, from: 2 | 3 | 4) {
  let k = -1;
  for (let i = 0; i < QUESTS.length; i++) {
    if (QUESTS[i].v5 || (from <= 3 && QUESTS[i].v4) || (from === 2 && QUESTS[i].v3)) continue;
    if (++k === idx) return i;
  }
  return QUESTS.length;
}
