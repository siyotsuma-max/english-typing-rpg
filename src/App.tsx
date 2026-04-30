import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Volume2, Sword, Shield, Trophy, Home, SkipForward, Zap, ArrowRight, RotateCcw, BookOpen, Star, Lock, Flame, Skull, ClipboardList, Crown, Target, Medal, Keyboard, AlertCircle, Brain, CheckCircle2, FastForward, LayoutGrid, LogOut, Square } from 'lucide-react';
import { QUESTIONS } from './data/questions';
import { getQuestionExample } from './data/questionExamples';
import HelpScreen from './HelpScreen';

// --- Types & Interfaces ---

type Difficulty = 'Eiken5' | 'Eiken4' | 'EikenPre1';
type Level = 1 | 2 | 3;
type Mode = 'guide' | 'challenge' | 'weakness'; 
type InputMode = 'voice-text' | 'text-only' | 'voice-only';
type BattleResult = 'win' | 'lose' | 'draw' | null;
type SpeechVoiceMode = 'random' | 'us_female' | 'us_male' | 'uk_female' | 'uk_male';
type BossStage = 0 | 1 | 2 | 3 | 4;
type BattleHistoryItem = { damage: number; speed: number };

// Monster Types for Visuals
type MonsterType = 'slime' | 'beast' | 'wing' | 'ghost' | 'robot' | 'boss' | 'object';

interface Monster {
  id: string;
  name: string;
  type: MonsterType;
  color: string;
  baseHp: number; 
  dialogueStart: string;
  dialogueDefeat: string;
  battleDialogues?: Partial<Record<MonsterDialogueState, string[]>>;
  theme: string;
}

type MonsterVisualVariant =
  | 'horns'
  | 'crown'
  | 'mask'
  | 'runes'
  | 'crystal'
  | 'mimic'
  | 'halo'
  | 'spikes'
  | 'cape'
  | 'orbital'
  | 'sigil'
  | 'flare';

type MonsterVisualStyle = {
  primary?: MonsterVisualVariant;
  secondary?: MonsterVisualVariant;
  accentColor?: string;
  eyeColor?: string;
  silhouette?: 'wyvern' | 'overlord' | 'reaper' | 'apocalypse';
};

interface Question {
  text: string;
  translation: string;
  basicMeaning?: string;
  exampleEn?: string;
  exampleJa?: string;
}

interface BattleLogItem {
    question: Question;
    missCount: number;
    skipped: boolean;
}

type WeakQuestionStat = {
  missCount: number;
  lastMissedAt: number;
  consecutiveCorrect: number;
};

type LearningLevel = 1 | 2 | 3;

type ManualQuestionStatus = {
  practiceLevel: LearningLevel;
  battleLevel: LearningLevel;
  manualOverrideLevel: LearningLevel | null;
  excluded: boolean;
  updatedAt: number;
  learningLevel?: LearningLevel;
};

type QuestionPoolState = {
  order: number[];
  cursor: number;
  lastIndex: number | null;
};

type ReviewQueueEntry = {
  difficulty: Difficulty;
  level: Level;
  question: Question;
  remainingQuestions: number;
  missCount: number;
};

type AutoPlaySource = 'all' | 'weak' | 'selected';

type AutoPlaySettings = {
  source: AutoPlaySource;
  playText: boolean;
  playTranslation: boolean;
  playExample: boolean;
  playbackRatePercent: number;
  itemGapSeconds: number;
  questionGapSeconds: number;
};

type AutoPlayNowPlayingPart = 'text' | 'translation' | 'example';

type AutoPlayNowPlaying = {
  questionText: string;
  translation: string;
  basicMeaning?: string;
  example: string | null;
  activePart: AutoPlayNowPlayingPart;
};

type ProgressExportPayload = {
  formatVersion: number;
  app: 'english-typing-rpg';
  exportedAt: string;
  player?: {
    id: string;
    name: string;
    data: PlayerProfileData;
  };
  data?: PlayerProfileData;
};

type PlayerProfileData = {
  defeatedMonsterIds?: string[];
  bestScores?: Record<string, number>;
  maxKeystrokes?: number;
  weakQuestions?: Question[];
  weakQuestionStats?: Record<string, WeakQuestionStat>;
  manualQuestionStatuses?: Record<string, ManualQuestionStatus>;
  reviewQueue?: ReviewQueueEntry[];
  dailyProgress?: DailyProgress;
  bgmVolumeLevel?: number;
  speechVoiceMode?: SpeechVoiceMode;
  speechRatePercent?: number;
  autoPlaySettings?: AutoPlaySettings;
  selectedQuestionKeysByScope?: Record<string, string[]>;
  savedSelectionLists?: SavedSelectionList[];
};

type PlayerProfile = {
  id: string;
  name: string;
  updatedAt: number;
  data: PlayerProfileData;
};

type SavedSelectionList = {
  id: string;
  name: string;
  difficulty: Difficulty;
  level: Level;
  questionKeys: string[];
  updatedAt: number;
};

type ResolvedSpeechConfig = {
  mode: Exclude<SpeechVoiceMode, 'random'>;
  lang: 'en-US' | 'en-GB';
  voice: SpeechSynthesisVoice | null;
  resolution: 'locale-gender' | 'gender-fallback' | 'locale-fallback' | 'unresolved';
};

interface GameState {
  screen: 'title' | 'settings' | 'help' | 'monster-book' | 'question-list' | 'score-view' | 'rank-list' | 'level-select' | 'mode-select' | 'battle' | 'result';
  selectedDifficulty: Difficulty;
  selectedLevel: Level;
  mode: Mode;
  inputMode: InputMode;
  currentMonsterIndex: number;
  currentMonsterList: Monster[]; 
  challengeModeIndices: number[];
  monsterHp: number;
  maxMonsterHp: number;
  score: number;
  combo: number;
  currentQuestion: Question;
  userInput: string;
  startTime: number | null;
  history: BattleHistoryItem[];
  questionCount: number; 
  maxQuestions: number;  
  battleResult: BattleResult;
  totalMonstersInStage: number;
  defeatedMonsterIds: string[];
  isNewRecord: boolean; 
  missCount: number;
  totalKeystrokes: number;
  hintLength: number; 
  currentBattleMissedQuestions: Question[]; 
  battleLog: BattleLogItem[];
  battleStartScore: number;
  battleStartKeystrokes: number;
  bossStage: BossStage;
}

type DailyProgress = {
  date: string;
  questionCount: number;
};

type MonsterDialogueState = 'start' | 'combo' | 'desperate' | 'damaged' | 'taunt' | 'defeat';

// --- Rank System ---
interface RankData { threshold: number; title: string; color: string; }

const GUIDE_TARGET_COUNT = 10;
const LISTENING_TRAINING_TARGET_COUNT = 10;
const NORMAL_TARGET_COUNT = 10;
const HARD_TARGET_COUNT = 10;
const REVIEW_REAPPEAR_DELAY = 5;
const REVIEW_RATE_WINDOW_SIZE = 5;
const REVIEW_RATE_MAX_IN_WINDOW = 3;
const LISTENING_TRAINING_DAMAGE_MULTIPLIER = 0.28;
const GUIDE_DAMAGE_MULTIPLIER = 0.3;
const LEARNING_LEVELS: LearningLevel[] = [1, 2, 3];
const DIFFICULTY_HP_MULTIPLIERS: Record<Difficulty, number> = {
  Eiken5: 1,
  Eiken4: 1,
  EikenPre1: 1.35,
};

const getGuideTargetCount = (difficulty: Difficulty, level: Level) => {
  void difficulty;
  void level;
  return GUIDE_TARGET_COUNT;
};

const getListeningTargetCount = (difficulty: Difficulty, level: Level) => {
  void difficulty;
  void level;
  return LISTENING_TRAINING_TARGET_COUNT;
};

const getBattleDamageMultiplier = (mode: Mode, inputMode: InputMode) => {
  if (mode === 'guide') return GUIDE_DAMAGE_MULTIPLIER;
  if (mode === 'challenge' && inputMode === 'voice-text') return LISTENING_TRAINING_DAMAGE_MULTIPLIER;
  return 1;
};

const DEFAULT_BATTLE_QUESTION_LIMIT = 10;
const FINAL_BOSS_QUESTION_LIMIT = 20;
const FINAL_BOSS_HP_MULTIPLIER = 1.6;
const HIDDEN_BOSS_COUNT = 3;
const HIDDEN_BOSS_QUESTION_LIMITS: Record<Exclude<BossStage, 0 | 1>, number> = {
  2: 30,
  3: 40,
  4: 50,
};
const HIDDEN_BOSS_HP_MULTIPLIERS: Record<Exclude<BossStage, 0 | 1>, number> = {
  2: 3,
  3: 4,
  4: 5,
};

const isEndlessChallengeInputMode = (mode: Mode, inputMode: InputMode) => (
  mode === 'challenge' && (inputMode === 'voice-only' || inputMode === 'text-only')
);

const getBossStage = (
  mode: Mode,
  inputMode: InputMode,
  stepIndex: number,
  totalMonsters: number
): BossStage => {
  if (mode === 'weakness' || totalMonsters <= 0) return 0;

  if (isEndlessChallengeInputMode(mode, inputMode)) {
    const hiddenBossStartIndex = Math.max(totalMonsters - HIDDEN_BOSS_COUNT, 0);
    if (stepIndex >= hiddenBossStartIndex) {
      return Math.min(4, stepIndex - hiddenBossStartIndex + 2) as BossStage;
    }

    const finalBossIndex = hiddenBossStartIndex - 1;
    return stepIndex === finalBossIndex ? 1 : 0;
  }

  return stepIndex >= Math.max(totalMonsters - 1, 0) ? 1 : 0;
};

const getBattleQuestionLimit = (mode: Mode, bossStage: BossStage) => {
  if (mode === 'weakness') return DEFAULT_BATTLE_QUESTION_LIMIT;
  if (bossStage === 1) return FINAL_BOSS_QUESTION_LIMIT;
  if (bossStage === 2 || bossStage === 3 || bossStage === 4) {
    return HIDDEN_BOSS_QUESTION_LIMITS[bossStage];
  }
  return DEFAULT_BATTLE_QUESTION_LIMIT;
};

const getBattleHp = (
  difficulty: Difficulty,
  baseHp: number,
  bossStage: BossStage
) => {
  const difficultyHpMultiplier = DIFFICULTY_HP_MULTIPLIERS[difficulty] ?? 1;
  const bossHpMultiplier = bossStage === 1
    ? FINAL_BOSS_HP_MULTIPLIER
    : (bossStage === 2 || bossStage === 3 || bossStage === 4)
      ? HIDDEN_BOSS_HP_MULTIPLIERS[bossStage]
      : 1;
  return Math.round(baseHp * difficultyHpMultiplier * bossHpMultiplier);
};

const getBattleTuning = (
  difficulty: Difficulty,
  mode: Mode,
  inputMode: InputMode,
  baseHp: number,
  bossStage: BossStage
) => {
  const monsterHp = getBattleHp(difficulty, baseHp, bossStage);

  return {
    monsterHp,
    damageMultiplier: getBattleDamageMultiplier(mode, inputMode),
    maxQuestions: getBattleQuestionLimit(mode, bossStage),
  };
};

const getBattleStageIndices = (
  monsters: Monster[],
  baseCount: number,
  mode: Mode,
  inputMode: InputMode
) => {
  const baseIndices = Array.from({ length: Math.min(baseCount, monsters.length) }, (_, index) => index);

  if (!isEndlessChallengeInputMode(mode, inputMode) || monsters.length <= baseIndices.length) {
    return baseIndices;
  }

  const hiddenBossIndices = Array.from(
    { length: Math.min(HIDDEN_BOSS_COUNT, Math.max(monsters.length - baseIndices.length, 0)) },
    (_, index) => baseIndices.length + index
  );

  return [...baseIndices, ...hiddenBossIndices];
};

const getPerfectClearDamageFloor = (bossStage: BossStage, maxMonsterHp: number, maxQuestions: number) => {
  if (bossStage === 0 || maxQuestions <= 0) return 0;
  return Math.ceil(maxMonsterHp / maxQuestions);
};

const getBossIntroLabel = (bossStage: BossStage) => {
  switch (bossStage) {
    case 1:
      return 'ラスボス出現！';
    case 2:
      return '裏ボス出現！';
    case 3:
      return '裏ボス第二形態！';
    case 4:
      return '裏ボス最終形態！';
    default:
      return '';
  }
};

const getNextBattleAlertLabel = (bossStage: BossStage) => {
  switch (bossStage) {
    case 1:
      return 'NEXT IS THE FINAL BATTLE';
    case 2:
      return 'NEXT: HIDDEN BOSS';
    case 3:
      return 'NEXT: HIDDEN BOSS II';
    case 4:
      return 'NEXT: HIDDEN BOSS III';
    default:
      return '';
  }
};

const MONSTER_BOOK_INPUT_MODES: InputMode[] = ['voice-text', 'voice-only', 'text-only'];

const isMonsterDefeatedForBook = (
  defeatedMonsterIds: string[],
  difficulty: Difficulty,
  level: Level,
  mode: Extract<Mode, 'guide' | 'challenge'>,
  monsterId: string
) => (
  MONSTER_BOOK_INPUT_MODES.some(inputMode => (
    matchesDefeatedMonster(defeatedMonsterIds, difficulty, level, mode, inputMode, monsterId)
  ))
);

const countDefeatedMonstersForBook = (
  monsters: Monster[],
  defeatedMonsterIds: string[],
  difficulty: Difficulty,
  level: Level,
  mode: Extract<Mode, 'guide' | 'challenge'>
) => (
  monsters.filter(monster => (
    isMonsterDefeatedForBook(defeatedMonsterIds, difficulty, level, mode, monster.id)
  )).length
);

const getComboLabel = (combo: number) => {
  if (combo >= 10) return 'Legendary';
  if (combo >= 7) return 'Blazing';
  if (combo >= 5) return 'Hot Streak';
  if (combo >= 3) return 'Combo';
  return '';
};

const getBattleQuestionPresentation = (questionText: string) => {
  const questionLength = questionText.length;

  return {
    textClass: questionLength > 58
      ? 'text-xl md:text-3xl'
      : questionLength > 42
        ? 'text-2xl md:text-4xl'
        : 'text-3xl md:text-5xl',
    panelClass: questionLength > 42 ? 'px-5 md:px-8 py-4 md:py-5' : 'px-4 md:px-6 py-3 md:py-4',
    minHeightClass: questionLength > 58 ? 'min-h-[4.8em]' : questionLength > 42 ? 'min-h-[3.9em]' : 'min-h-[3em]',
  };
};

const RANKS: RankData[] = [
    { threshold: 0, title: "見習いチャレンジャー", color: "text-slate-400" },
    { threshold: 5, title: "駆け出しの冒険者", color: "text-green-400" },
    { threshold: 10, title: "期待のニューフェース", color: "text-blue-400" },
    { threshold: 15, title: "勇敢なソルジャー", color: "text-indigo-400" },
    { threshold: 20, title: "熟練のベテラン", color: "text-purple-400" },
    { threshold: 25, title: "百戦錬磨の騎士", color: "text-pink-400" },
    { threshold: 30, title: "アリーナの覇者", color: "text-orange-400" },
    { threshold: 35, title: "タイピングマスター", color: "text-red-500" },
    { threshold: 40, title: "疾風の達人", color: "text-rose-500" },
    { threshold: 45, title: "伝説の英雄", color: "text-yellow-400" }
];

// --- Helpers ---

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
};

const getUniqueKey = (
  difficulty: Difficulty,
  level: Level,
  mode: Mode,
  inputMode: InputMode,
  monsterId: string
) => {
  return `${difficulty}:${level}:${mode}:${inputMode}:${monsterId}`;
};

const isScopedDefeatedMonsterKey = (value: string) => {
  const parts = value.split(':');
  if (parts.length !== 5) return false;

  const [difficulty, level, mode, inputMode, monsterId] = parts;
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) return false;
  if (!getAvailableLevels(difficulty as Difficulty).includes(Number(level) as Level)) return false;
  if (!['guide', 'challenge', 'weakness'].includes(mode)) return false;
  if (!['voice-text', 'text-only', 'voice-only'].includes(inputMode)) return false;
  return monsterId.length > 0;
};

const normalizeDefeatedMonsterIds = (ids: string[] | unknown) => (
  Array.from(new Set((Array.isArray(ids) ? ids : []).filter((id): id is string => (
    typeof id === 'string' && isScopedDefeatedMonsterKey(id)
  ))))
);

const matchesDefeatedMonster = (
  defeatedMonsterIds: string[],
  difficulty: Difficulty,
  level: Level,
  mode: Mode,
  inputMode: InputMode,
  monsterId: string
) => {
  const scopedKey = getUniqueKey(difficulty, level, mode, inputMode, monsterId);
  return defeatedMonsterIds.includes(scopedKey);
};

const extractMonsterId = (uniqueKey: string) => {
    if (!uniqueKey) return "";
    const parts = uniqueKey.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : uniqueKey;
};

const getSpeedMultiplier = (charsPerSec: number): number => {
  if (charsPerSec < 0.8) return 1.0;
  if (charsPerSec < 1.2) return 1.2;
  if (charsPerSec < 1.6) return 1.4;
  if (charsPerSec < 2.0) return 1.6;
  if (charsPerSec < 2.4) return 1.8;
  if (charsPerSec < 2.8) return 2.0;
  if (charsPerSec < 3.2) return 2.2;
  if (charsPerSec < 3.6) return 2.4;
  if (charsPerSec < 4.0) return 2.6;
  if (charsPerSec < 4.4) return 2.8;
  return 3.0;
};

const getMonsterBattleDialogue = (
  monster: Monster,
  options: {
    isDefeated: boolean;
    isDamaged: boolean;
    hpRate: number;
    combo: number;
    missCount: number;
  }
): string => {
  if (options.isDefeated) return monster.dialogueDefeat;

  if (options.combo >= 7) {
    return monster.type === 'boss' ? 'な、なんだその猛攻は…！' : 'その勢い、ちょっと反則だよ！';
  }

  if (options.hpRate <= 0.2) {
    return monster.type === 'boss' ? 'まだだ…まだ倒れん…！' : 'ま、まだ負けない…！';
  }

  if (options.isDamaged) {
    if (monster.type === 'robot') return 'ダメージ確認…制御低下…！';
    if (monster.type === 'ghost') return 'その一撃はきいたぞ…！';
    if (monster.type === 'boss') return 'くっ…やるではないか！';
    return 'うわっ、きいたー！';
  }

  if (options.missCount >= 2) {
    return monster.type === 'boss' ? '迷いがあるぞ。そこを突く！' : '焦ってるね？ まだいけるかな？';
  }

  if (options.combo >= 3) {
    return monster.type === 'boss' ? '連撃だと…！？' : 'そんなに続けて決めるの！？';
  }

  return monster.dialogueStart;
};

const uniqueLines = (lines: string[]) => Array.from(new Set(lines.filter(Boolean)));

const getTypeSpecificDialogues = (monster: Monster, state: MonsterDialogueState): string[] => {
  const typeLines: Record<MonsterType, Partial<Record<MonsterDialogueState, string[]>>> = {
    slime: {
      start: ['今日のコンディションは半熟です。', 'ぷるぷる代表として負けられません。'],
      damaged: ['揺らすな揺らすな、中身が寄る〜！', 'いまの一撃で三層に分かれた！'],
      desperate: ['もうスライムというより、こぼれそうなゼリー...', '体積は減ってもプライドは増量中...！'],
    },
    beast: {
      start: ['ガオー！ と言いたいけど今日はのどが乾いてる。', '勢いだけで来た。作戦は途中で考える！'],
      damaged: ['うおっ、野生の勘が外れた！', 'いまのは毛並みにひびくやつ！'],
      desperate: ['足はふらつくが、見栄はまだ立っている！', '負けそうなので迫力だけ2割増しでいきます。'],
    },
    wing: {
      start: ['上空から失礼します。着地は未定です。', '飛べるけど方向音痴、それが空の流儀。'],
      damaged: ['羽がっ、羽が言うことを聞かない！', '今の一発で飛行プランが乱気流！'],
      desperate: ['高度が下がる、テンションも下がる...', 'このままだと徒歩帰宅コースです...'],
    },
    ghost: {
      start: ['ひゅ〜どろろ。効果音だけは一流です。', '背後を取る予定でしたが、今ちょっと迷ってます。'],
      damaged: ['ひゃっ、透ける透ける！', '驚かす側なのに、今ので私が驚いた！'],
      desperate: ['消えそうで消えない、しぶとい未練です...', '成仏の予約、まだキャンセルできますか？'],
    },
    robot: {
      start: ['起動完了。なお説明書は紛失しました。', 'ロックオン完了。たぶん合ってます。'],
      damaged: ['エラー発生。つよい、かなりつよい。', '装甲に傷。メンタルにも傷。'],
      desperate: ['出力低下...ですが見た目は平静を維持。', '警告。かっこよく負ける準備が始まりました。'],
    },
    boss: {
      start: ['余裕の登場だ。BGMだけ先に盛り上がっている。', '我こそは強敵。たぶん演出込みで。'],
      combo: ['その連打、反則では？ 反則じゃないのか...', '待て待て、その勢いだと私の威厳が追いつかん！'],
      damaged: ['くっ...今のは演出ではなく本当に痛い。', 'よろめいてなどいない。床が近づいただけだ。'],
      desperate: ['ここまで来るとは...脚本にない展開だぞ！', 'まだ終わらん...終わらんが、息は上がっている。'],
      taunt: ['手元が乱れているぞ。余裕がないのはお互い様だがな。', '集中が切れたか？ こちらは最初から切れ気味だ。'],
      defeat: ['見事だ...今日は威厳を置いて帰る。', '敗北を認めよう。拍手は小さめで頼む...。'],
    },
    object: {
      start: ['物なのにやる気だけは生きている。', '転がってきた。本人にも理由はよくわからない。'],
      damaged: ['あっ、そこは耐久試験の範囲外です！', 'きしむきしむ、でも一応まだ現役！'],
      desperate: ['部品が外れそう。気合いで留めています。', '形を保つので精一杯、でも登場料は返しません。'],
    },
  };

  return typeLines[monster.type][state] ?? [];
};

const getDefaultMonsterDialoguePool = (monster: Monster, state: MonsterDialogueState): string[] => {
  const genericLines: Record<MonsterDialogueState, string[]> = {
    start: [
      monster.dialogueStart,
      `${monster.name}が現れた。たぶん本人も少し緊張している。`,
      `${monster.name}「勝負の前に深呼吸。ふー、ふー、まだ長い！」`,
      `${monster.name}「タイピングで勝つ。できればスマートに！」`,
      `${monster.name}「今日はいい感じ。根拠はない！」`,
      `${monster.name}「負けたら帰り道で反省会します...」`,
      `${monster.name}「やる気だけ先に来ました！」`,
      `${monster.name}「本日の作戦名は『なんとかする』です！」`,
      `${monster.name}「勝負だ！ でもちょっと手加減してもいいよ？」`,
      `${monster.name}が吹き出しのネタを温めながら迫ってくる。`,
    ],
    combo: [
      `${monster.name}「そのコンボ、指にエンジン積んでる？」`,
      `${monster.name}「速い速い！ こっちは気持ちしか追いつかない！」`,
      `${monster.name}「待って、今ので三回くらい心が折れかけた！」`,
      `${monster.name}「そのテンポ、メトロノームが転職するレベル！」`,
      `${monster.name}「連続ヒット！？ こちらの言い訳が間に合わない！」`,
      `${monster.name}「押されてる！ でも口だけは元気です！」`,
      `${monster.name}「ちょっと本気がすぎませんこと！？」`,
      `${monster.name}「その勢い、もはやタイピングという名の天気！」`,
    ],
    desperate: [
      `${monster.name}「まだだ...まだセリフの在庫はある...！」`,
      `${monster.name}「ここで倒れたらオチがつかない！」`,
      `${monster.name}「ピンチです。顔には出てないつもりです！」`,
      `${monster.name}「ふらついているが、ボケる余力は残っている！」`,
      `${monster.name}「あと一歩...いや半歩くらいで危ない！」`,
      `${monster.name}「もうだめかも...いや、だめでも言い切らん！」`,
      `${monster.name}「この場を乗り切ったら甘いものを食べる！」`,
      `${monster.name}「根性で立ってる。物理法則とは相談中！」`,
    ],
    damaged: [
      `${monster.name}「いまの一撃、ちゃんと効くやつじゃん！」`,
      `${monster.name}「痛っ！ 今のは笑って流せない！」`,
      `${monster.name}「見た目より本気だね！？ それ困る！」`,
      `${monster.name}「ちょっと待って、心の準備がまだ！」`,
      `${monster.name}「その速さ、反省する暇もくれない！」`,
      `${monster.name}「うぐっ...今ので顔芸が一段階進んだ！」`,
      `${monster.name}「さすがに今のはノーカウントにしない？」`,
      `${monster.name}「痛い！ でもリアクションは100点を狙う！」`,
    ],
    taunt: [
      `${monster.name}「おやおや、指が迷子かな？」`,
      `${monster.name}「あせるとミスが増える。経験者は語る！」`,
      `${monster.name}「リズムが崩れてるぞ。こっちは最初から崩れてるが！」`,
      `${monster.name}「その打ち間違い、ちょっと親近感あるね！」`,
      `${monster.name}「落ち着いて！ 私まで落ち着いちゃうから！」`,
      `${monster.name}「手が止まった？ じゃあ今のうちに威張っとく！」`,
      `${monster.name}「集中、集中。私に言われたくはないだろうけど！」`,
      `${monster.name}「ミスが続くと、こちらの調子まで乗ってしまう！」`,
    ],
    defeat: [
      monster.dialogueDefeat,
      `${monster.name}「負けました...でも最後のリアクションは良かったはず。」`,
      `${monster.name}「完敗です。拍手より先に回復がほしい...。」`,
      `${monster.name}「次はもっと面白いセリフを持って戻る！」`,
      `${monster.name}「やられた〜！ でもちょっといい勝負だったよね？」`,
      `${monster.name}「今日は君が主役。私は字幕で十分です...。」`,
      `${monster.name}「くっ、敗北！ せめて転び方だけでも美しく...！」`,
      `${monster.name}「まいった。帰って吹き出し会議を開きます。」`,
    ],
  };

  return uniqueLines([
    ...genericLines[state],
    ...getTypeSpecificDialogues(monster, state),
    ...(monster.battleDialogues?.[state] ?? []),
  ]);
};

const getMonsterDialoguePool = (monster: Monster, state: MonsterDialogueState) => {
  const pool = getDefaultMonsterDialoguePool(monster, state);
  if (pool.length > 0) return pool;
  return state === 'defeat' ? [monster.dialogueDefeat] : [monster.dialogueStart];
};

void getMonsterDialoguePool;

const getBattleBubbleDialogue = (
  monster: Monster,
  options: {
    isDefeated: boolean;
    isDamaged: boolean;
    hpRate: number;
    combo: number;
    missCount: number;
  }
): string => {
  return getMonsterBattleDialogue(monster, options);
};

const SOUND_BASE_PATH = `${import.meta.env.BASE_URL}sound/`;
const BGM_VOLUME_LEVELS = [0, 0.035, 0.06, 0.092, 0.125, 0.16] as const;
const SPEECH_VOICE_OPTIONS: { id: SpeechVoiceMode; label: string; description: string }[] = [
  { id: 'random', label: 'ランダム', description: '4種類の音声からランダム' },
  { id: 'us_female', label: '米語 女性', description: 'アメリカ英語の女性音声' },
  { id: 'us_male', label: '米語 男性', description: 'アメリカ英語の男性音声' },
  { id: 'uk_female', label: '英語 女性', description: 'イギリス英語の女性音声' },
  { id: 'uk_male', label: '英語 男性', description: 'イギリス英語の男性音声' },
];
const NON_RANDOM_SPEECH_VOICE_MODES: Exclude<SpeechVoiceMode, 'random'>[] = ['us_female', 'us_male', 'uk_female', 'uk_male'];
const DIFFICULTIES: Difficulty[] = ['Eiken5', 'Eiken4', 'EikenPre1'];
const LEVELS: Level[] = [1, 2, 3];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  Eiken5: '英検5級',
  Eiken4: '英検4級',
  EikenPre1: '英検準1級',
};
const DIFFICULTY_GRADE_LABELS: Record<Difficulty, string> = {
  Eiken5: '英検 5級 (Grade 5)',
  Eiken4: '英検 4級 (Grade 4)',
  EikenPre1: '英検 準1級 (Grade Pre-1)',
};
const DIFFICULTY_GRADE_SUBLABELS: Record<Difficulty, string> = {
  Eiken5: 'Grade 5',
  Eiken4: 'Grade 4',
  EikenPre1: 'Grade Pre-1',
};
const DIFFICULTY_SCORE_TAB_ACTIVE_CLASSES: Record<Difficulty, string> = {
  Eiken5: 'bg-blue-600 border-blue-400 text-white',
  Eiken4: 'bg-purple-600 border-purple-400 text-white',
  EikenPre1: 'bg-emerald-600 border-emerald-400 text-white',
};
const DIFFICULTY_BUTTON_VARIANTS: Record<Difficulty, 'primary' | 'secondary' | 'warning'> = {
  Eiken5: 'primary',
  Eiken4: 'secondary',
  EikenPre1: 'warning',
};
const getAvailableLevels = (difficulty: Difficulty): Level[] => {
  void difficulty;
  return LEVELS;
};
const getSafeLevelForDifficulty = (difficulty: Difficulty, level: Level): Level => (
  getAvailableLevels(difficulty).includes(level) ? level : getAvailableLevels(difficulty)[0]
);
const FEMALE_VOICE_HINTS = ['female', 'woman', 'samantha', 'victoria', 'zira', 'ava', 'emma', 'susan', 'karen', 'moira', 'serena', 'libby', 'sonia', 'allison', 'anna', 'kathy', 'alice', 'fiona', 'sara', 'hazel', 'aria', 'jenny', 'joanna', 'salli', 'ivy', 'ruth', 'amy'];
const MALE_VOICE_HINTS = ['male', 'man', 'david', 'mark', 'daniel', 'alex', 'fred', 'tom', 'aaron', 'guy', 'arthur', 'andrew', 'brian', 'christopher', 'edward', 'george', 'james', 'jason', 'matthew', 'oliver', 'ryan', 'thomas', 'william', 'nathan', 'joey', 'roger', 'steffan', 'google uk english male', 'google us english male', 'microsoft david', 'microsoft mark', 'microsoft guy', 'guy online'];
const US_VOICE_HINTS = ['en-us', 'us', 'american', 'united states'];
const UK_VOICE_HINTS = ['en-gb', 'uk', 'british', 'england', 'great britain', 'united kingdom'];

const NORMAL_BATTLE_TRACKS = [
  `${SOUND_BASE_PATH}EnglishTyping001.mp3`,
  `${SOUND_BASE_PATH}EnglishTyping002.mp3`,
  `${SOUND_BASE_PATH}EnglishTyping003.mp3`,
  `${SOUND_BASE_PATH}EnglishTyping004.mp3`,
];

const BOSS_BATTLE_TRACKS = [
  `${SOUND_BASE_PATH}EnglishTyping005.mp3`,
  `${SOUND_BASE_PATH}EnglishTyping006.mp3`,
];
const EFFECT_SOUND_BASE_PATH = `${import.meta.env.BASE_URL}effect sound/`;
const DESIGN_ASSET_BASE_PATH = `${import.meta.env.BASE_URL}designs/`;
const DEFEAT_EFFECT_TRACKS = [
  `${EFFECT_SOUND_BASE_PATH}effectsound-defeat01.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-defeat02.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-defeat03.mp3`,
];
const BOSS_DEFEAT_EFFECT_TRACKS = [
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss01.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss02.mp3`,
];
const BOSS_COME_OUT_EFFECT_TRACKS = [
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss-come-out-01.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss-come-out-02.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss-come-out-03.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-boss-come-out-04.mp3`,
];
const LOSE_EFFECT_TRACKS = [
  `${EFFECT_SOUND_BASE_PATH}effectsound-lose01.mp3`,
  `${EFFECT_SOUND_BASE_PATH}effectsound-lose02.mp3`,
];
const EFFECT_SOUND_VOLUME = 0.45;

const SETTINGS_BGM_PREVIEW_TRACK = NORMAL_BATTLE_TRACKS[0];
const MAIN_CHARACTER_BACKGROUND_IMAGE = `${DESIGN_ASSET_BASE_PATH}Main-Character01-bg.webp`;
const SETTINGS_SPEECH_PREVIEW_TEXT = 'The brave hero learns English every day.';
const SPEECH_VOICE_COPY: Record<SpeechVoiceMode, { label: string; description: string }> = {
  random: {
    label: 'ランダム / Random',
    description: '4種類の英語音声からランダムで再生します。',
  },
  us_female: {
    label: '米語女性 / American Accent - Female',
    description: 'アメリカ英語の女性音声で再生します。',
  },
  us_male: {
    label: '米語男性 / American Accent - Male',
    description: 'アメリカ英語の男性音声で再生します。',
  },
  uk_female: {
    label: '英語女性 / British Accent - Female',
    description: 'イギリス英語の女性音声で再生します。',
  },
  uk_male: {
    label: '英語男性 / British Accent - Male',
    description: 'イギリス英語の男性音声で再生します。',
  },
};

let lastBattleMusicPath = '';

const getBattleMusicPath = (_mode: Mode, _inputMode: InputMode, isBoss: boolean): string => {
  const candidates = isBoss ? BOSS_BATTLE_TRACKS : NORMAL_BATTLE_TRACKS;
  const availableTracks = candidates.length > 1
    ? candidates.filter(track => track !== lastBattleMusicPath)
    : candidates;
  const nextTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  lastBattleMusicPath = nextTrack;
  return nextTrack;
};

const normalizeVoiceLang = (lang: string) => lang.toLowerCase().replace(/_/g, '-');

const normalizeVoiceText = (voice: SpeechSynthesisVoice) => (
  `${voice.name} ${voice.voiceURI} ${normalizeVoiceLang(voice.lang)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const matchesVoiceHint = (voice: SpeechSynthesisVoice, hints: string[]) => {
  const normalized = normalizeVoiceText(voice);
  const tokens = new Set(normalized.split(/\s+/));

  return hints.some(hint => {
    const normalizedHint = hint
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    if (!normalizedHint) return false;
    if (normalizedHint.includes(' ')) {
      return ` ${normalized} `.includes(` ${normalizedHint} `);
    }

    return tokens.has(normalizedHint);
  });
};

const isEnglishVoice = (voice: SpeechSynthesisVoice) => normalizeVoiceLang(voice.lang).startsWith('en');

const matchesVoiceLocale = (voice: SpeechSynthesisVoice, locale: 'en-us' | 'en-gb') => {
  const lang = normalizeVoiceLang(voice.lang);
  const localeHints = locale === 'en-us' ? US_VOICE_HINTS : UK_VOICE_HINTS;
  return lang === locale || lang.startsWith(`${locale}-`) || matchesVoiceHint(voice, localeHints);
};

const getSpeechLocale = (mode: Exclude<SpeechVoiceMode, 'random'>): 'en-US' | 'en-GB' => (
  mode.startsWith('us_') ? 'en-US' : 'en-GB'
);

const isExactSpeechModeSupported = (voices: SpeechSynthesisVoice[], mode: Exclude<SpeechVoiceMode, 'random'>) => {
  const locale = mode.startsWith('us_') ? 'en-us' : 'en-gb';
  const isFemaleMode = mode.endsWith('female');
  const localeVoices = voices.filter(voice => matchesVoiceLocale(voice, locale));

  if (localeVoices.length === 0) {
    return false;
  }

  if (isFemaleMode) {
    return localeVoices.some(voice => !matchesVoiceHint(voice, MALE_VOICE_HINTS));
  }

  return localeVoices.some(voice => (
    matchesVoiceHint(voice, MALE_VOICE_HINTS)
    && !matchesVoiceHint(voice, FEMALE_VOICE_HINTS)
  ));
};

const getSupportedSpeechModes = (voices: SpeechSynthesisVoice[]) => (
  NON_RANDOM_SPEECH_VOICE_MODES.filter(mode => isExactSpeechModeSupported(voices, mode))
);

const isSpeechModeSelectable = (voices: SpeechSynthesisVoice[], mode: SpeechVoiceMode) => (
  mode === 'random'
  || isExactSpeechModeSupported(voices, mode)
  || resolveSpeechConfig(voices, mode).resolution !== 'unresolved'
);

const matchesRequestedGender = (voice: SpeechSynthesisVoice, mode: Exclude<SpeechVoiceMode, 'random'>) => {
  const isFemaleMode = mode.endsWith('female');

  if (isFemaleMode) {
    return !matchesVoiceHint(voice, MALE_VOICE_HINTS);
  }

  return matchesVoiceHint(voice, MALE_VOICE_HINTS) && !matchesVoiceHint(voice, FEMALE_VOICE_HINTS);
};

const getVoiceMatchScore = (voice: SpeechSynthesisVoice, mode: Exclude<SpeechVoiceMode, 'random'>) => {
  const locale = mode.startsWith('us_') ? 'en-us' : 'en-gb';
  const isFemaleMode = mode.endsWith('female');
  const preferredHints = isFemaleMode ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
  const oppositeHints = isFemaleMode ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
  const preferredLocaleHints = locale === 'en-us' ? US_VOICE_HINTS : UK_VOICE_HINTS;
  const oppositeLocaleHints = locale === 'en-us' ? UK_VOICE_HINTS : US_VOICE_HINTS;
  const lang = normalizeVoiceLang(voice.lang);

  if (!lang.startsWith('en')) return -1_000;

  let score = 0;
  if (lang.startsWith(locale)) {
    score += 140;
  } else {
    score += 10;
  }

  if (matchesVoiceHint(voice, preferredLocaleHints)) {
    score += 45;
  }

  if (matchesVoiceHint(voice, oppositeLocaleHints)) {
    score -= 55;
  }

  if (matchesVoiceHint(voice, preferredHints)) {
    score += 50;
  }

  if (matchesVoiceHint(voice, oppositeHints)) {
    score -= 120;
  }

  if (voice.default) {
    score += 3;
  }

  return score;
};

const getStrictLocaleVoice = (voices: SpeechSynthesisVoice[], mode: Exclude<SpeechVoiceMode, 'random'>) => {
  const locale = mode.startsWith('us_') ? 'en-us' : 'en-gb';
  const isFemaleMode = mode.endsWith('female');
  const preferredHints = isFemaleMode ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
  const oppositeHints = isFemaleMode ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
  const localeVoices = voices.filter(voice => matchesVoiceLocale(voice, locale));

  if (localeVoices.length === 0) {
    return null;
  }

  const tiers = [
    (voice: SpeechSynthesisVoice) => matchesVoiceHint(voice, preferredHints) && !matchesVoiceHint(voice, oppositeHints),
    (voice: SpeechSynthesisVoice) => matchesVoiceHint(voice, preferredHints),
  ];

  for (const tier of tiers) {
    const candidates = localeVoices
      .filter(tier)
      .map(voice => ({ voice, score: getVoiceMatchScore(voice, mode) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.voice);

    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  const fallbackCandidates = localeVoices
    .map(voice => ({ voice, score: getVoiceMatchScore(voice, mode) }))
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.voice);

  return fallbackCandidates[0] ?? null;
};

const getGenderFallbackVoice = (voices: SpeechSynthesisVoice[], mode: Exclude<SpeechVoiceMode, 'random'>) => {
  const isFemaleMode = mode.endsWith('female');
  const preferredHints = isFemaleMode ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
  const oppositeHints = isFemaleMode ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
  const englishVoices = voices.filter(isEnglishVoice);
  const tiers = [
    (voice: SpeechSynthesisVoice) => matchesVoiceHint(voice, preferredHints) && !matchesVoiceHint(voice, oppositeHints),
    (voice: SpeechSynthesisVoice) => matchesVoiceHint(voice, preferredHints),
    (voice: SpeechSynthesisVoice) => !matchesVoiceHint(voice, oppositeHints),
  ];

  for (const tier of tiers) {
    const candidates = englishVoices
      .filter(tier)
      .map(voice => ({ voice, score: getVoiceMatchScore(voice, mode) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.voice);

    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  return null;
};

const resolveSpeechConfig = (voices: SpeechSynthesisVoice[], mode: SpeechVoiceMode): ResolvedSpeechConfig => {
  const supportedModes = getSupportedSpeechModes(voices);
  const resolvedMode: Exclude<SpeechVoiceMode, 'random'> = mode === 'random'
    ? supportedModes[Math.floor(Math.random() * supportedModes.length)] ?? 'us_female'
    : mode;

  const lang = getSpeechLocale(resolvedMode);
  const localeVoice = getStrictLocaleVoice(voices, resolvedMode);
  const hasLocaleGenderMatch = localeVoice ? matchesRequestedGender(localeVoice, resolvedMode) : false;
  const genderFallbackVoice = hasLocaleGenderMatch ? null : getGenderFallbackVoice(voices, resolvedMode);
  const resolvedVoice = localeVoice && hasLocaleGenderMatch
    ? localeVoice
    : genderFallbackVoice ?? localeVoice;
  const resolution: ResolvedSpeechConfig['resolution'] = localeVoice && hasLocaleGenderMatch
    ? 'locale-gender'
    : genderFallbackVoice
      ? 'gender-fallback'
      : localeVoice
        ? 'locale-fallback'
        : 'unresolved';

  return {
    mode: resolvedMode,
    lang,
    voice: resolvedVoice,
    resolution,
  };
};

const speakText = (
  text: string,
  options?: {
    voice?: SpeechSynthesisVoice | null;
    rate?: number;
    lang?: string;
    interrupt?: boolean;
    onend?: () => void;
    onerror?: () => void;
  }
) => {
  if (options?.interrupt !== false) {
    // Cancel any ongoing speech to prevent queuing lag
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.9;
  if (options?.voice) {
    utterance.voice = options.voice;
  }
  utterance.lang = options?.lang || options?.voice?.lang || 'en-US';
  utterance.onend = () => options?.onend?.();
  utterance.onerror = () => options?.onerror?.();

  window.speechSynthesis.speak(utterance);
};


// --- Sound Engine ---
class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambienceOscillators: OscillatorNode[] = [];
  private ambienceGain: GainNode | null = null;
  private battleMusic: HTMLAudioElement | null = null;
  private battleMusicElements = new Set<HTMLAudioElement>();
  private disposedBattleMusicElements = new WeakSet<HTMLAudioElement>();
  private effectAudioElements = new Set<HTMLAudioElement>();
  private currentBattleMusicSrc = '';
  private battleMusicRequestId = 0;
  private previewMusic: HTMLAudioElement | null = null;
  private previewMusicTimeout: number | null = null;
  private previewMusicRequestId = 0;
  private lastDefeatEffectSrc = '';
  private lastBossDefeatEffectSrc = '';
  private lastLoseEffectSrc = '';
  private lastBossComeOutEffectSrc = '';

  constructor() {
    try {
      const AudioContext = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
    } catch {
      console.error("Web Audio API not supported");
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playType() { this.playTone(800, 'square', 0.05, 0.05); }
  playMiss() { this.playTone(150, 'sawtooth', 0.3, 0.1); }
  
  playAttack() { 
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
  
  playCritical() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  private playRandomEffect(
    tracks: string[],
    volume: number,
    lastSrcKey: 'lastDefeatEffectSrc' | 'lastBossDefeatEffectSrc' | 'lastLoseEffectSrc' | 'lastBossComeOutEffectSrc',
  ) {
    if (tracks.length === 0) return;
    const availableTracks = tracks.length > 1
      ? tracks.filter(track => track !== this[lastSrcKey])
      : tracks;
    const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)] ?? tracks[0];
    this[lastSrcKey] = selectedTrack;
    const audio = new Audio(selectedTrack);
    audio.preload = 'auto';
    audio.volume = volume;
    this.effectAudioElements.add(audio);
    const releaseAudio = () => {
      audio.pause();
      audio.currentTime = 0;
      this.effectAudioElements.delete(audio);
    };
    audio.addEventListener('ended', releaseAudio, { once: true });
    audio.addEventListener('error', () => {
      console.error('Effect sound failed to load:', selectedTrack, audio.error);
      releaseAudio();
    });
    audio.load();
    void audio.play().catch((error) => {
      console.error('Effect sound play failed:', selectedTrack, error);
      releaseAudio();
    });
  }

  playClear() {
    this.playRandomEffect(DEFEAT_EFFECT_TRACKS, EFFECT_SOUND_VOLUME, 'lastDefeatEffectSrc');
  }
  
  playStageClear() {
    this.playRandomEffect(BOSS_DEFEAT_EFFECT_TRACKS, EFFECT_SOUND_VOLUME, 'lastBossDefeatEffectSrc');
  }

  playFail() {
    this.playRandomEffect(LOSE_EFFECT_TRACKS, EFFECT_SOUND_VOLUME, 'lastLoseEffectSrc');
  }

  playBossComeOut() {
    this.playRandomEffect(BOSS_COME_OUT_EFFECT_TRACKS, EFFECT_SOUND_VOLUME, 'lastBossComeOutEffectSrc');
  }
  
  playNewRecord() {
    this.playRandomEffect(BOSS_DEFEAT_EFFECT_TRACKS, EFFECT_SOUND_VOLUME * 0.9, 'lastBossDefeatEffectSrc');
  }

  startBattleAmbience(isBoss: boolean = false) {
    if (!this.ctx) return;
    if (this.ambienceOscillators.length > 0) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(isBoss ? 0.018 : 0.012, this.ctx.currentTime + 0.8);
    gain.connect(this.ctx.destination);

    const baseFrequencies = isBoss ? [65.4, 98.0] : [130.8, 196.0];
    const oscillators = baseFrequencies.map((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      osc.frequency.linearRampToValueAtTime(freq * (isBoss ? 1.08 : 1.04), this.ctx!.currentTime + (isBoss ? 3.5 : 4.5));
      osc.frequency.linearRampToValueAtTime(freq, this.ctx!.currentTime + (isBoss ? 7 : 9));
      oscGain.gain.setValueAtTime(index === 0 ? 0.7 : 0.35, this.ctx!.currentTime);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      return osc;
    });

    this.ambienceGain = gain;
    this.ambienceOscillators = oscillators;
  }

  stopBattleAmbience() {
    if (!this.ctx || !this.ambienceGain || this.ambienceOscillators.length === 0) return;

    const stopTime = this.ctx.currentTime + 0.6;
    this.ambienceGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambienceGain.gain.setValueAtTime(this.ambienceGain.gain.value, this.ctx.currentTime);
    this.ambienceGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    this.ambienceOscillators.forEach(osc => osc.stop(stopTime));
    this.ambienceOscillators = [];
    this.ambienceGain = null;
  }

  startBattleMusic(src: string, volume: number = 0.18) {
    this.stopBattleMusicPreview();

    if (this.currentBattleMusicSrc === src && this.battleMusic && this.battleMusicElements.size === 1) {
      this.battleMusic.volume = volume;
      void this.battleMusic.play().catch((error) => {
        console.error('Battle music replay failed:', src, error);
      });
      return;
    }

    this.stopBattleMusic();
    const requestId = ++this.battleMusicRequestId;

    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audio.src = src;
    this.battleMusicElements.add(audio);
    audio.onerror = () => {
      if (this.disposedBattleMusicElements.has(audio)) return;
      console.error('Battle music failed to load:', src, audio.error);
    };
    audio.oncanplaythrough = () => {
      if (this.disposedBattleMusicElements.has(audio) || this.battleMusic !== audio || this.battleMusicRequestId !== requestId) return;
      void audio.play().catch((error) => {
        if (this.disposedBattleMusicElements.has(audio) || this.battleMusic !== audio || this.battleMusicRequestId !== requestId) return;
        console.error('Battle music play after load failed:', src, error);
      });
    };
    this.battleMusic = audio;
    this.currentBattleMusicSrc = src;
    audio.load();
    void audio.play().catch((error) => {
      if (this.disposedBattleMusicElements.has(audio) || this.battleMusic !== audio || this.battleMusicRequestId !== requestId) return;
      console.error('Battle music initial play failed:', src, error);
    });
  }

  private disposeBattleMusicElement(audio: HTMLAudioElement) {
    this.disposedBattleMusicElements.add(audio);
    audio.oncanplaythrough = null;
    audio.onerror = null;
    audio.loop = false;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
    this.battleMusicElements.delete(audio);
  }

  stopBattleMusic() {
    this.battleMusicRequestId += 1;
    if (this.battleMusicElements.size > 0) {
      Array.from(this.battleMusicElements).forEach(audio => this.disposeBattleMusicElement(audio));
    }
    this.battleMusic = null;
    this.currentBattleMusicSrc = '';
  }

  setBattleMusicVolume(volume: number) {
    if (!this.battleMusic) return;
    this.battleMusic.volume = volume;
  }

  playBattleMusicPreview(src: string, volume: number = 0.18, durationMs: number = 2200) {
    this.stopBattleMusicPreview();
    const requestId = ++this.previewMusicRequestId;

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audio.src = src;
    audio.onerror = () => {
      console.error('Battle music preview failed to load:', src, audio.error);
    };
    audio.oncanplaythrough = () => {
      if (this.previewMusic !== audio || this.previewMusicRequestId !== requestId) return;
      void audio.play().catch((error) => {
        console.error('Battle music preview play after load failed:', src, error);
      });
    };

    this.previewMusic = audio;
    this.previewMusicTimeout = window.setTimeout(() => {
      this.stopBattleMusicPreview();
    }, durationMs);

    audio.load();
    void audio.play().catch((error) => {
      console.error('Battle music preview initial play failed:', src, error);
    });
  }

  stopBattleMusicPreview() {
    this.previewMusicRequestId += 1;
    if (this.previewMusicTimeout !== null) {
      window.clearTimeout(this.previewMusicTimeout);
      this.previewMusicTimeout = null;
    }
    if (!this.previewMusic) return;
    this.previewMusic.oncanplaythrough = null;
    this.previewMusic.onerror = null;
    this.previewMusic.pause();
    this.previewMusic.currentTime = 0;
    this.previewMusic.removeAttribute('src');
    this.previewMusic.load();
    this.previewMusic = null;
  }
}
const soundEngine = new SoundEngine();

const STORAGE_KEYS = {
  defeatedMonsters: 'etyping_defeated_monsters',
  bestScores: 'etyping_best_scores',
  maxKeystrokes: 'etyping_max_keystrokes',
  weakQuestions: 'etyping_weak_questions',
  weakQuestionStats: 'etyping_weak_question_stats',
  manualQuestionStatuses: 'etyping_manual_question_statuses',
  reviewQueue: 'etyping_review_queue',
  dailyProgress: 'etyping_daily_progress',
  bgmVolumeLevel: 'etyping_bgm_volume_level',
  speechVoiceMode: 'etyping_speech_voice_mode',
  speechRatePercent: 'etyping_speech_rate_percent',
  autoPlaySettings: 'etyping_auto_play_settings',
  selectedQuestionKeysByScope: 'etyping_selected_question_keys_by_scope',
  savedSelectionLists: 'etyping_saved_selection_lists',
  playerProfiles: 'etyping_player_profiles',
  activePlayerId: 'etyping_active_player_id',
} as const;

const safeLoadJson = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
};

const getTodayKey = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
}).format(new Date());

const createDailyProgress = (date: string = getTodayKey()): DailyProgress => ({
  date,
  questionCount: 0,
});

const getReviewScopeKey = (difficulty: Difficulty, level: Level) => `${difficulty}:${level}`;

const resolveLegacyReviewScope = (question: Question): { difficulty: Difficulty; level: Level } | null => {
  const matches = DIFFICULTIES.flatMap(difficulty => (
    getAvailableLevels(difficulty).flatMap(level => {
      const hasMatch = (QUESTIONS[difficulty]?.[level] ?? []).some(candidate => (
        candidate.text === question.text && candidate.translation === question.translation
      ));
      return hasMatch ? [{ difficulty, level }] : [];
    })
  ));

  return matches.length === 1 ? matches[0] : null;
};

const getDefaultWeakQuestionStat = (): WeakQuestionStat => ({
  missCount: 0,
  lastMissedAt: 0,
  consecutiveCorrect: 0,
});

const getDefaultAutoPlaySettings = (): AutoPlaySettings => ({
  source: 'all',
  playText: true,
  playTranslation: true,
  playExample: true,
  playbackRatePercent: 100,
  itemGapSeconds: 0.5,
  questionGapSeconds: 1.5,
});

const AUTO_PLAY_RATE_OPTIONS = [75, 100, 125, 150, 175, 200] as const;
const MIN_AUTO_PLAY_ITEM_GAP_SECONDS = 0.2;
const MIN_AUTO_PLAY_QUESTION_GAP_SECONDS = 0.5;

const getDefaultManualQuestionStatus = (): ManualQuestionStatus => ({
  practiceLevel: 1,
  battleLevel: 1,
  manualOverrideLevel: null,
  excluded: false,
  updatedAt: 0,
  learningLevel: 1,
});

const normalizeManualQuestionStatuses = (statuses: Record<string, ManualQuestionStatus> | unknown) => (
  Object.fromEntries(
    Object.entries(typeof statuses === 'object' && statuses !== null ? statuses : {}).map(([key, value]) => [
      key,
      withDerivedLearningLevel({
        practiceLevel: LEARNING_LEVELS.includes(value?.practiceLevel as LearningLevel)
          ? value.practiceLevel as LearningLevel
          : LEARNING_LEVELS.includes(value?.learningLevel as LearningLevel)
            ? value.learningLevel as LearningLevel
            : 1,
        battleLevel: LEARNING_LEVELS.includes(value?.battleLevel as LearningLevel)
          ? value.battleLevel as LearningLevel
          : 1,
        manualOverrideLevel: value?.manualOverrideLevel === null
          ? null
          : LEARNING_LEVELS.includes(value?.manualOverrideLevel as LearningLevel)
            ? value.manualOverrideLevel as LearningLevel
            : null,
        excluded: !!value?.excluded,
        updatedAt: Number.isFinite(value?.updatedAt) ? value.updatedAt : 0,
      }),
    ])
  ) as Record<string, ManualQuestionStatus>
);

const getQuestionStatusKey = (difficulty: Difficulty, level: Level, question: Question) => (
  `${difficulty}:${level}:${question.text}:${question.translation}`
);

const normalizeSelectedQuestionKeysByScope = (value: unknown) => (
  Object.fromEntries(
    Object.entries(typeof value === 'object' && value !== null ? value : {}).map(([key, item]) => [
      key,
      Array.isArray(item)
        ? item.filter((entry): entry is string => typeof entry === 'string')
        : [],
    ])
  ) as Record<string, string[]>
);

const normalizeSavedSelectionLists = (value: unknown): SavedSelectionList[] => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const typedItem = item as Partial<SavedSelectionList> & Record<string, unknown>;
      const difficulty = typedItem.difficulty;
      const level = typedItem.level;
      if (!DIFFICULTIES.includes(difficulty as Difficulty)) return [];
      if (![1, 2, 3].includes(level as number)) return [];

      return [{
        id: typeof typedItem.id === 'string' && typedItem.id.length > 0 ? typedItem.id : `${difficulty}:${level}:${Date.now()}`,
        name: typeof typedItem.name === 'string' && typedItem.name.trim().length > 0 ? typedItem.name.trim() : '保存リスト',
        difficulty: difficulty as Difficulty,
        level: level as Level,
        questionKeys: Array.isArray(typedItem.questionKeys)
          ? typedItem.questionKeys.filter((entry: unknown): entry is string => typeof entry === 'string')
          : [],
        updatedAt: Number.isFinite(typedItem.updatedAt) ? Number(typedItem.updatedAt) : 0,
      }];
    })
    : []
);

const normalizeAutoPlaySettings = (value: unknown): AutoPlaySettings => {
  const defaults = getDefaultAutoPlaySettings();
  if (!value || typeof value !== 'object') return defaults;
  const typedValue = value as Partial<AutoPlaySettings> & Record<string, unknown>;
  const normalizedSource: AutoPlaySource = typedValue.source === 'all' || typedValue.source === 'weak' || typedValue.source === 'selected'
    ? typedValue.source
    : defaults.source;

  return {
    source: normalizedSource,
    playText: typeof typedValue.playText === 'boolean' ? typedValue.playText : defaults.playText,
    playTranslation: typeof typedValue.playTranslation === 'boolean' ? typedValue.playTranslation : defaults.playTranslation,
    playExample: typeof typedValue.playExample === 'boolean' ? typedValue.playExample : defaults.playExample,
    playbackRatePercent: Number.isFinite(typedValue.playbackRatePercent) ? Math.min(250, Math.max(50, Number(typedValue.playbackRatePercent))) : defaults.playbackRatePercent,
    itemGapSeconds: Number.isFinite(typedValue.itemGapSeconds) ? Math.min(10, Math.max(0, Number(typedValue.itemGapSeconds))) : defaults.itemGapSeconds,
    questionGapSeconds: Number.isFinite(typedValue.questionGapSeconds) ? Math.min(15, Math.max(0, Number(typedValue.questionGapSeconds))) : defaults.questionGapSeconds,
  };
};

const getEffectiveLearningLevel = (status: ManualQuestionStatus): LearningLevel => (
  status.manualOverrideLevel ?? status.battleLevel
);

const withDerivedLearningLevel = (status: ManualQuestionStatus): ManualQuestionStatus => ({
  ...status,
  learningLevel: getEffectiveLearningLevel(status),
});

const normalizeWeakQuestionStats = (stats: Record<string, WeakQuestionStat>) => (
  Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [
      key,
      {
        missCount: Number.isFinite(value?.missCount) ? value.missCount : 0,
        lastMissedAt: Number.isFinite(value?.lastMissedAt) ? value.lastMissedAt : 0,
        consecutiveCorrect: Number.isFinite(value?.consecutiveCorrect) ? value.consecutiveCorrect : 0,
      },
    ])
  ) as Record<string, WeakQuestionStat>
);

const normalizeReviewQueue = (entries: ReviewQueueEntry[] | unknown) => (
  (Array.isArray(entries) ? entries : [])
    .map(entry => {
      if (!entry?.question?.text || !entry?.question?.translation) return null;

      const resolvedScope =
        (DIFFICULTIES.includes(entry.difficulty) && getAvailableLevels(entry.difficulty as Difficulty).includes(entry.level as Level))
          ? { difficulty: entry.difficulty as Difficulty, level: entry.level as Level }
          : resolveLegacyReviewScope(entry.question);

      if (!resolvedScope) return null;

      return {
        difficulty: resolvedScope.difficulty,
        level: resolvedScope.level,
        question: entry.question,
        remainingQuestions: Number.isFinite(entry.remainingQuestions) ? Math.max(0, entry.remainingQuestions) : 0,
        missCount: Number.isFinite(entry.missCount) ? Math.max(1, entry.missCount) : 1,
      };
    })
    .filter((entry): entry is ReviewQueueEntry => entry !== null)
);

const normalizeDailyProgress = (value: unknown): DailyProgress => {
  const todayKey = getTodayKey();
  if (!value || typeof value !== 'object') return createDailyProgress(todayKey);

  const typedValue = value as Partial<DailyProgress>;
  const date = typeof typedValue.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(typedValue.date)
    ? typedValue.date
    : todayKey;
  const questionCount = Number.isFinite(typedValue.questionCount) ? Math.max(0, Number(typedValue.questionCount)) : 0;

  return { date, questionCount };
};

const normalizeQuestionArray = (value: unknown): Question[] => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const typedItem = item as Partial<Question>;
      if (typeof typedItem.text !== 'string' || typeof typedItem.translation !== 'string') return [];

      const nextQuestion: Question = {
        text: typedItem.text,
        translation: typedItem.translation,
      };

      if (typeof typedItem.basicMeaning === 'string' && typedItem.basicMeaning.trim()) {
        nextQuestion.basicMeaning = typedItem.basicMeaning.trim();
      }
      if (typeof typedItem.exampleEn === 'string' && typedItem.exampleEn.trim()) {
        nextQuestion.exampleEn = typedItem.exampleEn.trim();
      }
      if (typeof typedItem.exampleJa === 'string' && typedItem.exampleJa.trim()) {
        nextQuestion.exampleJa = typedItem.exampleJa.trim();
      }

      return [nextQuestion];
    })
    : []
);

const normalizePlayerProfileData = (value: unknown): PlayerProfileData => {
  const typedValue = typeof value === 'object' && value !== null ? value as Partial<PlayerProfileData> : {};

  return {
    defeatedMonsterIds: normalizeDefeatedMonsterIds(typedValue.defeatedMonsterIds ?? []),
    bestScores: normalizeBestScores(typedValue.bestScores ?? {}),
    maxKeystrokes: normalizeMaxKeystrokes(typedValue.maxKeystrokes),
    weakQuestions: normalizeQuestionArray(typedValue.weakQuestions ?? []),
    weakQuestionStats: normalizeWeakQuestionStats(typedValue.weakQuestionStats ?? {}),
    manualQuestionStatuses: normalizeManualQuestionStatuses(typedValue.manualQuestionStatuses ?? {}),
    reviewQueue: normalizeReviewQueue(typedValue.reviewQueue ?? []),
    dailyProgress: normalizeDailyProgress(typedValue.dailyProgress ?? createDailyProgress()),
    bgmVolumeLevel: normalizeBgmVolumeLevel(typedValue.bgmVolumeLevel),
    speechVoiceMode: normalizeSpeechVoiceMode(typedValue.speechVoiceMode),
    speechRatePercent: normalizeSpeechRatePercent(typedValue.speechRatePercent),
    autoPlaySettings: normalizeAutoPlaySettings(typedValue.autoPlaySettings ?? getDefaultAutoPlaySettings()),
    selectedQuestionKeysByScope: normalizeSelectedQuestionKeysByScope(typedValue.selectedQuestionKeysByScope ?? {}),
    savedSelectionLists: normalizeSavedSelectionLists(typedValue.savedSelectionLists ?? []),
  };
};

const normalizePlayerProfiles = (value: unknown): PlayerProfile[] => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const typedItem = item as Partial<PlayerProfile>;
      if (typeof typedItem.id !== 'string' || typedItem.id.trim().length === 0) return [];

      return [{
        id: typedItem.id,
        name: typeof typedItem.name === 'string' && typedItem.name.trim().length > 0 ? typedItem.name.trim() : 'Player',
        updatedAt: Number.isFinite(typedItem.updatedAt) ? Number(typedItem.updatedAt) : 0,
        data: normalizePlayerProfileData(typedItem.data ?? {}),
      }];
    })
    : []
);

const normalizeBestScores = (value: unknown): Record<string, number> => (
  Object.fromEntries(
    Object.entries(typeof value === 'object' && value !== null ? value : {}).flatMap(([key, score]) => (
      Number.isFinite(score) ? [[key, Math.max(0, Number(score))]] : []
    ))
  )
);

const normalizeMaxKeystrokes = (value: unknown): number => (
  Number.isFinite(value) ? Math.max(0, Number(value)) : 0
);

const normalizeBgmVolumeLevel = (value: unknown): number => (
  Number.isFinite(value) && Number(value) >= 0 && Number(value) < BGM_VOLUME_LEVELS.length
    ? Number(value)
    : 3
);

const normalizeSpeechVoiceMode = (value: unknown): SpeechVoiceMode => (
  SPEECH_VOICE_OPTIONS.some((option) => option.id === value)
    ? value as SpeechVoiceMode
    : 'us_female'
);

const normalizeSpeechRatePercent = (value: unknown): number => (
  Number.isFinite(value) ? Math.min(250, Math.max(50, Number(value))) : 100
);

const isProgressExportPayload = (value: unknown): value is ProgressExportPayload => {
  if (!value || typeof value !== 'object') return false;
  const typedValue = value as Partial<ProgressExportPayload>;
  return typedValue.app === 'english-typing-rpg'
    && typeof typedValue.formatVersion === 'number'
    && typedValue.formatVersion >= 1
    && typeof typedValue.exportedAt === 'string'
    && (
      (!!typedValue.player && typeof typedValue.player === 'object' && typeof typedValue.player.id === 'string')
      || (!!typedValue.data && typeof typedValue.data === 'object')
    );
};

const MONSTER_VISUALS: Partial<Record<string, MonsterVisualStyle>> = {
  m1_1: { primary: 'halo', secondary: 'orbital', accentColor: '#FDE68A', eyeColor: '#0F172A' },
  m1_2: { primary: 'mimic', secondary: 'runes', accentColor: '#86EFAC', eyeColor: '#DCFCE7' },
  m1_3: { primary: 'flare', secondary: 'halo', accentColor: '#FACC15', eyeColor: '#FEF3C7' },
  m1_4: { primary: 'horns', secondary: 'spikes', accentColor: '#FDBA74', eyeColor: '#7C2D12' },
  m1_5: { primary: 'halo', accentColor: '#FFD1F3' },
  m1_6: { primary: 'crystal', secondary: 'orbital', accentColor: '#BFDBFE', eyeColor: '#E0F2FE' },
  m1_7: { primary: 'mask', secondary: 'runes', accentColor: '#D1D5DB', eyeColor: '#F8FAFC' },
  m1_8: { primary: 'crown', secondary: 'cape', accentColor: '#F59E0B', eyeColor: '#FEF3C7' },
  m1_9: { primary: 'mimic', secondary: 'runes', accentColor: '#FCD34D' },
  m1_10: { primary: 'crown', secondary: 'sigil', accentColor: '#FBBF24', eyeColor: '#FFE066', silhouette: 'wyvern' },
  c1_1: { primary: 'runes', accentColor: '#A78BFA', eyeColor: '#C4B5FD' },
  c1_2: { primary: 'horns', secondary: 'spikes', accentColor: '#FCA5A5' },
  c1_3: { primary: 'halo', secondary: 'flare', accentColor: '#67E8F9', eyeColor: '#ECFEFF' },
  c1_4: { primary: 'mask', secondary: 'halo', accentColor: '#E9D5FF' },
  c1_5: { primary: 'spikes', secondary: 'orbital', accentColor: '#94A3B8', eyeColor: '#7DD3FC' },
  c1_6: { primary: 'crystal', secondary: 'runes', accentColor: '#D6D3D1', eyeColor: '#FEF3C7' },
  c1_8: { primary: 'horns', secondary: 'flare', accentColor: '#FCA5A5', eyeColor: '#FEE2E2' },
  c1_9: { primary: 'mask', secondary: 'orbital', accentColor: '#A78BFA', eyeColor: '#DDD6FE' },
  c1_10: { primary: 'crystal', secondary: 'runes', accentColor: '#FCA5A5' },
  c1_7: { primary: 'flare', secondary: 'sigil', accentColor: '#F59E0B', eyeColor: '#FDE68A', silhouette: 'overlord' },
  c2_3: { primary: 'halo', secondary: 'crystal', accentColor: '#FDE047' },
  c2_4: { primary: 'mask', secondary: 'cape', accentColor: '#CBD5E1' },
  c2_5: { primary: 'orbital', secondary: 'spikes', accentColor: '#FBBF24', eyeColor: '#67E8F9' },
  c2_7: { primary: 'flare', secondary: 'sigil', accentColor: '#A78BFA', eyeColor: '#F8FAFC', silhouette: 'reaper' },
  m3_7: { primary: 'mask', secondary: 'mimic', accentColor: '#E2E8F0' },
  m3_9: { primary: 'orbital', secondary: 'halo', accentColor: '#60A5FA', eyeColor: '#C4B5FD' },
  m3_10: { primary: 'flare', secondary: 'sigil', accentColor: '#C4B5FD', eyeColor: '#FDE68A', silhouette: 'overlord' },
  c3_3: { primary: 'halo', secondary: 'spikes', accentColor: '#93C5FD' },
  c3_4: { primary: 'mask', secondary: 'runes', accentColor: '#E2E8F0' },
  c3_5: { primary: 'orbital', secondary: 'crystal', accentColor: '#FCD34D', eyeColor: '#5EEAD4' },
  c3_7: { primary: 'flare', secondary: 'sigil', accentColor: '#F59E0B', eyeColor: '#FECACA', silhouette: 'apocalypse' },
  c3_8: { primary: 'halo', secondary: 'runes', accentColor: '#F8FAFC' },
  c3_9: { primary: 'spikes', secondary: 'mask', accentColor: '#D1D5DB' },
  c3_10: { primary: 'horns', secondary: 'crystal', accentColor: '#FDA4AF' },
};

const getMonsterVisualStyle = (monster: Monster): MonsterVisualStyle | undefined => {
  const presetStyle = MONSTER_VISUALS[monster.id];
  if (presetStyle) return presetStyle;

  const theme = monster.theme.toLowerCase();
  const name = monster.name;

  if (theme.includes('dark') || theme.includes('curse') || theme.includes('void') || theme.includes('abyss') || theme.includes('nightmare')) {
    return { primary: 'runes', secondary: 'mask', accentColor: '#C4B5FD', eyeColor: '#DDD6FE' };
  }

  if (theme.includes('fire') || theme.includes('inferno') || theme.includes('thunder') || theme.includes('crimson') || theme.includes('chaos')) {
    return { primary: 'spikes', secondary: 'crystal', accentColor: '#FCA5A5', eyeColor: '#FDE68A' };
  }

  if (theme.includes('ancient') || theme.includes('steel') || theme.includes('titan') || theme.includes('clean')) {
    return { primary: 'orbital', secondary: 'spikes', accentColor: '#93C5FD', eyeColor: '#67E8F9' };
  }

  if (theme.includes('book') || theme.includes('art') || theme.includes('mirror') || theme.includes('maze')) {
    return { primary: 'mask', secondary: 'runes', accentColor: '#FDE68A' };
  }

  if (theme.includes('sleep') || theme.includes('sleepy') || theme.includes('lost') || theme.includes('scary')) {
    return { primary: 'halo', secondary: 'orbital', accentColor: '#BFDBFE' };
  }

  if (name.includes('王') || name.includes('魔王') || name.includes('終焉') || monster.type === 'boss') {
    return { primary: 'crown', secondary: 'cape', accentColor: '#FBBF24', eyeColor: '#FDE68A' };
  }

  switch (monster.type) {
    case 'slime':
      return { primary: 'orbital', accentColor: '#BAE6FD' };
    case 'beast':
      return { primary: 'horns', secondary: 'spikes', accentColor: '#FCD34D' };
    case 'wing':
      return { primary: 'halo', secondary: 'crystal', accentColor: '#E0E7FF' };
    case 'ghost':
      return { primary: 'mask', secondary: 'halo', accentColor: '#E9D5FF', eyeColor: '#C4B5FD' };
    case 'robot':
      return { primary: 'orbital', secondary: 'runes', accentColor: '#93C5FD', eyeColor: '#67E8F9' };
    case 'object':
      return { primary: 'crystal', secondary: 'mimic', accentColor: '#FDE68A' };
    default:
      return undefined;
  }
};

// --- Rich Monster Avatar Component (SVG) ---
const MonsterAvatar = ({ type, color, emotion = 'normal', size = 150, visualStyle }: { type: MonsterType, color: string, emotion?: 'normal' | 'damage' | 'win', size?: number, visualStyle?: MonsterVisualStyle }) => {
  const mainColor = color;
  const gradientId = `grad-${type}-${color.replace('#', '')}`;
  const accentColor = visualStyle?.accentColor ?? '#F8FAFC';
  
  const renderBody = () => {
    switch (type) {
      case 'slime':
        return <g filter="url(#glow)"><path d="M-50 40 Q-60 0 0 -50 Q60 0 50 40 Q40 60 0 60 Q-40 60 -50 40" fill={`url(#${gradientId})`} stroke="rgba(255,255,255,0.5)" strokeWidth="2" /><circle cx="0" cy="10" r="25" fill={mainColor} opacity="0.6" filter="url(#blur)" /><circle cx="0" cy="10" r="15" fill="white" opacity="0.3" filter="url(#blur)" /><ellipse cx="-20" cy="-20" rx="10" ry="5" fill="white" opacity="0.7" transform="rotate(-45)" /><circle cx="20" cy="-25" r="3" fill="white" opacity="0.5" /><path d="M-30 55 Q-25 65 -20 55" fill={mainColor} stroke="none" /></g>;
      case 'beast': 
        return <g filter="url(#shadow)"><path d="M-40 -30 L-55 -70 L-20 -50 Z" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M40 -30 L55 -70 L20 -50 Z" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M-50 0 Q-60 -40 0 -50 Q60 -40 50 0 Q60 30 40 50 L0 60 L-40 50 Q-60 30 -50 0" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M-50 0 L-60 10 L-50 20" fill="none" stroke={mainColor} strokeWidth="2" /><path d="M50 0 L60 10 L50 20" fill="none" stroke={mainColor} strokeWidth="2" /><ellipse cx="0" cy="20" rx="20" ry="14" fill="#ffddaa" stroke="#222" strokeWidth="2" /><path d="M-5 15 L5 15 L0 22 Z" fill="#222" /><path d="M0 22 L0 28 M-5 28 Q0 32 5 28" stroke="#222" strokeWidth="2" fill="none" /></g>;
      case 'wing': 
        return <g filter="url(#shadow)"><path d="M-20 0 Q-80 -40 -70 20 L-40 10 Z" fill="#222" opacity="0.3" /><path d="M20 0 Q80 -40 70 20 L40 10 Z" fill="#222" opacity="0.3" /><path d="M-30 10 Q-90 -50 -80 30 Q-60 50 -30 20" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M30 10 Q90 -50 80 30 Q60 50 30 20" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><circle cx="0" cy="0" r="35" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><circle cx="0" cy="10" r="20" fill="white" opacity="0.2" /><path d="M-20 -25 L-25 -50 L-10 -30" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M20 -25 L25 -50 L10 -30" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /></g>;
      case 'ghost':
        return <g filter="url(#glow)"><path d="M-40 50 Q-50 0 0 -50 Q50 0 40 50 Q30 40 20 50 Q10 40 0 50 Q-10 40 -20 50 Q-30 40 -40 50" fill={`url(#${gradientId})`} opacity="0.8" /><circle cx="0" cy="-10" r="40" fill={mainColor} opacity="0.3" filter="url(#blur)" /><circle cx="-25" cy="10" r="5" fill="#ffaaaa" opacity="0.6" /><circle cx="25" cy="10" r="5" fill="#ffaaaa" opacity="0.6" /></g>;
      case 'robot':
        return <g filter="url(#shadow)"><line x1="0" y1="-50" x2="0" y2="-70" stroke="#444" strokeWidth="4" /><circle cx="0" cy="-70" r="6" fill="red" stroke="#222" strokeWidth="2" filter="url(#glow)" /><circle cx="0" cy="-70" r="2" fill="white" opacity="0.8" /><rect x="-45" y="-50" width="90" height="80" rx="15" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><rect x="-35" y="-30" width="70" height="30" rx="5" fill="#222" stroke="#444" strokeWidth="2" /><path d="M-30 -25 L30 -25" stroke="lime" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" /><rect x="-55" y="-30" width="10" height="20" fill="#888" stroke="#222" strokeWidth="2" /><rect x="45" y="-30" width="10" height="20" fill="#888" stroke="#222" strokeWidth="2" /><line x1="-20" y1="15" x2="20" y2="15" stroke="#333" strokeWidth="2" /><line x1="-20" y1="20" x2="20" y2="20" stroke="#333" strokeWidth="2" /><line x1="-20" y1="25" x2="20" y2="25" stroke="#333" strokeWidth="2" /></g>;
      case 'object': 
        return <g filter="url(#shadow)"><rect x="-40" y="-50" width="80" height="100" rx="5" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M-35 45 L35 45 L30 35 L-30 35 Z" fill="#fff" stroke="#ccc" /><circle cx="0" cy="0" r="15" fill="gold" stroke="#b8860b" strokeWidth="3" /><rect x="-5" y="-5" width="10" height="10" fill="#222" /><path d="M-40 -50 L-20 -50 L-40 -30 Z" fill="gold" stroke="#222" strokeWidth="2" /><path d="M40 -50 L20 -50 L40 -30 Z" fill="gold" stroke="#222" strokeWidth="2" /><path d="M-40 50 L-20 50 L-40 30 Z" fill="gold" stroke="#222" strokeWidth="2" /><path d="M40 50 L20 50 L40 30 Z" fill="gold" stroke="#222" strokeWidth="2" /></g>;
      case 'boss': {
        const silhouette = visualStyle?.silhouette ?? 'overlord';

        if (silhouette === 'wyvern') {
          return <g filter="url(#shadow)"><path d="M-54 -8 Q-96 -40 -82 10 Q-66 28 -36 10" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M54 -8 Q96 -40 82 10 Q66 28 36 10" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="3" /><path d="M-22 -42 L-40 -72 L-10 -50 Z" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M22 -42 L40 -72 L10 -50 Z" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M-44 18 Q-48 -34 0 -50 Q48 -34 44 18 Q36 58 0 62 Q-36 58 -44 18" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M-18 44 L-6 62 L6 62 L18 44" fill="none" stroke="#222" strokeWidth="4" strokeLinecap="round" /><path d="M-28 -8 Q0 -22 28 -8" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="3" /></g>;
        }

        if (silhouette === 'reaper') {
          return <g filter="url(#shadow)"><path d="M-8 -62 Q24 -72 40 -44 Q18 -42 4 -20 Z" fill="rgba(15,23,42,0.92)" stroke={accentColor} strokeWidth="3" /><path d="M-50 54 Q-16 8 -10 -42 Q18 -10 48 52 Q26 62 0 62 Q-28 62 -50 54" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M-38 16 Q-76 28 -70 54 Q-40 46 -20 26" fill="rgba(15,23,42,0.9)" stroke="#222" strokeWidth="3" /><path d="M38 16 Q76 28 70 54 Q40 46 20 26" fill="rgba(15,23,42,0.9)" stroke="#222" strokeWidth="3" /><path d="M0 -50 L0 58" stroke="rgba(255,255,255,0.18)" strokeWidth="3" /><circle cx="0" cy="-12" r="30" fill="rgba(15,23,42,0.35)" /></g>;
        }

        if (silhouette === 'apocalypse') {
          return <g filter="url(#shadow)"><path d="M-46 -18 L-74 -48 L-40 -40" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M46 -18 L74 -48 L40 -40" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M-22 -42 L-42 -78 L-8 -52 Z" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M22 -42 L42 -78 L8 -52 Z" fill={accentColor} stroke="#222" strokeWidth="3" /><path d="M-54 -8 Q0 -88 54 -8 L42 16 L54 52 Q0 82 -54 52 L-42 16 Z" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M-30 28 L0 8 L30 28 L18 58 L-18 58 Z" fill="rgba(0,0,0,0.22)" /><path d="M-34 -6 L34 -6 M-28 18 L28 18" stroke="rgba(255,255,255,0.2)" strokeWidth="3" /></g>;
        }

        return <g filter="url(#shadow)"><path d="M-58 46 Q-46 2 -30 -30 L-12 -12 L-22 44 Z" fill="rgba(15,23,42,0.7)" stroke="#222" strokeWidth="3" /><path d="M58 46 Q46 2 30 -30 L12 -12 L22 44 Z" fill="rgba(15,23,42,0.7)" stroke="#222" strokeWidth="3" /><path d="M-26 -42 C-44 -70 -66 -54 -78 -66" fill="none" stroke="#222" strokeWidth="8" /><path d="M-26 -42 C-44 -70 -66 -54 -78 -66" fill="none" stroke={accentColor} strokeWidth="4" /><path d="M26 -42 C44 -70 66 -54 78 -66" fill="none" stroke="#222" strokeWidth="8" /><path d="M26 -42 C44 -70 66 -54 78 -66" fill="none" stroke={accentColor} strokeWidth="4" /><path d="M-50 -26 Q0 -74 50 -26 L42 50 Q0 80 -42 50 Z" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M0 -26 L0 52" stroke="rgba(255,255,255,0.16)" strokeWidth="3" /><path d="M-26 -8 L26 -8" stroke="rgba(255,255,255,0.16)" strokeWidth="3" /><path d="M-36 22 L36 22" stroke="rgba(255,255,255,0.16)" strokeWidth="3" /></g>;
      }
      default: return <circle cx="0" cy="0" r="35" fill={`url(#${gradientId})`} />;
    }
  };

  const renderVariant = (variant?: MonsterVisualVariant) => {
    switch (variant) {
      case 'horns':
        return (
          <g>
            <path d="M-18 -38 L-34 -72 L-8 -50 Z" fill={accentColor} stroke="#111827" strokeWidth="3" />
            <path d="M18 -38 L34 -72 L8 -50 Z" fill={accentColor} stroke="#111827" strokeWidth="3" />
          </g>
        );
      case 'crown':
        return (
          <g>
            <path d="M-30 -48 L-18 -68 L0 -52 L18 -68 L30 -48 L24 -34 L-24 -34 Z" fill={accentColor} stroke="#111827" strokeWidth="3" />
            <circle cx="-18" cy="-52" r="4" fill="#FEF3C7" />
            <circle cx="0" cy="-58" r="4.5" fill="#FCA5A5" />
            <circle cx="18" cy="-52" r="4" fill="#BFDBFE" />
          </g>
        );
      case 'mask':
        return (
          <g>
            <path d="M-32 -8 Q0 -28 32 -8 Q24 22 0 30 Q-24 22 -32 -8 Z" fill="rgba(15,23,42,0.72)" stroke={accentColor} strokeWidth="3" />
            <path d="M-20 -6 Q-10 -16 0 -6" fill="none" stroke={accentColor} strokeWidth="2" />
            <path d="M20 -6 Q10 -16 0 -6" fill="none" stroke={accentColor} strokeWidth="2" />
          </g>
        );
      case 'runes':
        return (
          <g opacity="0.88">
            <circle cx="-42" cy="-6" r="8" fill="none" stroke={accentColor} strokeWidth="2.5" />
            <path d="M-42 -14 L-42 2 M-50 -6 L-34 -6" stroke={accentColor} strokeWidth="2" />
            <circle cx="42" cy="8" r="9" fill="none" stroke={accentColor} strokeWidth="2.5" />
            <path d="M42 -1 L42 17 M35 8 L49 8" stroke={accentColor} strokeWidth="2" />
          </g>
        );
      case 'crystal':
        return (
          <g>
            <path d="M-46 18 L-30 -18 L-18 12 Z" fill={accentColor} opacity="0.8" stroke="#111827" strokeWidth="2.5" />
            <path d="M46 10 L26 -22 L14 6 Z" fill={accentColor} opacity="0.7" stroke="#111827" strokeWidth="2.5" />
            <path d="M0 -44 L12 -70 L24 -42 Z" fill={accentColor} opacity="0.85" stroke="#111827" strokeWidth="2.5" />
          </g>
        );
      case 'mimic':
        return (
          <g>
            <path d="M-24 26 L24 26 L0 42 Z" fill="#111827" />
            <path d="M-22 26 L-16 18 L-10 26 L-4 18 L2 26 L8 18 L14 26 L20 18 L26 26" fill="none" stroke="#F8FAFC" strokeWidth="3" strokeLinejoin="round" />
          </g>
        );
      case 'halo':
        return (
          <g>
            <ellipse cx="0" cy="-52" rx="30" ry="10" fill="none" stroke={accentColor} strokeWidth="4" opacity="0.95" />
            <ellipse cx="0" cy="-52" rx="18" ry="5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
          </g>
        );
      case 'spikes':
        return (
          <g>
            <path d="M-46 14 L-62 8 L-46 -2" fill={accentColor} stroke="#111827" strokeWidth="2.5" />
            <path d="M46 14 L62 8 L46 -2" fill={accentColor} stroke="#111827" strokeWidth="2.5" />
            <path d="M-28 48 L-18 66 L-4 48" fill={accentColor} stroke="#111827" strokeWidth="2.5" />
            <path d="M28 48 L18 66 L4 48" fill={accentColor} stroke="#111827" strokeWidth="2.5" />
          </g>
        );
      case 'cape':
        return (
          <g opacity="0.92">
            <path d="M-38 -12 Q0 12 38 -12 L52 44 Q0 74 -52 44 Z" fill="rgba(127,29,29,0.78)" stroke="#111827" strokeWidth="3" />
            <path d="M-12 -22 Q0 -14 12 -22" fill="none" stroke={accentColor} strokeWidth="3" />
          </g>
        );
      case 'orbital':
        return (
          <g>
            <ellipse cx="0" cy="4" rx="52" ry="16" fill="none" stroke={accentColor} strokeWidth="3" opacity="0.8" />
            <circle cx="-48" cy="0" r="5" fill={accentColor} />
            <circle cx="48" cy="8" r="4" fill="#F8FAFC" opacity="0.9" />
          </g>
        );
      case 'sigil':
        return (
          <g opacity="0.92">
            <circle cx="0" cy="2" r="58" fill="none" stroke={accentColor} strokeWidth="3" strokeDasharray="6 5" />
            <circle cx="0" cy="2" r="44" fill="none" stroke="rgba(248,250,252,0.55)" strokeWidth="1.8" />
            <path d="M0 -48 L12 -18 L42 -18 L18 0 L28 30 L0 12 L-28 30 L-18 0 L-42 -18 L-12 -18 Z" fill="none" stroke={accentColor} strokeWidth="2.4" strokeLinejoin="round" />
          </g>
        );
      case 'flare':
        return (
          <g opacity="0.95">
            <circle cx="0" cy="-4" r="54" fill={accentColor} opacity="0.14" filter="url(#blur)" />
            <path d="M0 -74 L8 -50 L28 -64 L22 -38 L48 -42 L30 -18 L58 -8 L30 2 L48 24 L20 18 L24 46 L0 28 L-24 46 L-20 18 L-48 24 L-30 2 L-58 -8 L-30 -18 L-48 -42 L-22 -38 L-28 -64 L-8 -50 Z" fill={accentColor} opacity="0.78" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderFace = () => {
    const isRobot = type === 'robot';
    const isGhost = type === 'ghost';
    const eyeFill = emotion === 'damage'
      ? '#ff0000'
      : visualStyle?.eyeColor ?? (isRobot || isGhost ? '#00ffcc' : '#222');
    const eyeStroke = isRobot || isGhost ? 'none' : '#222';
    const isBoss = type === 'boss';
    
    if (emotion === 'damage') {
        return <g transform={isRobot ? 'translate(0, -15)' : 'translate(0, 0)'}><path d="M-25 -10 L-10 0 M-10 -10 L-25 0" stroke={eyeFill} strokeWidth="5" strokeLinecap="round" /><path d="M10 -10 L25 0 M25 -10 L10 0" stroke={eyeFill} strokeWidth="5" strokeLinecap="round" /><ellipse cx="0" cy="20" rx="8" ry="10" fill="#222" /></g>;
    } else if (emotion === 'win') {
         return <g transform={isRobot ? 'translate(0, -15)' : 'translate(0, 0)'}><path d="M-25 -5 L-15 -15 L-5 -5" fill="none" stroke={eyeFill} strokeWidth="4" strokeLinecap="round" /><path d="M5 -5 L15 -15 L25 -5" fill="none" stroke={eyeFill} strokeWidth="4" strokeLinecap="round" /><path d="M-5 20 L5 30 M5 20 L-5 30" stroke="#222" strokeWidth="3" /></g>;
    } else {
        return <g transform={isRobot ? 'translate(0, -15)' : 'translate(0, 0)'}>{isBoss ? (<><path d="M-30 -15 L-10 -5 L-10 -15 Z" fill={eyeFill} /><path d="M30 -15 L10 -5 L10 -15 Z" fill={eyeFill} /></>) : (<><circle cx="-18" cy="-8" r="6" fill={eyeFill} stroke={eyeStroke} strokeWidth={isRobot ? 0 : 0} /><circle cx="18" cy="-8" r="6" fill={eyeFill} stroke={eyeStroke} strokeWidth={isRobot ? 0 : 0} />{!isRobot && <circle cx="-16" cy="-10" r="2" fill="white" />}{!isRobot && <circle cx="20" cy="-10" r="2" fill="white" />}</>)}{isRobot ? null : <path d="M-10 15 Q0 25 10 15" fill="none" stroke="#222" strokeWidth="3" strokeLinecap="round" />}</g>;
    }
  };

  return (
    <svg width={size} height={size} viewBox="-80 -80 160 160" className="drop-shadow-2xl transition-all duration-300">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: mainColor, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#222', stopOpacity: 0.8 }} /> 
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.5"/></filter>
        <filter id="blur"><feGaussianBlur stdDeviation="2" /></filter>
        <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" style={{stopColor:'rgba(0,0,0,0.6)', stopOpacity:1}} /><stop offset="100%" style={{stopColor:'rgba(0,0,0,0)', stopOpacity:0}} /></radialGradient>
      </defs>
      <ellipse cx="0" cy="65" rx="50" ry="12" fill="url(#groundShadow)" />
      <g className={emotion === 'damage' ? 'translate-x-2 translate-y-2' : ''}>
        {renderVariant(visualStyle?.secondary)}
        {visualStyle?.primary === 'cape' && renderVariant(visualStyle.primary)}
        {renderBody()}
        {visualStyle?.primary !== 'cape' && renderVariant(visualStyle?.primary)}
        {renderFace()}
      </g>
    </svg>
  );
};

const MONSTERS: Record<Level, { guide: Monster[], challenge: Monster[] }> = {
  1: {
    guide: [
      { id: 'm1_1', name: '朝ねぼうベルクロック', type: 'object', color: '#60A5FA', baseHp: 150, dialogueStart: "リンリン！ あと5分だけ止めておくよ！", dialogueDefeat: "起きる時間をちゃんと鳴らします...", theme: "Timekeeper" },
      { id: 'm1_2', name: 'ちらかしノートミミック', type: 'object', color: '#22C55E', baseHp: 180, dialogueStart: "ページもプリントも全部ぐちゃぐちゃだ！", dialogueDefeat: "名前を書いて、きれいに閉じます...", theme: "MessyBook" },
      { id: 'm1_3', name: 'おしゃべりラッパバード', type: 'wing', color: '#FACC15', baseHp: 200, dialogueStart: "パパパー！ 授業中でも鳴らしちゃうぞ！", dialogueDefeat: "小さな声で合図します...", theme: "NoiseMaker" },
      { id: 'm1_4', name: 'つまみぐいスナックオーク', type: 'beast', color: '#F97316', baseHp: 220, dialogueStart: "そのおやつ、ひとくちだけ...全部くれ！", dialogueDefeat: "手を洗って、順番を待ちます...", theme: "SnackBandit" },
      { id: 'm1_5', name: 'らくがきスターゴースト', type: 'ghost', color: '#EC4899', baseHp: 250, dialogueStart: "ノートのすみっこを星だらけにしてやる！", dialogueDefeat: "キャンバスに描くことにします...", theme: "DoodleStar" },
      { id: 'm1_6', name: 'まいごの消しゴムナイト', type: 'object', color: '#DBEAFE', baseHp: 280, dialogueStart: "筆箱の国へ帰る道を忘れた！", dialogueDefeat: "机の右上で待機します...", theme: "LostKnight" },
      { id: 'm1_7', name: 'そうじサボりダストマスク', type: 'ghost', color: '#94A3B8', baseHp: 300, dialogueStart: "ほこりの雲で見えなくしてやる！", dialogueDefeat: "すみっこまで集められました...", theme: "DustMask" },
      { id: 'm1_8', name: '給食おかわりキング', type: 'beast', color: '#F59E0B', baseHp: 350, dialogueStart: "カレーの大鍋はぜんぶ王さまのものだ！", dialogueDefeat: "みんなで分けるほうがおいしい...", theme: "LunchKing" },
      { id: 'm1_9', name: 'としょかん禁書ミミック', type: 'object', color: '#7C3AED', baseHp: 400, dialogueStart: "しおりを閉じ込めて、物語を止めてやる！", dialogueDefeat: "静かにページを開きます...", theme: "ForbiddenBook" },
      { id: 'm1_10', name: 'ゲーム沼ドラゴン', type: 'boss', color: '#EF4444', baseHp: 500, dialogueStart: "宿題よりラスボス周回だ！ 今日は寝かせないぞ！", dialogueDefeat: "時間を決めて遊びます...", theme: "GameAbyss" },
    ],
    challenge: [
      { id: 'c1_1', name: '影ぬいインクコア', type: 'slime', color: '#4C1D95', baseHp: 420, dialogueStart: "黒いインクで答えを塗りつぶしてやる...", dialogueDefeat: "文字が...はっきり見える...", theme: "DarkInk" },
      { id: 'c1_2', name: '炎門のケルベロス', type: 'beast', color: '#DC2626', baseHp: 580, dialogueStart: "三つの火花で集中を散らしてやる！", dialogueDefeat: "門を開けよう...見事だ...", theme: "FireGate" },
      { id: 'c1_3', name: '嵐譜のウイングメイジ', type: 'wing', color: '#0891B2', baseHp: 740, dialogueStart: "風の楽譜でキーを乱す！", dialogueDefeat: "リズムを読まれたか...", theme: "StormScore" },
      { id: 'c1_4', name: '呪面ファントム', type: 'ghost', color: '#7E22CE', baseHp: 900, dialogueStart: "その迷い、仮面に閉じ込めてやる...", dialogueDefeat: "仮面が割れる...成仏します...", theme: "CursedMask" },
      { id: 'c1_5', name: '鉄壁プロトガード', type: 'robot', color: '#64748B', baseHp: 1040, dialogueStart: "入力パターン解析開始。突破不能デス。", dialogueDefeat: "解析不能...システムダウン...", theme: "SteelProtocol" },
      { id: 'c1_6', name: '地鳴りルーンゴーレム', type: 'object', color: '#A16207', baseHp: 1200, dialogueStart: "古い石文字で道をふさいでやる...", dialogueDefeat: "刻まれたルーンがほどける...", theme: "EarthRune" },
      { id: 'c1_8', name: '紅牙ブラッドファング', type: 'beast', color: '#991B1B', baseHp: 1260, dialogueStart: "一文字の迷いも逃さない...", dialogueDefeat: "牙が...届かなかった...", theme: "CrimsonFang" },
      { id: 'c1_9', name: '奈落ランタンレイス', type: 'ghost', color: '#6D28D9', baseHp: 1310, dialogueStart: "底なしの灯りで目を惑わせよう...", dialogueDefeat: "灯りが...静かに消える...", theme: "AbyssLantern" },
      { id: 'c1_10', name: '獄炎バリスタ・アイ', type: 'object', color: '#B91C1C', baseHp: 1340, dialogueStart: "照準固定。焼き払う準備はできた。", dialogueDefeat: "砲身が...冷えていく...", theme: "InfernoEye" },
      { id: 'c1_7', name: '魔王ドラゴニス', type: 'boss', color: '#2F4F4F', baseHp: 1380, dialogueStart: "我に挑む愚か者よ", dialogueDefeat: "貴様こそ勇者だ...", theme: "Boss" },
      { id: 'c1_11', name: '裏魔竜ヴォイド', type: 'boss', color: '#4C1D95', baseHp: 1380, dialogueStart: "まだ終わりではない。ここからが真の試練だ。", dialogueDefeat: "やるな...だが次で終わると思うな。", theme: "HiddenVoid" },
      { id: 'c1_12', name: '深淵王ネメシス', type: 'boss', color: '#1D4ED8', baseHp: 1400, dialogueStart: "その集中力、どこまで続くか見せてみろ。", dialogueDefeat: "くっ...さらに上を用意していたのだが。", theme: "HiddenAbyss" },
      { id: 'c1_13', name: '真冥皇アポカリス', type: 'boss', color: '#7F1D1D', baseHp: 1420, dialogueStart: "全問を貫いてみせろ。最後の壁は私だ。", dialogueDefeat: "見事だ...お前こそ真の覇者。", theme: "HiddenEnd" },
    ]
  },
  2: {
    guide: [
      { id: 'm2_1', name: '遅刻コウモリ', type: 'wing', color: '#9370DB', baseHp: 300, dialogueStart: "学校に遅れる〜！", dialogueDefeat: "間に合った！", theme: "Tardiness" },
      { id: 'm2_2', name: 'わすれんぼウルフ', type: 'beast', color: '#708090', baseHp: 350, dialogueStart: "宿題わすれた...", dialogueDefeat: "カバンにあった！", theme: "Forgetful" },
      { id: 'm2_3', name: 'いじわるフォックス', type: 'beast', color: '#FF8C00', baseHp: 400, dialogueStart: "意地悪してやる！", dialogueDefeat: "仲良くします...", theme: "Mean" },
      { id: 'm2_4', name: '居眠りベア', type: 'beast', color: '#8B4513', baseHp: 450, dialogueStart: "ぐーぐー...", dialogueDefeat: "目が覚めた！", theme: "Sleep" },
      { id: 'm2_5', name: '黒板消しクリーチャー', type: 'object', color: '#483D8B', baseHp: 500, dialogueStart: "真っ白にしてやる！", dialogueDefeat: "綺麗になった！", theme: "Clean" },
      { id: 'm2_6', name: 'リコーダーへび', type: 'slime', color: '#98FB98', baseHp: 550, dialogueStart: "変な音だしてやる！", dialogueDefeat: "綺麗な音色...", theme: "Music" },
      { id: 'm2_7', name: 'ドッジボールゴーレム', type: 'robot', color: '#A9A9A9', baseHp: 600, dialogueStart: "当ててやるぞ！", dialogueDefeat: "ナイスキャッチ！", theme: "Sport" },
      { id: 'm2_8', name: 'うわばき隠し', type: 'ghost', color: '#E0FFFF', baseHp: 650, dialogueStart: "靴がないぞ〜", dialogueDefeat: "揃えて置きます...", theme: "Shoes" },
      { id: 'm2_9', name: '騒音トロール', type: 'beast', color: '#CD5C5C', baseHp: 700, dialogueStart: "大声で歌うぞー！", dialogueDefeat: "静かにします...", theme: "Noisy" },
      { id: 'm2_10', name: 'テストの悪魔', type: 'boss', color: '#800000', baseHp: 900, dialogueStart: "0点とれ〜！", dialogueDefeat: "100点だと！？", theme: "Anxiety" },
    ],
    challenge: [
      { id: 'c2_1', name: 'ポイズンスライム', type: 'slime', color: '#8B008B', baseHp: 1500, dialogueStart: "毒を浴びろ！", dialogueDefeat: "解毒された...", theme: "Poison" },
      { id: 'c2_2', name: '氷結のオオカミ', type: 'beast', color: '#E0FFFF', baseHp: 1800, dialogueStart: "凍り付け！", dialogueDefeat: "溶けちゃう...", theme: "Ice" },
      { id: 'c2_3', name: 'サンダーバード', type: 'wing', color: '#FFD700', baseHp: 2000, dialogueStart: "雷よ落ちろ！", dialogueDefeat: "ビリビリする...", theme: "Thunder" },
      { id: 'c2_4', name: 'ファントムナイト', type: 'ghost', color: '#2F4F4F', baseHp: 2200, dialogueStart: "剣のサビにしてやる", dialogueDefeat: "見事な剣筋だ...", theme: "Knight" },
      { id: 'c2_5', name: '古代兵器オメガ', type: 'robot', color: '#8B4513', baseHp: 2500, dialogueStart: "排除行動開始。", dialogueDefeat: "機能停止...", theme: "Ancient" },
      { id: 'c2_6', name: 'デス・スコーピオン', type: 'beast', color: '#800000', baseHp: 2800, dialogueStart: "毒針の恐怖...", dialogueDefeat: "解毒完了...", theme: "Venom" },
      { id: 'c2_8', name: 'ブリザードミラー', type: 'object', color: '#AFEEEE', baseHp: 2860, dialogueStart: "凍てつく自分を見ろ", dialogueDefeat: "ひび割れて...映らない...", theme: "Mirror" },
      { id: 'c2_9', name: 'ナイトメアクロウ', type: 'wing', color: '#4B0082', baseHp: 2920, dialogueStart: "悪夢を運んでやる", dialogueDefeat: "羽ばたきが...止まる...", theme: "Nightmare" },
      { id: 'c2_10', name: '深海のジャッジ', type: 'ghost', color: '#1E3A5F', baseHp: 2960, dialogueStart: "沈黙の底へ沈め", dialogueDefeat: "判決は...覆ったか...", theme: "Depth" },
      { id: 'c2_7', name: '冥王ハーデス', type: 'boss', color: '#000000', baseHp: 3000, dialogueStart: "絶望を味わえ", dialogueDefeat: "光が戻るのか...", theme: "Death" },
      { id: 'c2_11', name: '裏冥王レヴナント', type: 'boss', color: '#312E81', baseHp: 3000, dialogueStart: "正確さだけでなく、持久力も試してやろう。", dialogueDefeat: "まだ届くか...ならば次を受けてみろ。", theme: "HiddenRevenant" },
      { id: 'c2_12', name: '終刻神クロノス', type: 'boss', color: '#0F766E', baseHp: 3000, dialogueStart: "焦るな。崩れるのはお前のほうだ。", dialogueDefeat: "時間さえ押し返すとはな...", theme: "HiddenChronos" },
      { id: 'c2_13', name: '真絶望アザゼル', type: 'boss', color: '#7C2D12', baseHp: 3000, dialogueStart: "最後まで一つも落とさず来られるか。", dialogueDefeat: "その執念...認めよう。", theme: "HiddenDespair" },
    ]
  },
  3: {
    guide: [
      { id: 'm3_1', name: '言い訳ゴースト', type: 'ghost', color: '#D8BFD8', baseHp: 500, dialogueStart: "犬が宿題食べた...", dialogueDefeat: "嘘つきました...", theme: "Lying" },
      { id: 'm3_2', name: 'よそみロボ', type: 'robot', color: '#00CED1', baseHp: 600, dialogueStart: "あっちに何かある！", dialogueDefeat: "集中モードON", theme: "Distraction" },
      { id: 'm3_3', name: '夜更かしフクロウ', type: 'wing', color: '#191970', baseHp: 700, dialogueStart: "夜はこれからだ！", dialogueDefeat: "早く寝ます...", theme: "Night" },
      { id: 'm3_4', name: '廊下ダッシュチーター', type: 'beast', color: '#FFD700', baseHp: 800, dialogueStart: "廊下を走るぞ！", dialogueDefeat: "歩きます...", theme: "Run" },
      { id: 'm3_5', name: 'なまけゴーレム', type: 'robot', color: '#8B4513', baseHp: 900, dialogueStart: "動きたくない...", dialogueDefeat: "運動します！", theme: "Laziness" },
      { id: 'm3_6', name: '偏食モンスター', type: 'slime', color: '#228B22', baseHp: 1000, dialogueStart: "野菜は食べない！", dialogueDefeat: "美味しい...", theme: "Food" },
      { id: 'm3_7', name: '迷路マンション', type: 'object', color: '#778899', baseHp: 1100, dialogueStart: "迷子になれ〜", dialogueDefeat: "出口こっち？", theme: "Maze" },
      { id: 'm3_8', name: '雷おやじ', type: 'ghost', color: '#FFFF00', baseHp: 1200, dialogueStart: "コラ〜！！", dialogueDefeat: "許してやろう...", theme: "Scary" },
      { id: 'm3_9', name: '宿題ブラックホール', type: 'boss', color: '#000000', baseHp: 1300, dialogueStart: "全部吸い込むぞ", dialogueDefeat: "提出します...", theme: "Blackhole" },
      { id: 'm3_10', name: '夏休みの宿題王', type: 'boss', color: '#4B0082', baseHp: 1600, dialogueStart: "今日は8月31日だ！", dialogueDefeat: "7月中に終わってた！", theme: "Procrastination" },
    ],
    challenge: [
      { id: 'c3_1', name: 'カオススライム', type: 'slime', color: '#FF4500', baseHp: 2500, dialogueStart: "混沌を...", dialogueDefeat: "秩序が...", theme: "Chaos" },
      { id: 'c3_2', name: 'キメラビースト', type: 'beast', color: '#DAA520', baseHp: 2800, dialogueStart: "喰らってやる！", dialogueDefeat: "お腹いっぱい...", theme: "Chimera" },
      { id: 'c3_3', name: 'ヴォイドウィング', type: 'wing', color: '#191970', baseHp: 3000, dialogueStart: "闇夜に消えろ", dialogueDefeat: "夜が明ける...", theme: "Void" },
      { id: 'c3_4', name: 'スペクターロード', type: 'ghost', color: '#FFFafa', baseHp: 3500, dialogueStart: "恐怖せよ", dialogueDefeat: "恐れ入った...", theme: "Fear" },
      { id: 'c3_5', name: '機神タイタン', type: 'robot', color: '#B8860B', baseHp: 4000, dialogueStart: "出力最大！", dialogueDefeat: "エネルギー切れ...", theme: "Titan" },
      { id: 'c3_6', name: 'アビス・ウォーカー', type: 'ghost', color: '#483D8B', baseHp: 4500, dialogueStart: "深淵を覗くか...", dialogueDefeat: "見事だ...", theme: "Abyss" },
      { id: 'c3_8', name: '断罪のセラフ', type: 'wing', color: '#F5F5DC', baseHp: 4650, dialogueStart: "裁きを始めよう", dialogueDefeat: "天秤が...傾いた...", theme: "Judgement" },
      { id: 'c3_9', name: '虚無のコロッサス', type: 'object', color: '#696969', baseHp: 4800, dialogueStart: "存在ごと踏み潰す", dialogueDefeat: "巨体が...崩落する...", theme: "Void" },
      { id: 'c3_10', name: '深紅のキマイラ', type: 'beast', color: '#8B1E3F', baseHp: 4900, dialogueStart: "最後の恐怖を見せてやる", dialogueDefeat: "まだ...届かなかったか...", theme: "Crimson" },
      { id: 'c3_7', name: '終焉のドラゴン', type: 'boss', color: '#8B0000', baseHp: 5000, dialogueStart: "全てを無に還す", dialogueDefeat: "未来を託そう...", theme: "End" },
      { id: 'c3_11', name: '裏終焉ネビュラス', type: 'boss', color: '#581C87', baseHp: 5000, dialogueStart: "ここから先は、本当に折れない者だけが進める。", dialogueDefeat: "その意志...まだ尽きないのか。", theme: "HiddenNebula" },
      { id: 'c3_12', name: '深黒皇ディザスター', type: 'boss', color: '#0F172A', baseHp: 5000, dialogueStart: "迷いは一文字で命取りになるぞ。", dialogueDefeat: "完璧さで押し切るとは...。", theme: "HiddenDisaster" },
      { id: 'c3_13', name: '真終王アポカリプス', type: 'boss', color: '#7F1D1D', baseHp: 5000, dialogueStart: "最後の五十問、すべて通してみせろ。", dialogueDefeat: "これほどとは...完全敗北だ。", theme: "HiddenApocalypse" },
    ]
  }
};

// --- Components ---
type GameButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'outline' | 'ghost';
type GameButtonSize = 'sm' | 'md' | 'lg';

type GameButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
};

const PLAYER_NAME_MAX_LENGTH = 30;

const GameButton = ({ onClick, children, className = "", variant = "primary", disabled = false, size = "md", autoFocus = false, type = "button" }: GameButtonProps) => {
  const baseStyle = "relative font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 overflow-hidden border-2 rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300";
  const sizes: Record<GameButtonSize, string> = { sm: "px-4 py-2 text-sm", md: "px-6 py-3", lg: "px-10 py-4 text-xl" };
  const variants: Record<GameButtonVariant, string> = {
    primary: "bg-blue-600 border-blue-400 text-white shadow-blue-900/50 hover:bg-blue-500 hover:shadow-blue-500/50 hover:border-blue-300",
    secondary: "bg-purple-600 border-purple-400 text-white shadow-purple-900/50 hover:bg-purple-500 hover:shadow-purple-500/50 hover:border-purple-300",
    danger: "bg-red-600 border-red-400 text-white shadow-red-900/50 hover:bg-red-500 hover:shadow-red-500/50 hover:border-red-300",
    success: "bg-green-600 border-green-400 text-white shadow-green-900/50 hover:bg-green-500 hover:shadow-green-500/50 hover:border-green-300",
    warning: "bg-orange-500 border-orange-300 text-white shadow-orange-800/50 hover:bg-orange-400 hover:shadow-orange-400/50",
    outline: "bg-slate-800 border-slate-500 text-slate-200 hover:bg-slate-700 hover:border-slate-300",
    ghost: "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200"
  };

  const btnRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (autoFocus && btnRef.current) {
        btnRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <button ref={btnRef} type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
    </button>
  );
};

const ScreenContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`min-h-screen font-sans text-slate-100 flex flex-col relative ${className}`}>
    <div className="fixed inset-0 z-0 bg-slate-900">
       <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
       <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-slate-900/80"></div>
    </div>
    <div className="relative z-10 flex-1 flex flex-col items-center w-full overflow-y-auto">{children}</div>
  </div>
);

const Box = ({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: React.ReactNode }) => (
  <div className={`bg-slate-800/90 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm ${className}`}>
    {title && (<div className="bg-slate-700/80 px-4 py-2 border-b border-slate-600 font-bold text-slate-200 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div>{title}</div>)}
    <div className="p-6">{children}</div>
  </div>
);

type QuestionListRowProps = {
  question: Question;
  idx: number;
  displayIndex: number;
  questionKey: string;
  isWeakQuestion: boolean;
  stats?: WeakQuestionStat;
  manualStatus: ManualQuestionStatus;
  isSelectedForAutoPlay: boolean;
  example?: string | null;
  onSpeak: (text: string) => void;
  onToggleSelected: (question: Question) => void;
  onUpdateManualLevel: (question: Question, level: LearningLevel) => void;
  onToggleExcluded: (question: Question) => void;
};

const QuestionListRow = React.memo(function QuestionListRow({
  question,
  idx,
  displayIndex,
  questionKey,
  isWeakQuestion,
  stats,
  manualStatus,
  isSelectedForAutoPlay,
  example,
  onSpeak,
  onToggleSelected,
  onUpdateManualLevel,
  onToggleExcluded,
}: QuestionListRowProps) {
  const learningLabel = manualStatus.learningLevel === 1 ? '学習中' : manualStatus.learningLevel === 2 ? 'もう少し' : '覚えた';
  const autoLabel = manualStatus.battleLevel === 1 ? '学習中' : manualStatus.battleLevel === 2 ? 'もう少し' : '覚えた';
  const isManualOverrideActive = manualStatus.manualOverrideLevel !== null;

  return (
    <div key={`${questionKey}-${idx}`} className={`p-3 rounded-lg border transition-colors group ${manualStatus.excluded ? 'bg-slate-950/80 border-slate-600 opacity-85' : isWeakQuestion ? 'bg-orange-950/40 border-orange-500/40 hover:border-orange-400/70' : 'bg-slate-900/50 border-slate-700 hover:border-blue-500/50'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className="mt-1 min-w-[2.75rem] rounded-full border border-slate-600 bg-slate-900/80 px-2 py-1 text-center font-mono text-[11px] font-bold tracking-[0.18em] text-slate-400">
            {String(displayIndex).padStart(3, '0')}
          </div>
          <label className="mt-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-950/40 text-cyan-100 transition-colors hover:bg-cyan-900/40">
            <input
              type="checkbox"
              checked={isSelectedForAutoPlay}
              onChange={() => onToggleSelected(question)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-400"
            />
          </label>
          <button onClick={() => onSpeak(question.text)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white transition-colors flex-shrink-0"><Volume2 size={16} /></button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg md:text-xl font-mono text-blue-100 font-bold break-all">{question.text}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${manualStatus.learningLevel === 1 ? 'border border-sky-400/35 bg-sky-500/10 text-sky-100' : manualStatus.learningLevel === 2 ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border border-violet-400/35 bg-violet-500/10 text-violet-100'}`}>
                {learningLabel}
              </span>
              {isSelectedForAutoPlay && <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-100">選択中</span>}
              {manualStatus.manualOverrideLevel !== null && <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-fuchsia-200">手動優先</span>}
              {manualStatus.excluded && <span className="rounded-full border border-slate-400/40 bg-slate-700/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-200">除外中</span>}
              {isWeakQuestion && <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">Weak</span>}
              {isWeakQuestion && stats && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">Miss x{stats.missCount}</span>}
              {!isWeakQuestion && stats && <span className="rounded-full border border-slate-500/30 bg-slate-700/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">Past Miss x{stats.missCount}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={`rounded-2xl border px-4 py-2 text-xl font-black leading-none tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:text-2xl ${isManualOverrideActive ? 'border-slate-700 bg-slate-900/60 text-slate-300' : manualStatus.learningLevel === 1 ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : manualStatus.learningLevel === 2 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-violet-400/30 bg-violet-500/10 text-violet-100'}`}>
                {learningLabel}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${isManualOverrideActive ? 'border-slate-700 bg-slate-900/70 text-slate-400' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'}`}>
                自動: {autoLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-slate-300 font-bold text-sm md:text-base">{question.translation}</div>
          {question.basicMeaning && (
            <div className="mt-0.5 text-[10px] font-medium text-slate-500 md:text-[11px]">
              Basic: {question.basicMeaning}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 ml-[6.75rem] flex flex-wrap items-center gap-2 md:justify-end">
        <span className="text-[11px] font-bold text-slate-400">手動設定</span>
        {LEARNING_LEVELS.map(level => (
          <button
            key={level}
            onClick={() => onUpdateManualLevel(question, level)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${manualStatus.manualOverrideLevel === level ? level === 1 ? 'border-sky-300 bg-sky-500/20 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.24)]' : level === 2 ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.22)]' : 'border-violet-300 bg-violet-500/20 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.24)]' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
          >
            {level === 1 ? '学習中' : level === 2 ? 'もう少し' : '覚えた'}
          </button>
        ))}
        <button
          onClick={() => onToggleExcluded(question)}
          className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${manualStatus.excluded ? 'border-slate-300 bg-slate-200 text-slate-900' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
        >
          {manualStatus.excluded ? '除外を解除' : '除外する'}
        </button>
      </div>
      {example && (
        <div className="mt-3 ml-[6.75rem] rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Example</p>
          <p className="mt-1 text-xs md:text-sm text-slate-200">{example}</p>
        </div>
      )}
    </div>
  );
});

// --- Main App ---
export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    screen: 'title',
    selectedDifficulty: 'Eiken5',
    selectedLevel: 1,
    mode: 'guide',
    inputMode: 'voice-text',
    currentMonsterIndex: 0,
    currentMonsterList: [],
    challengeModeIndices: [],
    monsterHp: 100,
    maxMonsterHp: 100,
    score: 0,
    combo: 0,
    currentQuestion: { text: "", translation: "" },
    userInput: "",
    startTime: null,
    history: [],
    questionCount: 0,
    maxQuestions: 10,
    battleResult: null,
    totalMonstersInStage: 10,
    defeatedMonsterIds: [], 
    isNewRecord: false,
    missCount: 0,
    totalKeystrokes: 0,
    hintLength: 0,
    currentBattleMissedQuestions: [],
    battleLog: [],
    battleStartScore: 0,
    battleStartKeystrokes: 0,
    bossStage: 0,
  });

  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [maxKeystrokes, setMaxKeystrokes] = useState<number>(0);
  const [weakQuestions, setWeakQuestions] = useState<Question[]>([]); 
  const [weakQuestionStats, setWeakQuestionStats] = useState<Record<string, WeakQuestionStat>>({});
  const [manualQuestionStatuses, setManualQuestionStatuses] = useState<Record<string, ManualQuestionStatus>>({});
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(createDailyProgress());
  const [bgmVolumeLevel, setBgmVolumeLevel] = useState<number>(3);
  const [allSpeechVoices, setAllSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechVoiceMode, setSpeechVoiceMode] = useState<SpeechVoiceMode>('us_female');
  const [speechRatePercent, setSpeechRatePercent] = useState<number>(100);
  const [autoPlaySettings, setAutoPlaySettings] = useState<AutoPlaySettings>(getDefaultAutoPlaySettings());
  const [selectedQuestionKeysByScope, setSelectedQuestionKeysByScope] = useState<Record<string, string[]>>({});
  const [savedSelectionLists, setSavedSelectionLists] = useState<SavedSelectionList[]>([]);
  const [selectionListName, setSelectionListName] = useState('');
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [activePlayerId, setActivePlayerId] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [playerNameDrafts, setPlayerNameDrafts] = useState<Record<string, string>>({});
  const [settingsFocusSection, setSettingsFocusSection] = useState<'progress-transfer' | 'player-profiles' | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayStatusText, setAutoPlayStatusText] = useState('待機中');
  const sessionWeakQuestionsRef = useRef<Question[] | null>(null);
  const [autoPlayNowPlaying, setAutoPlayNowPlaying] = useState<AutoPlayNowPlaying | null>(null);
  const [bookLevel, setBookLevel] = useState<Level>(1);
  const [bookDifficulty, setBookDifficulty] = useState<Difficulty>('Eiken5');
  const [, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [monsterShake, setMonsterShake] = useState(false); 
  const [scoreViewDiff, setScoreViewDiff] = useState<Difficulty>('Eiken5');
  const [questionListFilter, setQuestionListFilter] = useState<'all' | 'weak'>('all');
  const [weakListSort, setWeakListSort] = useState<'recent' | 'frequent'>('recent');
  const [wordListToolsOpen, setWordListToolsOpen] = useState(false);
  const [weakReviewPanelOpen, setWeakReviewPanelOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastSolvedQuestion, setLastSolvedQuestion] = useState<Question | null>(null);
  const [showBossIntro, setShowBossIntro] = useState(false);
  const [progressTransferStatus, setProgressTransferStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const newPlayerNameInputRef = useRef<HTMLInputElement>(null);
  const progressImportInputRef = useRef<HTMLInputElement>(null);
  const playerProfilesSectionRef = useRef<HTMLDivElement>(null);
  const progressTransferSectionRef = useRef<HTMLDivElement>(null);
  const speechPreviewTimeoutRef = useRef<number | null>(null);
  const autoPlayTimeoutRef = useRef<number | null>(null);
  const autoPlayRunIdRef = useRef(0);
  const questionPoolRef = useRef<Record<string, QuestionPoolState>>({});
  const reviewQueueRef = useRef<ReviewQueueEntry[]>([]);
  const activeReviewEntryRef = useRef<ReviewQueueEntry | null>(null);
  const recentReviewAppearanceRef = useRef<boolean[]>([]);
  const shownBossIntroKeyRef = useRef<string | null>(null);
  const pendingBattleEndTimeoutRef = useRef<number | null>(null);
  const profilesReadyRef = useRef(false);
  const profileHydratingRef = useRef(false);

  const updateSelectedDifficulty = (difficulty: Difficulty, screen?: GameState['screen']) => {
    setGameState(prev => ({
      ...prev,
      selectedDifficulty: difficulty,
      selectedLevel: getSafeLevelForDifficulty(difficulty, prev.selectedLevel),
      ...(screen ? { screen } : {}),
    }));
  };

  const openProgressTransferSettings = () => {
    setSettingsFocusSection('progress-transfer');
    setGameState(prev => ({ ...prev, screen: 'settings' }));
  };

  const openPlayerProfileSettings = () => {
    setSettingsFocusSection('player-profiles');
    setGameState(prev => ({ ...prev, screen: 'settings' }));
  };

  const updateBookDifficulty = (difficulty: Difficulty) => {
    setBookDifficulty(difficulty);
    setBookLevel(prev => getSafeLevelForDifficulty(difficulty, prev));
  };

  const persistPlayerProfiles = useCallback((profiles: PlayerProfile[], nextActivePlayerId: string) => {
    localStorage.setItem(STORAGE_KEYS.playerProfiles, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEYS.activePlayerId, nextActivePlayerId);
  }, []);

  const readLegacyWorkingSetFromLocalStorage = useCallback((): PlayerProfileData => {
    const savedWeak = normalizeQuestionArray(safeLoadJson<Question[]>(STORAGE_KEYS.weakQuestions, []));
    const savedWeakStats = normalizeWeakQuestionStats(safeLoadJson<Record<string, WeakQuestionStat>>(STORAGE_KEYS.weakQuestionStats, {}));
    const savedManualStatuses = normalizeManualQuestionStatuses(safeLoadJson<Record<string, ManualQuestionStatus>>(STORAGE_KEYS.manualQuestionStatuses, {}));
    const savedReviewQueue = normalizeReviewQueue(safeLoadJson<ReviewQueueEntry[]>(STORAGE_KEYS.reviewQueue, []));
    const savedDailyProgress = normalizeDailyProgress(safeLoadJson<DailyProgress>(STORAGE_KEYS.dailyProgress, createDailyProgress()));
    const savedAutoPlaySettings = normalizeAutoPlaySettings(safeLoadJson<AutoPlaySettings>(STORAGE_KEYS.autoPlaySettings, getDefaultAutoPlaySettings()));
    const savedSelectedQuestionKeysByScope = normalizeSelectedQuestionKeysByScope(safeLoadJson<Record<string, string[]>>(STORAGE_KEYS.selectedQuestionKeysByScope, {}));
    const savedSelectionLists = normalizeSavedSelectionLists(safeLoadJson<SavedSelectionList[]>(STORAGE_KEYS.savedSelectionLists, []));

    const savedMaxKRaw = localStorage.getItem(STORAGE_KEYS.maxKeystrokes);
    const savedBgmVolumeLevelRaw = localStorage.getItem(STORAGE_KEYS.bgmVolumeLevel);
    const savedSpeechVoiceModeRaw = localStorage.getItem(STORAGE_KEYS.speechVoiceMode);
    const savedSpeechRatePercentRaw = localStorage.getItem(STORAGE_KEYS.speechRatePercent);

    return normalizePlayerProfileData({
      defeatedMonsterIds: safeLoadJson<string[]>(STORAGE_KEYS.defeatedMonsters, []),
      bestScores: safeLoadJson<Record<string, number>>(STORAGE_KEYS.bestScores, {}),
      maxKeystrokes: savedMaxKRaw ? parseInt(savedMaxKRaw, 10) : 0,
      weakQuestions: savedWeak,
      weakQuestionStats: savedWeakStats,
      manualQuestionStatuses: savedManualStatuses,
      reviewQueue: savedReviewQueue,
      dailyProgress: savedDailyProgress,
      bgmVolumeLevel: savedBgmVolumeLevelRaw ? parseInt(savedBgmVolumeLevelRaw, 10) : 3,
      speechVoiceMode: savedSpeechVoiceModeRaw ?? 'us_female',
      speechRatePercent: savedSpeechRatePercentRaw ? parseInt(savedSpeechRatePercentRaw, 10) : 100,
      autoPlaySettings: savedAutoPlaySettings,
      selectedQuestionKeysByScope: savedSelectedQuestionKeysByScope,
      savedSelectionLists,
    });
  }, []);

  const writeProfileDataToWorkingSet = useCallback((data: PlayerProfileData) => {
    const normalizedData = normalizePlayerProfileData(data);
    localStorage.setItem(STORAGE_KEYS.defeatedMonsters, JSON.stringify(normalizedData.defeatedMonsterIds ?? []));
    localStorage.setItem(STORAGE_KEYS.bestScores, JSON.stringify(normalizedData.bestScores ?? {}));
    localStorage.setItem(STORAGE_KEYS.maxKeystrokes, String(normalizedData.maxKeystrokes ?? 0));
    localStorage.setItem(STORAGE_KEYS.weakQuestions, JSON.stringify(normalizedData.weakQuestions ?? []));
    localStorage.setItem(STORAGE_KEYS.weakQuestionStats, JSON.stringify(normalizedData.weakQuestionStats ?? {}));
    localStorage.setItem(STORAGE_KEYS.manualQuestionStatuses, JSON.stringify(normalizedData.manualQuestionStatuses ?? {}));
    localStorage.setItem(STORAGE_KEYS.reviewQueue, JSON.stringify(normalizedData.reviewQueue ?? []));
    localStorage.setItem(STORAGE_KEYS.dailyProgress, JSON.stringify(normalizedData.dailyProgress ?? createDailyProgress()));
    localStorage.setItem(STORAGE_KEYS.bgmVolumeLevel, String(normalizedData.bgmVolumeLevel ?? 3));
    localStorage.setItem(STORAGE_KEYS.speechVoiceMode, normalizedData.speechVoiceMode ?? 'us_female');
    localStorage.setItem(STORAGE_KEYS.speechRatePercent, String(normalizedData.speechRatePercent ?? 100));
    localStorage.setItem(STORAGE_KEYS.autoPlaySettings, JSON.stringify(normalizedData.autoPlaySettings ?? getDefaultAutoPlaySettings()));
    localStorage.setItem(STORAGE_KEYS.selectedQuestionKeysByScope, JSON.stringify(normalizedData.selectedQuestionKeysByScope ?? {}));
    localStorage.setItem(STORAGE_KEYS.savedSelectionLists, JSON.stringify(normalizedData.savedSelectionLists ?? []));
  }, []);

  const applyProfileDataToState = useCallback((data: PlayerProfileData) => {
    const normalizedData = normalizePlayerProfileData(data);
    const todayKey = getTodayKey();
    const normalizedReviewQueue = (normalizedData.dailyProgress?.date ?? todayKey) === todayKey
      ? (normalizedData.reviewQueue ?? [])
      : (normalizedData.reviewQueue ?? []).map((entry) => ({ ...entry, remainingQuestions: 0 }));
    const normalizedDailyProgress = (normalizedData.dailyProgress?.date ?? todayKey) === todayKey
      ? normalizedData.dailyProgress ?? createDailyProgress(todayKey)
      : createDailyProgress(todayKey);

    setGameState((prev) => ({
      ...prev,
      defeatedMonsterIds: normalizedData.defeatedMonsterIds ?? [],
    }));
    setBestScores(normalizedData.bestScores ?? {});
    setMaxKeystrokes(normalizedData.maxKeystrokes ?? 0);
    setWeakQuestions(normalizedData.weakQuestions ?? []);
    setWeakQuestionStats(normalizedData.weakQuestionStats ?? {});
    setManualQuestionStatuses(normalizedData.manualQuestionStatuses ?? {});
    reviewQueueRef.current = normalizedReviewQueue;
    setDailyProgress(normalizedDailyProgress);
    setBgmVolumeLevel(normalizedData.bgmVolumeLevel ?? 3);
    setSpeechVoiceMode(normalizedData.speechVoiceMode ?? 'us_female');
    setSpeechRatePercent(normalizedData.speechRatePercent ?? 100);
    setAutoPlaySettings(normalizedData.autoPlaySettings ?? getDefaultAutoPlaySettings());
    setSelectedQuestionKeysByScope(normalizedData.selectedQuestionKeysByScope ?? {});
    setSavedSelectionLists(normalizedData.savedSelectionLists ?? []);
  }, []);

  const getCurrentActivePlayer = useCallback(() => (
    playerProfiles.find((profile) => profile.id === activePlayerId) ?? null
  ), [playerProfiles, activePlayerId]);

  const captureCurrentProfileData = useCallback((): PlayerProfileData => normalizePlayerProfileData({
    defeatedMonsterIds: gameState.defeatedMonsterIds,
    bestScores,
    maxKeystrokes,
    weakQuestions,
    weakQuestionStats,
    manualQuestionStatuses,
    reviewQueue: reviewQueueRef.current,
    dailyProgress,
    bgmVolumeLevel,
    speechVoiceMode,
    speechRatePercent,
    autoPlaySettings,
    selectedQuestionKeysByScope,
    savedSelectionLists,
  }), [
    gameState.defeatedMonsterIds,
    bestScores,
    maxKeystrokes,
    weakQuestions,
    weakQuestionStats,
    manualQuestionStatuses,
    dailyProgress,
    bgmVolumeLevel,
    speechVoiceMode,
    speechRatePercent,
    autoPlaySettings,
    selectedQuestionKeysByScope,
    savedSelectionLists,
  ]);

  useEffect(() => {
    const storedProfiles = normalizePlayerProfiles(safeLoadJson<PlayerProfile[]>(STORAGE_KEYS.playerProfiles, []));
    const storedActivePlayerId = localStorage.getItem(STORAGE_KEYS.activePlayerId) ?? '';

    let nextProfiles = storedProfiles;
    let nextActivePlayerId = storedActivePlayerId;

    if (nextProfiles.length === 0) {
      const initialProfile: PlayerProfile = {
        id: `player-${Date.now()}`,
        name: 'Player 1',
        updatedAt: Date.now(),
        data: readLegacyWorkingSetFromLocalStorage(),
      };
      nextProfiles = [initialProfile];
      nextActivePlayerId = initialProfile.id;
    } else if (!nextProfiles.some((profile) => profile.id === nextActivePlayerId)) {
      nextActivePlayerId = nextProfiles[0].id;
    }

    const activeProfile = nextProfiles.find((profile) => profile.id === nextActivePlayerId) ?? nextProfiles[0];

    profileHydratingRef.current = true;
    writeProfileDataToWorkingSet(activeProfile.data);
    setPlayerProfiles(nextProfiles);
    setActivePlayerId(activeProfile.id);
    persistPlayerProfiles(nextProfiles, activeProfile.id);
    profilesReadyRef.current = true;

    window.setTimeout(() => {
      profileHydratingRef.current = false;
    }, 0);
  }, [persistPlayerProfiles, readLegacyWorkingSetFromLocalStorage, writeProfileDataToWorkingSet]);

  useEffect(() => {
    const safeLevel = getSafeLevelForDifficulty(gameState.selectedDifficulty, gameState.selectedLevel);
    if (safeLevel !== gameState.selectedLevel) {
      setGameState(prev => ({ ...prev, selectedLevel: safeLevel }));
    }
  }, [gameState.selectedDifficulty, gameState.selectedLevel]);

  useEffect(() => {
    const safeBookLevel = getSafeLevelForDifficulty(bookDifficulty, bookLevel);
    if (safeBookLevel !== bookLevel) {
      setBookLevel(safeBookLevel);
    }
  }, [bookDifficulty, bookLevel]);

  useEffect(() => {
    const defeatedMonsterIds = normalizeDefeatedMonsterIds(safeLoadJson<string[]>(STORAGE_KEYS.defeatedMonsters, []));
    const savedScores = safeLoadJson<Record<string, number>>(STORAGE_KEYS.bestScores, {});
    const savedWeak = normalizeQuestionArray(safeLoadJson<Question[]>(STORAGE_KEYS.weakQuestions, []));
    const savedWeakStats = normalizeWeakQuestionStats(safeLoadJson<Record<string, WeakQuestionStat>>(STORAGE_KEYS.weakQuestionStats, {}));
    const savedManualStatuses = normalizeManualQuestionStatuses(safeLoadJson<Record<string, ManualQuestionStatus>>(STORAGE_KEYS.manualQuestionStatuses, {}));
    const savedReviewQueue = normalizeReviewQueue(safeLoadJson<ReviewQueueEntry[]>(STORAGE_KEYS.reviewQueue, []));
    const savedDailyProgress = normalizeDailyProgress(safeLoadJson<DailyProgress>(STORAGE_KEYS.dailyProgress, createDailyProgress()));
    const savedAutoPlaySettings = normalizeAutoPlaySettings(safeLoadJson<AutoPlaySettings>(STORAGE_KEYS.autoPlaySettings, getDefaultAutoPlaySettings()));
    const savedSelectedQuestionKeysByScope = normalizeSelectedQuestionKeysByScope(safeLoadJson<Record<string, string[]>>(STORAGE_KEYS.selectedQuestionKeysByScope, {}));
    const savedSelectionLists = normalizeSavedSelectionLists(safeLoadJson<SavedSelectionList[]>(STORAGE_KEYS.savedSelectionLists, []));
    const todayKey = getTodayKey();
    const isNewDay = savedDailyProgress.date !== todayKey;
    const normalizedReviewQueue = isNewDay
      ? savedReviewQueue.map(entry => ({ ...entry, remainingQuestions: 0 }))
      : savedReviewQueue;
    const normalizedDailyProgress = savedDailyProgress.date === todayKey
      ? savedDailyProgress
      : createDailyProgress(todayKey);

    if (defeatedMonsterIds.length > 0) {
      setGameState(prev => ({ ...prev, defeatedMonsterIds }));
    }
    localStorage.setItem(STORAGE_KEYS.defeatedMonsters, JSON.stringify(defeatedMonsterIds));
    setBestScores(savedScores);

    const savedMaxK = localStorage.getItem(STORAGE_KEYS.maxKeystrokes);
    if (savedMaxK) {
      const parsedMaxK = parseInt(savedMaxK, 10);
      if (Number.isFinite(parsedMaxK) && parsedMaxK >= 0) {
        setMaxKeystrokes(parsedMaxK);
      } else {
        localStorage.removeItem(STORAGE_KEYS.maxKeystrokes);
      }
    }
    setWeakQuestions(savedWeak);
    setWeakQuestionStats(savedWeakStats);
    setManualQuestionStatuses(savedManualStatuses);
    setAutoPlaySettings(savedAutoPlaySettings);
    setSelectedQuestionKeysByScope(savedSelectedQuestionKeysByScope);
    setSavedSelectionLists(savedSelectionLists);
    reviewQueueRef.current = normalizedReviewQueue;
    localStorage.setItem(STORAGE_KEYS.reviewQueue, JSON.stringify(normalizedReviewQueue));
    setDailyProgress(normalizedDailyProgress);
    localStorage.setItem(STORAGE_KEYS.dailyProgress, JSON.stringify(normalizedDailyProgress));

    const savedBgmVolumeLevel = localStorage.getItem(STORAGE_KEYS.bgmVolumeLevel);
    if (savedBgmVolumeLevel) {
      const parsedBgmVolumeLevel = parseInt(savedBgmVolumeLevel, 10);
      if (Number.isFinite(parsedBgmVolumeLevel) && parsedBgmVolumeLevel >= 0 && parsedBgmVolumeLevel < BGM_VOLUME_LEVELS.length) {
        setBgmVolumeLevel(parsedBgmVolumeLevel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.bgmVolumeLevel);
      }
    }

    const savedSpeechVoiceMode = localStorage.getItem(STORAGE_KEYS.speechVoiceMode);
    if (savedSpeechVoiceMode && SPEECH_VOICE_OPTIONS.some(option => option.id === savedSpeechVoiceMode)) {
      setSpeechVoiceMode(savedSpeechVoiceMode as SpeechVoiceMode);
    }

    const savedSpeechRatePercent = localStorage.getItem(STORAGE_KEYS.speechRatePercent);
    if (savedSpeechRatePercent) {
      const parsedSpeechRatePercent = parseInt(savedSpeechRatePercent, 10);
      if (Number.isFinite(parsedSpeechRatePercent) && parsedSpeechRatePercent >= 50 && parsedSpeechRatePercent <= 250) {
        setSpeechRatePercent(parsedSpeechRatePercent);
      } else {
        localStorage.removeItem(STORAGE_KEYS.speechRatePercent);
      }
    }
  }, []);

  const persistActivePlayerProfile = useCallback((overrideData?: Partial<PlayerProfileData>) => {
    if (!profilesReadyRef.current || !activePlayerId || profileHydratingRef.current) return;

    const baseData = captureCurrentProfileData();
    const nextData = normalizePlayerProfileData({
      ...baseData,
      ...overrideData,
    });

    setPlayerProfiles((prev) => {
      const nextProfiles = prev.map((profile) => (
        profile.id === activePlayerId
          ? { ...profile, updatedAt: Date.now(), data: nextData }
          : profile
      ));
      persistPlayerProfiles(nextProfiles, activePlayerId);
      return nextProfiles;
    });
  }, [activePlayerId, captureCurrentProfileData, persistPlayerProfiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bgmVolumeLevel, bgmVolumeLevel.toString());
    soundEngine.setBattleMusicVolume(BGM_VOLUME_LEVELS[bgmVolumeLevel]);
  }, [bgmVolumeLevel]);

  const getManualQuestionStatus = (difficulty: Difficulty, level: Level, question: Question) => (
    manualQuestionStatuses[getQuestionStatusKey(difficulty, level, question)] ?? getDefaultManualQuestionStatus()
  );

  const isQuestionExcluded = (difficulty: Difficulty, level: Level, question: Question) => (
    getManualQuestionStatus(difficulty, level, question).excluded
  );

  const getScopedPlayableQuestions = (difficulty: Difficulty, level: Level) => (
    (QUESTIONS[difficulty]?.[level] ?? []).filter(question => !isQuestionExcluded(difficulty, level, question))
  );

  const getAutoLearningTrack = (mode: Mode, inputMode: InputMode): 'practice' | 'battle' | null => {
    if (mode === 'guide' || (mode === 'challenge' && inputMode === 'voice-text')) {
      return 'practice';
    }
    if (mode === 'weakness' || (mode === 'challenge' && (inputMode === 'voice-only' || inputMode === 'text-only'))) {
      return 'battle';
    }
    return null;
  };

  const getWeightedLearningLevel = (status: ManualQuestionStatus) => {
    const effectiveLevel = getEffectiveLearningLevel(status);
    if (effectiveLevel === 1) return 6;
    if (effectiveLevel === 2) return 3;
    return 1;
  };

  const getScopedWeakQuestions = (difficulty: Difficulty, level: Level, sourceQuestions: Question[] = weakQuestions) => (
    sourceQuestions.filter(question => (
      (QUESTIONS[difficulty]?.[level] ?? []).some(candidate => (
        candidate.text === question.text && candidate.translation === question.translation
      ))
      && !isQuestionExcluded(difficulty, level, question)
    ))
  );

  const getScopedLearningSummary = (difficulty: Difficulty, level: Level) => {
    const questions = QUESTIONS[difficulty]?.[level] ?? [];
    let learningCount = 0;
    let cautionCount = 0;
    let masteredCount = 0;
    let excludedCount = 0;

    questions.forEach(question => {
      const status = getManualQuestionStatus(difficulty, level, question);
      if (status.excluded) {
        excludedCount += 1;
        return;
      }

      const effectiveLevel = getEffectiveLearningLevel(status);

      if (effectiveLevel === 1) {
        learningCount += 1;
        return;
      }

      if (effectiveLevel === 2) {
        cautionCount += 1;
        return;
      }

      masteredCount += 1;
    });

    return {
      totalCount: questions.length,
      playableCount: questions.length - excludedCount,
      learningCount,
      cautionCount,
      masteredCount,
      excludedCount,
    };
  };

  const updateAutoLearningStatus = (
    difficulty: Difficulty,
    level: Level,
    question: Question,
    outcome: 'success' | 'struggle',
    mode: Mode,
    inputMode: InputMode,
  ) => {
    const track = getAutoLearningTrack(mode, inputMode);
    if (!track) return;

    updateManualQuestionStatus(difficulty, level, question, current => {
      if (track === 'practice') {
        if (outcome !== 'success') return current;
        return {
          ...current,
          practiceLevel: Math.min(3, current.practiceLevel + 1) as LearningLevel,
        };
      }

      if (outcome === 'success') {
        return {
          ...current,
          battleLevel: Math.min(3, current.battleLevel + 1) as LearningLevel,
        };
      }

      return {
        ...current,
        battleLevel: Math.max(1, current.battleLevel - 1) as LearningLevel,
      };
    });
  };

  const persistManualQuestionStatuses = useCallback((nextStatuses: Record<string, ManualQuestionStatus>) => {
    localStorage.setItem(STORAGE_KEYS.manualQuestionStatuses, JSON.stringify(nextStatuses));
  }, []);

  const updateManualQuestionStatus = useCallback((
    difficulty: Difficulty,
    level: Level,
    question: Question,
    updater: (current: ManualQuestionStatus) => ManualQuestionStatus,
  ) => {
    const statusKey = getQuestionStatusKey(difficulty, level, question);
    setManualQuestionStatuses(prev => {
      const current = prev[statusKey] ?? getDefaultManualQuestionStatus();
      const nextStatuses = {
        ...prev,
        [statusKey]: withDerivedLearningLevel({
          ...updater(current),
          updatedAt: Date.now(),
        }),
      };
      persistManualQuestionStatuses(nextStatuses);
      return nextStatuses;
    });
  }, [persistManualQuestionStatuses]);

  const speakWithSettings = useCallback((text: string) => {
      const speechConfig = resolveSpeechConfig(speechVoices, speechVoiceMode);
      speakText(text, {
          voice: speechConfig.voice,
          lang: speechConfig.lang,
          rate: speechRatePercent / 100,
      });
  }, [speechRatePercent, speechVoiceMode, speechVoices]);

  const clearAutoPlayTimeout = useCallback(() => {
    if (autoPlayTimeoutRef.current !== null) {
      window.clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
  }, []);

  const clearSpeechPreviewTimeout = useCallback(() => {
    if (speechPreviewTimeoutRef.current !== null) {
      window.clearTimeout(speechPreviewTimeoutRef.current);
      speechPreviewTimeoutRef.current = null;
    }
  }, []);

  const stopAutoPlay = useCallback((statusText: string = '停止しました') => {
    autoPlayRunIdRef.current += 1;
    clearAutoPlayTimeout();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAutoPlaying(false);
    setAutoPlayNowPlaying(null);
    setAutoPlayStatusText(statusText);
  }, [clearAutoPlayTimeout]);

  const clearPendingBattleEndTimeout = useCallback(() => {
    if (pendingBattleEndTimeoutRef.current !== null) {
      window.clearTimeout(pendingBattleEndTimeoutRef.current);
      pendingBattleEndTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.speechVoiceMode, speechVoiceMode);
  }, [speechVoiceMode]);

  useEffect(() => {
    if (speechVoiceMode === 'random') return;
    if (speechVoices.length === 0) return;
    if (isSpeechModeSelectable(speechVoices, speechVoiceMode)) return;
    setSpeechVoiceMode(isExactSpeechModeSupported(speechVoices, 'us_female') ? 'us_female' : 'random');
  }, [speechVoices, speechVoiceMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.speechRatePercent, speechRatePercent.toString());
  }, [speechRatePercent]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.autoPlaySettings, JSON.stringify(autoPlaySettings));
  }, [autoPlaySettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.selectedQuestionKeysByScope, JSON.stringify(selectedQuestionKeysByScope));
  }, [selectedQuestionKeysByScope]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.savedSelectionLists, JSON.stringify(savedSelectionLists));
  }, [savedSelectionLists]);

  useEffect(() => {
    persistActivePlayerProfile();
  }, [
    persistActivePlayerProfile,
    gameState.defeatedMonsterIds,
    bestScores,
    maxKeystrokes,
    weakQuestions,
    weakQuestionStats,
    manualQuestionStatuses,
    dailyProgress,
    bgmVolumeLevel,
    speechVoiceMode,
    speechRatePercent,
    autoPlaySettings,
    selectedQuestionKeysByScope,
    savedSelectionLists,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAllSpeechVoices([]);
      setSpeechVoices([]);
      return;
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      try {
        const voices = synth.getVoices();
        const englishVoices = voices.filter(isEnglishVoice);
        setAllSpeechVoices(voices);
        setSpeechVoices(englishVoices.length > 0 ? englishVoices : voices);
      } catch (error) {
        console.error('Failed to load speech voices:', error);
        setAllSpeechVoices([]);
        setSpeechVoices([]);
      }
    };

    loadVoices();

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', loadVoices);
      return () => synth.removeEventListener('voiceschanged', loadVoices);
    }

    const previousHandler = synth.onvoiceschanged;
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = previousHandler ?? null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (speechPreviewTimeoutRef.current !== null) {
        window.clearTimeout(speechPreviewTimeoutRef.current);
      }
      clearAutoPlayTimeout();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      soundEngine.stopBattleMusicPreview();
    };
  }, [clearAutoPlayTimeout]);

  useEffect(() => {
    if (gameState.screen === 'settings' || gameState.screen === 'question-list') return;
    clearSpeechPreviewTimeout();
    stopAutoPlay('停止しました');
    soundEngine.stopBattleMusicPreview();
  }, [clearSpeechPreviewTimeout, gameState.screen, stopAutoPlay]);

  useEffect(() => {
    if (gameState.screen !== 'settings') return;
    if (!settingsFocusSection) return;

    const timerId = window.setTimeout(() => {
      const sectionRef = settingsFocusSection === 'player-profiles'
        ? playerProfilesSectionRef.current
        : progressTransferSectionRef.current;
      sectionRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSettingsFocusSection(null);
    }, 60);

    return () => window.clearTimeout(timerId);
  }, [gameState.screen, settingsFocusSection]);

  useEffect(() => {
    if (gameState.screen !== 'question-list') return;
    if (!isAutoPlaying) return;
    stopAutoPlay('一覧条件の変更に合わせて停止しました');
  }, [
    isAutoPlaying,
    gameState.screen,
    gameState.selectedDifficulty,
    gameState.selectedLevel,
    questionListFilter,
    stopAutoPlay,
    weakListSort,
  ]);

  useEffect(() => {
    if (gameState.screen === 'battle') inputRef.current?.focus();
  }, [gameState.screen, gameState.currentQuestion]);

  useEffect(() => {
    if (gameState.screen !== 'battle') {
      setShowBossIntro(false);
      return;
    }

    if (gameState.bossStage === 0) return;

    const introKey = [
      gameState.selectedDifficulty,
      gameState.selectedLevel,
      gameState.mode,
      gameState.inputMode,
      gameState.currentMonsterIndex,
      gameState.bossStage,
    ].join(':');

    if (shownBossIntroKeyRef.current === introKey) return;
    shownBossIntroKeyRef.current = introKey;
    soundEngine.playBossComeOut();
    setShowBossIntro(true);

    const timer = window.setTimeout(() => {
      setShowBossIntro(false);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [
    gameState.screen,
    gameState.currentMonsterIndex,
    gameState.totalMonstersInStage,
    gameState.bossStage,
    gameState.selectedDifficulty,
    gameState.selectedLevel,
    gameState.mode,
    gameState.inputMode,
  ]);

  useEffect(() => {
    if (gameState.screen !== 'battle') {
      clearPendingBattleEndTimeout();
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
    }
  }, [clearPendingBattleEndTimeout, gameState.screen]);

  useEffect(() => {
    return () => {
      clearPendingBattleEndTimeout();
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
    };
  }, [clearPendingBattleEndTimeout]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isEditableEventTarget(e.target)) return;
      if (e.key !== 'Escape') return;
      if (showResetConfirm) setShowResetConfirm(false);
      if (showHelp) setShowHelp(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHelp, showResetConfirm]);
  
  const getJapaneseSpeechVoice = () => (
    allSpeechVoices.find(voice => normalizeVoiceLang(voice.lang).startsWith('ja'))
    ?? null
  );

  const updateSelectedQuestionKeysForScope = (
    difficulty: Difficulty,
    level: Level,
    nextKeys: string[],
  ) => {
    const scopeKey = getReviewScopeKey(difficulty, level);
    setSelectedQuestionKeysByScope(prev => ({
      ...prev,
      [scopeKey]: nextKeys,
    }));
  };

  const toggleSelectedQuestion = (
    difficulty: Difficulty,
    level: Level,
    question: Question,
  ) => {
    const scopeKey = getReviewScopeKey(difficulty, level);
    const questionKey = getQuestionStatusKey(difficulty, level, question);
    setSelectedQuestionKeysByScope(prev => {
      const currentKeys = prev[scopeKey] ?? [];
      const nextKeys = currentKeys.includes(questionKey)
        ? currentKeys.filter(key => key !== questionKey)
        : [...currentKeys, questionKey];

      return {
        ...prev,
        [scopeKey]: nextKeys,
      };
    });
  };

  const saveCurrentSelectionList = (
    difficulty: Difficulty,
    level: Level,
    questionKeys: string[],
    name: string,
  ) => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || questionKeys.length === 0) return false;

    const nextList: SavedSelectionList = {
      id: `${difficulty}:${level}:${Date.now()}`,
      name: trimmedName,
      difficulty,
      level,
      questionKeys,
      updatedAt: Date.now(),
    };

    setSavedSelectionLists(prev => (
      [nextList, ...prev.filter(list => !(list.difficulty === difficulty && list.level === level && list.name === trimmedName))]
    ));
    setSelectionListName('');
    return true;
  };

  const applySavedSelectionList = (list: SavedSelectionList) => {
    updateSelectedQuestionKeysForScope(list.difficulty, list.level, list.questionKeys);
    setGameState(prev => ({
      ...prev,
      selectedDifficulty: list.difficulty,
      selectedLevel: list.level,
      screen: 'question-list',
    }));
  };

  const deleteSavedSelectionList = (listId: string) => {
    setSavedSelectionLists(prev => prev.filter(list => list.id !== listId));
  };

  const beginProfileHydration = () => {
    profileHydratingRef.current = true;
    window.setTimeout(() => {
      profileHydratingRef.current = false;
    }, 0);
  };

  const activatePlayerProfile = (profileId: string) => {
    const currentProfile = getCurrentActivePlayer();
    if (currentProfile) {
      const currentSnapshot = captureCurrentProfileData();
      setPlayerProfiles((prev) => {
        const nextProfiles = prev.map((profile) => (
          profile.id === currentProfile.id
            ? { ...profile, updatedAt: Date.now(), data: currentSnapshot }
            : profile
        ));
        persistPlayerProfiles(nextProfiles, profileId);
        return nextProfiles;
      });
    }

    const nextProfile = playerProfiles.find((profile) => profile.id === profileId);
    if (!nextProfile) return;

    beginProfileHydration();
    setActivePlayerId(profileId);
    writeProfileDataToWorkingSet(nextProfile.data);
    applyProfileDataToState(nextProfile.data);
    setProgressTransferStatus(`プレイヤーを切り替えました: ${nextProfile.name}`);
  };

  const createPlayerProfile = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) return;

    const nextProfile: PlayerProfile = {
      id: `player-${Date.now()}`,
      name: trimmedName,
      updatedAt: Date.now(),
      data: normalizePlayerProfileData({}),
    };

    beginProfileHydration();
    setPlayerProfiles((prev) => {
      const currentProfile = getCurrentActivePlayer();
      const currentSnapshot = captureCurrentProfileData();
      const baseProfiles = currentProfile
        ? prev.map((profile) => (
          profile.id === currentProfile.id
            ? { ...profile, updatedAt: Date.now(), data: currentSnapshot }
            : profile
        ))
        : prev;
      const nextProfiles = [nextProfile, ...baseProfiles];
      persistPlayerProfiles(nextProfiles, nextProfile.id);
      return nextProfiles;
    });
    setActivePlayerId(nextProfile.id);
    writeProfileDataToWorkingSet(nextProfile.data);
    applyProfileDataToState(nextProfile.data);
    setNewPlayerName('');
    setProgressTransferStatus(`新しいプレイヤーを作成しました: ${nextProfile.name}`);
  };

  const handleNewPlayerNameChange = (value: string) => {
    setNewPlayerName(value.slice(0, PLAYER_NAME_MAX_LENGTH));
  };

  const handlePlayerNameDraftChange = (profileId: string, value: string) => {
    setPlayerNameDrafts(prev => ({
      ...prev,
      [profileId]: value.slice(0, PLAYER_NAME_MAX_LENGTH),
    }));
  };

  const renamePlayerProfile = (profileId: string) => {
    const profile = playerProfiles.find(item => item.id === profileId);
    if (!profile) return;

    const trimmedName = (playerNameDrafts[profileId] ?? profile.name).trim();
    if (!trimmedName) {
      setProgressTransferStatus('プレイヤー名を入力してください。');
      return;
    }

    if (trimmedName === profile.name) {
      setPlayerNameDrafts(prev => {
        const { [profileId]: removed, ...rest } = prev;
        void removed;
        return rest;
      });
      return;
    }

    setPlayerProfiles(prev => {
      const nextProfiles = prev.map(item => (
        item.id === profileId
          ? { ...item, name: trimmedName, updatedAt: Date.now() }
          : item
      ));
      persistPlayerProfiles(nextProfiles, activePlayerId);
      return nextProfiles;
    });
    setPlayerNameDrafts(prev => {
      const { [profileId]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
    setProgressTransferStatus(`プレイヤー名を変更しました: ${trimmedName}`);
  };

  const deletePlayerProfile = (profileId: string) => {
    if (playerProfiles.length <= 1) {
      setProgressTransferStatus('最後の1人は削除できません。');
      return;
    }

    const remainingProfiles = playerProfiles.filter((profile) => profile.id !== profileId);
    const nextActiveProfile = remainingProfiles.find((profile) => profile.id === activePlayerId) ?? remainingProfiles[0];

    beginProfileHydration();
    setPlayerProfiles(remainingProfiles);
    setActivePlayerId(nextActiveProfile.id);
    persistPlayerProfiles(remainingProfiles, nextActiveProfile.id);
    writeProfileDataToWorkingSet(nextActiveProfile.data);
    applyProfileDataToState(nextActiveProfile.data);
    setPlayerNameDrafts(prev => {
      const { [profileId]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
    setProgressTransferStatus(`プレイヤーを削除しました。現在のプレイヤー: ${nextActiveProfile.name}`);
  };

  const buildProgressExportPayload = (): ProgressExportPayload => ({
    formatVersion: 2,
    app: 'english-typing-rpg',
    exportedAt: new Date().toISOString(),
    player: {
      id: activePlayerId || `player-${Date.now()}`,
      name: getCurrentActivePlayer()?.name ?? 'Player',
      data: captureCurrentProfileData(),
    },
  });

  const downloadProgressSnapshot = () => {
    try {
      const payload = buildProgressExportPayload();
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = payload.exportedAt.replace(/[:.]/g, '-');
      const playerName = (payload.player?.name ?? 'player').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'player';
      link.href = url;
      link.download = `english-typing-rpg-progress-${playerName}-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setProgressTransferStatus(`学習データを書き出しました: ${payload.player?.name ?? 'Player'}`);
    } catch (error) {
      console.error('Failed to export progress data:', error);
      setProgressTransferStatus('学習データの書き出しに失敗しました。');
    }
  };

  const applyImportedProgressSnapshot = (payload: ProgressExportPayload) => {
    const importedData = payload.data ?? {};
    const todayKey = getTodayKey();
    const defeatedMonsterIds = normalizeDefeatedMonsterIds(importedData.defeatedMonsterIds ?? []);
    const importedBestScores = normalizeBestScores(importedData.bestScores ?? {});
    const importedMaxKeystrokes = normalizeMaxKeystrokes(importedData.maxKeystrokes);
    const importedWeakQuestions = normalizeQuestionArray(importedData.weakQuestions ?? []);
    const importedWeakQuestionStats = normalizeWeakQuestionStats(importedData.weakQuestionStats ?? {});
    const importedManualStatuses = normalizeManualQuestionStatuses(importedData.manualQuestionStatuses ?? {});
    const importedReviewQueue = normalizeReviewQueue(importedData.reviewQueue ?? []);
    const importedDailyProgress = normalizeDailyProgress(importedData.dailyProgress ?? createDailyProgress(todayKey));
    const normalizedReviewQueue = importedDailyProgress.date === todayKey
      ? importedReviewQueue
      : importedReviewQueue.map((entry) => ({ ...entry, remainingQuestions: 0 }));
    const normalizedDailyProgress = importedDailyProgress.date === todayKey
      ? importedDailyProgress
      : createDailyProgress(todayKey);
    const importedBgmVolumeLevel = normalizeBgmVolumeLevel(importedData.bgmVolumeLevel);
    const importedSpeechVoiceMode = normalizeSpeechVoiceMode(importedData.speechVoiceMode);
    const importedSpeechRatePercent = normalizeSpeechRatePercent(importedData.speechRatePercent);
    const importedAutoPlaySettings = normalizeAutoPlaySettings(importedData.autoPlaySettings ?? getDefaultAutoPlaySettings());
    const importedSelectedQuestionKeysByScope = normalizeSelectedQuestionKeysByScope(importedData.selectedQuestionKeysByScope ?? {});
    const importedSavedSelectionLists = normalizeSavedSelectionLists(importedData.savedSelectionLists ?? []);

    stopAutoPlay('学習データの読み込みに合わせて停止しました');

    setGameState((prev) => ({
      ...prev,
      defeatedMonsterIds,
    }));
    localStorage.setItem(STORAGE_KEYS.defeatedMonsters, JSON.stringify(defeatedMonsterIds));

    setBestScores(importedBestScores);
    localStorage.setItem(STORAGE_KEYS.bestScores, JSON.stringify(importedBestScores));

    setMaxKeystrokes(importedMaxKeystrokes);
    localStorage.setItem(STORAGE_KEYS.maxKeystrokes, String(importedMaxKeystrokes));

    setWeakQuestions(importedWeakQuestions);
    localStorage.setItem(STORAGE_KEYS.weakQuestions, JSON.stringify(importedWeakQuestions));

    setWeakQuestionStats(importedWeakQuestionStats);
    localStorage.setItem(STORAGE_KEYS.weakQuestionStats, JSON.stringify(importedWeakQuestionStats));

    setManualQuestionStatuses(importedManualStatuses);
    localStorage.setItem(STORAGE_KEYS.manualQuestionStatuses, JSON.stringify(importedManualStatuses));

    reviewQueueRef.current = normalizedReviewQueue;
    localStorage.setItem(STORAGE_KEYS.reviewQueue, JSON.stringify(normalizedReviewQueue));

    setDailyProgress(normalizedDailyProgress);
    localStorage.setItem(STORAGE_KEYS.dailyProgress, JSON.stringify(normalizedDailyProgress));

    setBgmVolumeLevel(importedBgmVolumeLevel);
    localStorage.setItem(STORAGE_KEYS.bgmVolumeLevel, String(importedBgmVolumeLevel));

    setSpeechVoiceMode(importedSpeechVoiceMode);
    localStorage.setItem(STORAGE_KEYS.speechVoiceMode, importedSpeechVoiceMode);

    setSpeechRatePercent(importedSpeechRatePercent);
    localStorage.setItem(STORAGE_KEYS.speechRatePercent, String(importedSpeechRatePercent));

    setAutoPlaySettings(importedAutoPlaySettings);
    localStorage.setItem(STORAGE_KEYS.autoPlaySettings, JSON.stringify(importedAutoPlaySettings));

    setSelectedQuestionKeysByScope(importedSelectedQuestionKeysByScope);
    localStorage.setItem(STORAGE_KEYS.selectedQuestionKeysByScope, JSON.stringify(importedSelectedQuestionKeysByScope));

    setSavedSelectionLists(importedSavedSelectionLists);
    localStorage.setItem(STORAGE_KEYS.savedSelectionLists, JSON.stringify(importedSavedSelectionLists));

    setProgressTransferStatus(`学習データを読み込みました: ${payload.exportedAt}`);
  };

  void applyImportedProgressSnapshot;

  const importPlayerProgressSnapshot = (payload: ProgressExportPayload) => {
    const importedProfile: PlayerProfile = payload.player
      ? {
        id: payload.player.id || `player-${Date.now()}`,
        name: payload.player.name?.trim() || 'Imported Player',
        updatedAt: Date.now(),
        data: normalizePlayerProfileData(payload.player.data ?? {}),
      }
      : {
        id: `player-${Date.now()}`,
        name: 'Imported Player',
        updatedAt: Date.now(),
        data: normalizePlayerProfileData(payload.data ?? {}),
      };

    stopAutoPlay('学習データの読み込みに合わせて停止しました');
    beginProfileHydration();

    setPlayerProfiles((prev) => {
      const currentProfile = getCurrentActivePlayer();
      const currentSnapshot = captureCurrentProfileData();
      const baseProfiles = currentProfile
        ? prev.map((profile) => (
          profile.id === currentProfile.id
            ? { ...profile, updatedAt: Date.now(), data: currentSnapshot }
            : profile
        ))
        : prev;
      const exists = baseProfiles.some((profile) => profile.id === importedProfile.id);
      const nextProfiles = exists
        ? baseProfiles.map((profile) => (profile.id === importedProfile.id ? importedProfile : profile))
        : [importedProfile, ...baseProfiles];
      persistPlayerProfiles(nextProfiles, importedProfile.id);
      return nextProfiles;
    });

    setActivePlayerId(importedProfile.id);
    writeProfileDataToWorkingSet(importedProfile.data);
    applyProfileDataToState(importedProfile.data);
    setProgressTransferStatus(`学習データを読み込みました: ${importedProfile.name}`);
  };

  const handleImportProgressFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isProgressExportPayload(parsed)) {
        setProgressTransferStatus('対応していない学習データです。');
        return;
      }

      importPlayerProgressSnapshot(parsed);
    } catch (error) {
      console.error('Failed to import progress data:', error);
      setProgressTransferStatus('学習データの読み込みに失敗しました。');
    }
  };

  const openProgressImportPicker = () => {
    progressImportInputRef.current?.click();
  };

  const playSpeechPreview = (voiceMode: SpeechVoiceMode, ratePercent: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    clearSpeechPreviewTimeout();
    const speechConfig = resolveSpeechConfig(speechVoices, voiceMode);
    speakText(SETTINGS_SPEECH_PREVIEW_TEXT, {
      voice: speechConfig.voice,
      lang: speechConfig.lang,
      rate: ratePercent / 100,
    });
  };

  const scheduleSpeechPreview = (voiceMode: SpeechVoiceMode, ratePercent: number, delayMs: number = 250) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    clearSpeechPreviewTimeout();
    speechPreviewTimeoutRef.current = window.setTimeout(() => {
      speechPreviewTimeoutRef.current = null;
      playSpeechPreview(voiceMode, ratePercent);
    }, delayMs);
  };

  const handleBgmVolumeSelect = (level: number) => {
    setBgmVolumeLevel(level);
    if (level === 0) {
      soundEngine.stopBattleMusicPreview();
      return;
    }
    soundEngine.playBattleMusicPreview(SETTINGS_BGM_PREVIEW_TRACK, BGM_VOLUME_LEVELS[level]);
  };

  const handleSpeechVoiceSelect = (voiceMode: SpeechVoiceMode) => {
    if (!isSpeechModeSelectable(speechVoices, voiceMode)) {
      return;
    }
    setSpeechVoiceMode(voiceMode);
    playSpeechPreview(voiceMode, speechRatePercent);
  };

  const handleSpeechRateChange = (nextRatePercent: number) => {
    setSpeechRatePercent(nextRatePercent);
    scheduleSpeechPreview(speechVoiceMode, nextRatePercent);
  };

  const speakCurrentQuestion = useCallback(() => {
      if (!gameState.currentQuestion.text) return;
      speakWithSettings(gameState.currentQuestion.text);
      setTimeout(() => inputRef.current?.focus(), 10);
  }, [gameState.currentQuestion.text, speakWithSettings]);

  const saveDefeatedMonster = (monsterId: string) => {
    setGameState(prev => {
      const uniqueKey = getUniqueKey(prev.selectedDifficulty, prev.selectedLevel, prev.mode, prev.inputMode, monsterId);
      if (matchesDefeatedMonster(prev.defeatedMonsterIds, prev.selectedDifficulty, prev.selectedLevel, prev.mode, prev.inputMode, monsterId)) {
        return prev;
      }
      const newIds = [...prev.defeatedMonsterIds, uniqueKey];
      localStorage.setItem(STORAGE_KEYS.defeatedMonsters, JSON.stringify(newIds));
      return { ...prev, defeatedMonsterIds: newIds };
    });
  };

  const saveWeakQuestions = (newMissed: Question[]) => {
      if (newMissed.length === 0) return;
      const updatedWeak = [...weakQuestions];
      newMissed.forEach(q => {
          if (!updatedWeak.some(wq => wq.text === q.text)) { updatedWeak.push(q); }
      });
      setWeakQuestions(updatedWeak);
      localStorage.setItem(STORAGE_KEYS.weakQuestions, JSON.stringify(updatedWeak));
      recordWeakQuestionStats(newMissed);
  };

  const incrementDailyQuestionCount = () => {
    const todayKey = getTodayKey();
    setDailyProgress(prev => {
      const base = prev.date === todayKey ? prev : createDailyProgress(todayKey);
      const nextProgress = {
        ...base,
        questionCount: base.questionCount + 1,
      };
      localStorage.setItem(STORAGE_KEYS.dailyProgress, JSON.stringify(nextProgress));
      return nextProgress;
    });
  };

  const persistReviewQueue = () => {
    localStorage.setItem(STORAGE_KEYS.reviewQueue, JSON.stringify(reviewQueueRef.current));
    persistActivePlayerProfile({ reviewQueue: reviewQueueRef.current });
  };

  const getReviewDelay = (missCount: number) => {
    if (missCount <= 1) return REVIEW_REAPPEAR_DELAY;
    if (missCount === 2) return 4;
    return 3;
  };

  const recordWeakQuestionStats = (questionsToRecord: Question[]) => {
      if (questionsToRecord.length === 0) return;
      const timestamp = Date.now();
      setWeakQuestionStats(prev => {
        const nextStats = { ...prev };
        questionsToRecord.forEach(question => {
          const current = nextStats[question.text] ?? getDefaultWeakQuestionStat();
          nextStats[question.text] = {
            missCount: current.missCount + 1,
            lastMissedAt: timestamp,
            consecutiveCorrect: 0,
          };
        });
        localStorage.setItem(STORAGE_KEYS.weakQuestionStats, JSON.stringify(nextStats));
        return nextStats;
      });
  };

  const recordWeakQuestionSuccess = (question: Question) => {
    const current = weakQuestionStats[question.text] ?? getDefaultWeakQuestionStat();
    const nextStats = {
      ...weakQuestionStats,
      [question.text]: {
        ...current,
        consecutiveCorrect: current.consecutiveCorrect + 1,
      },
    };

    setWeakQuestionStats(nextStats);
    localStorage.setItem(STORAGE_KEYS.weakQuestionStats, JSON.stringify(nextStats));

    const isMastered = nextStats[question.text].consecutiveCorrect >= 2;
    if (!isMastered) return false;

    if (weakQuestions.some(q => q.text === question.text)) {
      const updatedWeak = weakQuestions.filter(q => q.text !== question.text);
      setWeakQuestions(updatedWeak);
      localStorage.setItem(STORAGE_KEYS.weakQuestions, JSON.stringify(updatedWeak));
    }

    return true;
  };

  const handleResetHistory = () => {
    setShowResetConfirm(true);
  };

  const confirmResetHistory = () => {
    [
      STORAGE_KEYS.defeatedMonsters,
      STORAGE_KEYS.bestScores,
      STORAGE_KEYS.maxKeystrokes,
      STORAGE_KEYS.weakQuestions,
      STORAGE_KEYS.weakQuestionStats,
      STORAGE_KEYS.manualQuestionStatuses,
      STORAGE_KEYS.reviewQueue,
      STORAGE_KEYS.dailyProgress,
      STORAGE_KEYS.bgmVolumeLevel,
      STORAGE_KEYS.speechVoiceMode,
      STORAGE_KEYS.speechRatePercent,
      STORAGE_KEYS.autoPlaySettings,
      STORAGE_KEYS.selectedQuestionKeysByScope,
      STORAGE_KEYS.savedSelectionLists,
    ].forEach(key => localStorage.removeItem(key));
    setBestScores({});
    setMaxKeystrokes(0);
    setWeakQuestions([]);
    setWeakQuestionStats({});
    setManualQuestionStatuses({});
    setDailyProgress(createDailyProgress());
    reviewQueueRef.current = [];
    activeReviewEntryRef.current = null;
    setShowResetConfirm(false);
    setGameState(prev => ({
      ...prev,
      defeatedMonsterIds: [],
      score: 0,
      history: [],
      battleResult: null,
      isNewRecord: false,
      missCount: 0,
      totalKeystrokes: 0,
      hintLength: 0,
      currentBattleMissedQuestions: [],
      battleLog: [],
      battleStartScore: 0,
      battleStartKeystrokes: 0,
    }));
    setProgressTransferStatus('現在のプレイヤーの学習データをリセットしました。');
  };

  const handleGameEnd = (result: BattleResult, finalScore: number, history: BattleHistoryItem[], diff: Difficulty, level: Level, mode: Mode, finalKeystrokes: number, missedQs: Question[], playWinSound: boolean = true) => {
      clearPendingBattleEndTimeout();
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
      const key = `${diff}_${level}_${mode}`;
      const currentBest = bestScores[key] || 0;
      let isNewRecord = false;

      if (mode !== 'weakness') {
        if (result === 'win' && finalScore > currentBest) {
            isNewRecord = true;
            const newScores = { ...bestScores, [key]: finalScore };
            setBestScores(newScores);
            localStorage.setItem(STORAGE_KEYS.bestScores, JSON.stringify(newScores));
            if (playWinSound) soundEngine.playNewRecord();
        } else if (result === 'win') {
            if (playWinSound) soundEngine.playClear();
        } else {
            soundEngine.playFail();
        }
        if (finalKeystrokes > maxKeystrokes) {
            setMaxKeystrokes(finalKeystrokes);
            localStorage.setItem(STORAGE_KEYS.maxKeystrokes, finalKeystrokes.toString());
        }
      } else {
          if (result === 'win' && playWinSound) soundEngine.playClear();
          else soundEngine.playFail();
      }
      saveWeakQuestions(missedQs);
      setGameState(prev => ({ ...prev, screen: 'result', battleResult: result, score: finalScore, history: history, isNewRecord: isNewRecord, missCount: 0, hintLength: 0 }));
  };

  const openWeakReviewHub = () => {
    setQuestionListFilter('weak');
    setWeakListSort('recent');
    setGameState(prev => ({ ...prev, screen: 'question-list' }));
  };

  const startGame = (diff: Difficulty, level: Level, mode: Mode, inputMode: InputMode, reviewQuestions?: Question[] | null) => {
    const monstersObj = MONSTERS[level];
    const guideTargetCount = getGuideTargetCount(diff, level);
    const listeningTargetCount = getListeningTargetCount(diff, level);
    let selectedList: Monster[] = [];
    let indices: number[] = [];
    let totalStageMonsters = 0;
    const playableQuestions = getScopedPlayableQuestions(diff, level);

    if (playableQuestions.length === 0) {
      alert("この範囲で出題できる問題がありません。除外を見直してください。");
      return;
    }

    sessionWeakQuestionsRef.current = reviewQuestions && reviewQuestions.length > 0
      ? reviewQuestions.filter(question => !isQuestionExcluded(diff, level, question))
      : null;
    activeReviewEntryRef.current = null;

    const getOrderedStageIndices = (list: Monster[], countToSelect: number, rangeLimit: number = list.length) => {
        const cappedRange = Math.min(rangeLimit, list.length);
        const cappedCount = Math.min(countToSelect, cappedRange);
        return Array.from({ length: cappedCount }, (_, index) => index);
    };

    if (mode === 'guide') {
      selectedList = monstersObj.guide;
      indices = getBattleStageIndices(selectedList, getOrderedStageIndices(selectedList, guideTargetCount, guideTargetCount).length, mode, inputMode);
      totalStageMonsters = indices.length;
    } else if (mode === 'weakness') {
        const activeWeakQuestions = sessionWeakQuestionsRef.current ?? getScopedWeakQuestions(diff, level);
        if (activeWeakQuestions.length === 0) { alert("まだ苦手な単語がありません！"); return; }
        selectedList = monstersObj.guide; 
        const count = Math.min(activeWeakQuestions.length, 10);
        indices = Array.from({length: count}, (_, i) => i % selectedList.length);
        totalStageMonsters = count;
    } else {
      if (inputMode === 'voice-text') {
        selectedList = monstersObj.guide;
        indices = getBattleStageIndices(selectedList, getOrderedStageIndices(selectedList, listeningTargetCount, listeningTargetCount).length, mode, inputMode);
        totalStageMonsters = indices.length;
      } else if (inputMode === 'voice-only') {
        selectedList = monstersObj.challenge;
        indices = getBattleStageIndices(selectedList, getOrderedStageIndices(selectedList, NORMAL_TARGET_COUNT, NORMAL_TARGET_COUNT).length, mode, inputMode);
        totalStageMonsters = indices.length;
      } else {
        selectedList = monstersObj.challenge;
        indices = getBattleStageIndices(selectedList, getOrderedStageIndices(selectedList, HARD_TARGET_COUNT, HARD_TARGET_COUNT).length, mode, inputMode);
        totalStageMonsters = indices.length;
      }
    }

    let startStep = 0;
    // Resume Training/Challenge from the first undefeated monster.
    // If all target monsters are already defeated, start from the beginning for replay.
    if (mode === 'guide' || mode === 'challenge') {
      const nextUndeatedStep = indices.findIndex(monsterIndex => {
        return !matchesDefeatedMonster(
          gameState.defeatedMonsterIds,
          diff,
          level,
          mode,
          inputMode,
          selectedList[monsterIndex].id
        );
      });

      startStep = nextUndeatedStep >= 0 ? nextUndeatedStep : 0;
    }

    initBattle(diff, level, mode, inputMode, startStep, indices, selectedList, totalStageMonsters, 0, 0);
  };

  const initBattle = (diff: Difficulty, level: Level, mode: Mode, inputMode: InputMode, stepIndex: number, indices: number[], monsterList: Monster[], totalMonsters: number, currentScore: number, currentKeystrokes: number) => {
    clearPendingBattleEndTimeout();
    setLastSolvedQuestion(null);
    recentReviewAppearanceRef.current = [];
    const safeIndices = indices.length > 0 ? indices : [0];
    const safeStepIndex = Math.min(Math.max(stepIndex, 0), safeIndices.length - 1);
    const actualMonsterIndex = safeIndices[safeStepIndex] ?? 0;
    const startingMonster = monsterList[actualMonsterIndex] ?? monsterList[0];
    const bossStage = getBossStage(mode, inputMode, safeStepIndex, totalMonsters);
    const battleTuning = getBattleTuning(diff, mode, inputMode, startingMonster.baseHp, bossStage);
    const startingMonsterHp = battleTuning.monsterHp;
    const maxQuestions = battleTuning.maxQuestions;
    const useBossBattleMusic = startingMonster?.type === 'boss' || bossStage > 0;
    if (!startingMonster) return;
    soundEngine.stopBattleAmbience();
    soundEngine.stopBattleMusic();
    soundEngine.startBattleMusic(
      getBattleMusicPath(mode, inputMode, useBossBattleMusic),
      BGM_VOLUME_LEVELS[bgmVolumeLevel]
    );
    let question: Question;
    const activeReviewQuestions = sessionWeakQuestionsRef.current;
    if (activeReviewQuestions && activeReviewQuestions.length > 0) {
        question = activeReviewQuestions[Math.floor(Math.random() * activeReviewQuestions.length)];
        activeReviewEntryRef.current = null;
    } else if (mode === 'weakness') {
        const activeWeakQuestions = getScopedWeakQuestions(diff, level);
        if (activeWeakQuestions.length > 0) { question = activeWeakQuestions[Math.floor(Math.random() * activeWeakQuestions.length)]; } 
        else { question = { text: "No Weakness", translation: "苦手なし" }; }
        activeReviewEntryRef.current = null;
    } else {
        question = getNextBattleQuestion(diff, level, null);
    }

    setGameState(prev => ({
      ...prev, screen: 'battle', selectedDifficulty: diff, selectedLevel: level, mode: mode, inputMode: inputMode,
      currentMonsterIndex: safeStepIndex, currentMonsterList: monsterList, challengeModeIndices: safeIndices,
      monsterHp: startingMonsterHp, maxMonsterHp: startingMonsterHp, score: currentScore, combo: 0,
      currentQuestion: question, userInput: "", startTime: null, history: [], questionCount: 1, maxQuestions,
      battleResult: null, totalMonstersInStage: totalMonsters, isNewRecord: false, missCount: 0,
      totalKeystrokes: currentKeystrokes, hintLength: 0, currentBattleMissedQuestions: [],
      battleLog: [],
      battleStartScore: currentScore,
      battleStartKeystrokes: currentKeystrokes,
      bossStage,
    }));
  };
  const initBattleRef = useRef(initBattle);
  initBattleRef.current = initBattle;

  // Keyboard support for replaying question audio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState.screen === 'battle') {
            const isRightCtrlKey =
                e.code === 'ControlRight' ||
                (e.key === 'Control' && e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT);

            if (isRightCtrlKey && !e.repeat) {
                e.preventDefault();
                speakCurrentQuestion();
            }
            return;
        }

        if (isEditableEventTarget(e.target)) return;

        if (gameState.screen === 'result') {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Find primary action button and click it
                if (gameState.battleResult === 'win') {
                    const isNextAvailable = gameState.currentMonsterIndex < gameState.totalMonstersInStage - 1;
                    if (isNextAvailable) {
                         // Next Monster
                         initBattleRef.current(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex + 1, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, gameState.totalKeystrokes);
                    } else {
                         // Back to Mode Select (Complete)
                         setGameState(prev => ({ ...prev, screen: 'mode-select' }));
                    }
                } else {
                    // Retry
                    initBattleRef.current(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.battleStartScore, gameState.battleStartKeystrokes);
                }
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, speakCurrentQuestion]);

  const shuffleIndices = (length: number) => {
    const indices = Array.from({ length }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  };

  const getQuestionPoolKey = (diff: Difficulty, level: Level) => `${diff}:${level}`;

  const getNextQuestionFromPool = (diff: Difficulty, level: Level): Question => {
    const list = QUESTIONS[diff]?.[level] || [];
    if (list.length === 0) return { text: "No Data", translation: "No questions" };

    const poolKey = getQuestionPoolKey(diff, level);
    const existingPool = questionPoolRef.current[poolKey];
    const shouldRefreshPool =
      !existingPool ||
      existingPool.order.length !== list.length ||
      existingPool.cursor >= existingPool.order.length;

    if (shouldRefreshPool) {
      const order = shuffleIndices(list.length);
      if (existingPool && existingPool.lastIndex !== null && list.length > 1 && order[0] === existingPool.lastIndex) {
        const swapIndex = order.findIndex(index => index !== existingPool.lastIndex);
        if (swapIndex > 0) {
          [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
        }
      }
      questionPoolRef.current[poolKey] = {
        order,
        cursor: 0,
        lastIndex: existingPool?.lastIndex ?? null,
      };
    }

    const pool = questionPoolRef.current[poolKey];
    const nextIndex = pool.order[pool.cursor] ?? 0;
    pool.cursor += 1;
    pool.lastIndex = nextIndex;
    return list[nextIndex] ?? list[0];
  };

  const getRandomQuestion = (diff: Difficulty, level: Level, currentQ: Question | null): Question => {
    const list = QUESTIONS[diff]?.[level] || []; 
    if (list.length === 0) return { text: "No Data", translation: "データがありません" };
    const nextQ = getNextQuestionFromPool(diff, level);
    if (!currentQ || nextQ.text !== currentQ.text) return nextQ;
    return getNextQuestionFromPool(diff, level);
  };

  const getPlayableRandomQuestion = (diff: Difficulty, level: Level, currentQ: Question | null): Question => {
    const list = getScopedPlayableQuestions(diff, level);
    if (list.length === 0) return { text: "No Data", translation: "出題できる問題がありません" };
    const poolFallback = getRandomQuestion(diff, level, currentQ);
    const candidates = list.filter(question => (
      !currentQ
      || question.text !== currentQ.text
      || question.translation !== currentQ.translation
    ));
    const source = candidates.length > 0 ? candidates : list;
    const weightedList = source.flatMap(question => {
      const status = getManualQuestionStatus(diff, level, question);
      return Array.from({ length: getWeightedLearningLevel(status) }, () => question);
    });

    return weightedList[Math.floor(Math.random() * weightedList.length)] ?? source[0] ?? poolFallback;
  };

  const decrementReviewQueueTimers = () => {
    if (reviewQueueRef.current.length === 0) return;
    reviewQueueRef.current = reviewQueueRef.current.map(entry => ({
      ...entry,
      remainingQuestions: Math.max(0, entry.remainingQuestions - 1),
    }));
    persistReviewQueue();
  };

  const scheduleQuestionReview = (question: Question, baseMissCount: number = 0) => {
    if (isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, question)) return;
    const reviewScopeKey = getReviewScopeKey(gameState.selectedDifficulty, gameState.selectedLevel);
    const existingIndex = reviewQueueRef.current.findIndex(entry => (
      getReviewScopeKey(entry.difficulty, entry.level) === reviewScopeKey
      && entry.question.text === question.text
      && entry.question.translation === question.translation
    ));
    const nextMissCount = Math.max(
      existingIndex >= 0 ? reviewQueueRef.current[existingIndex].missCount + 1 : 0,
      baseMissCount + 1,
    );
    const nextEntry: ReviewQueueEntry = {
      difficulty: gameState.selectedDifficulty,
      level: gameState.selectedLevel,
      question,
      remainingQuestions: getReviewDelay(nextMissCount),
      missCount: nextMissCount,
    };

    if (existingIndex >= 0) {
      reviewQueueRef.current[existingIndex] = nextEntry;
    } else {
      reviewQueueRef.current.push(nextEntry);
    }

    persistReviewQueue();
  };

  const rescheduleReviewQuestionAfterSuccess = (entry: ReviewQueueEntry) => {
    if (isQuestionExcluded(entry.difficulty, entry.level, entry.question)) return;
    reviewQueueRef.current.push({
      ...entry,
      remainingQuestions: getReviewDelay(entry.missCount),
    });
    persistReviewQueue();
  };

  const getDueReviewQuestion = (diff: Difficulty, level: Level, currentQ: Question | null): ReviewQueueEntry | null => {
    const reviewScopeKey = getReviewScopeKey(diff, level);
    for (let index = 0; index < reviewQueueRef.current.length; index += 1) {
      const entry = reviewQueueRef.current[index];
      if (getReviewScopeKey(entry.difficulty, entry.level) !== reviewScopeKey) continue;
      if (entry.remainingQuestions > 0) continue;
      if (isQuestionExcluded(entry.difficulty, entry.level, entry.question)) {
        reviewQueueRef.current.splice(index, 1);
        persistReviewQueue();
        return getDueReviewQuestion(diff, level, currentQ);
      }
      if (currentQ && entry.question.text === currentQ.text && entry.question.translation === currentQ.translation) continue;

      reviewQueueRef.current.splice(index, 1);
      persistReviewQueue();
      return entry;
    }

    return null;
  };

  const canServeReviewQuestion = () => {
    const nextWindow = [...recentReviewAppearanceRef.current.slice(-(REVIEW_RATE_WINDOW_SIZE - 1)), true];
    const reviewCount = nextWindow.filter(Boolean).length;
    return reviewCount <= REVIEW_RATE_MAX_IN_WINDOW;
  };

  const recordRecentQuestionSource = (wasReviewQuestion: boolean) => {
    recentReviewAppearanceRef.current = [
      ...recentReviewAppearanceRef.current.slice(-(REVIEW_RATE_WINDOW_SIZE - 1)),
      wasReviewQuestion,
    ];
  };

  const getNextBattleQuestion = (diff: Difficulty, level: Level, currentQ: Question | null): Question => {
    if (!canServeReviewQuestion()) {
      activeReviewEntryRef.current = null;
      return getPlayableRandomQuestion(diff, level, currentQ);
    }

    const reviewEntry = getDueReviewQuestion(diff, level, currentQ);
    activeReviewEntryRef.current = reviewEntry;
    if (reviewEntry) return reviewEntry.question;
    activeReviewEntryRef.current = null;
    return getPlayableRandomQuestion(diff, level, currentQ);
  };

  const handleSkip = () => {
    setLastSolvedQuestion(gameState.currentQuestion);
    advanceGame(0, 0, true, 0);
    inputRef.current?.focus();
  };

  const advanceGame = (damage: number, speed: number, skipped: boolean, addedChars: number) => {
    incrementDailyQuestionCount();
    decrementReviewQueueTimers();

    const nextHp = skipped ? gameState.monsterHp : Math.max(0, gameState.monsterHp - damage);
    const isMonsterDefeated = !skipped && nextHp <= 0;
    const currentScore = gameState.score + damage;
    const nextKeystrokes = gameState.totalKeystrokes + addedChars;
    const newHistory = [...gameState.history, { damage, speed }];
    const activeReviewEntry = activeReviewEntryRef.current;
    const wasCurrentQuestionReview = !!activeReviewEntry;
    let masteredCurrentQuestion = false;

    recordRecentQuestionSource(wasCurrentQuestionReview);

    if (!skipped) {
      updateAutoLearningStatus(
        gameState.selectedDifficulty,
        gameState.selectedLevel,
        gameState.currentQuestion,
        gameState.missCount === 0 ? 'success' : 'struggle',
        gameState.mode,
        gameState.inputMode,
      );
    }

    const newMissedQs = [...gameState.currentBattleMissedQuestions];
    if (gameState.missCount > 0 && !newMissedQs.some(q => q.text === gameState.currentQuestion.text)) { newMissedQs.push(gameState.currentQuestion); }
    if (gameState.mode !== 'weakness' && gameState.missCount > 0) {
      scheduleQuestionReview(gameState.currentQuestion, activeReviewEntry?.missCount ?? 0);
    } else if (activeReviewEntry && gameState.missCount === 0) {
      masteredCurrentQuestion = recordWeakQuestionSuccess(gameState.currentQuestion);
      if (!masteredCurrentQuestion) {
        rescheduleReviewQuestionAfterSuccess(activeReviewEntry);
      }
    }
    
    let remainingWeakQuestions = weakQuestions;
    let remainingSessionQuestions = sessionWeakQuestionsRef.current;
    const hadSessionReview = remainingSessionQuestions !== null;
    if (gameState.missCount === 0) {
        if (!activeReviewEntry && remainingWeakQuestions.some(q => q.text === gameState.currentQuestion.text)) {
            masteredCurrentQuestion = recordWeakQuestionSuccess(gameState.currentQuestion);
        }

        if (remainingSessionQuestions?.some(q => q.text === gameState.currentQuestion.text)) {
            remainingSessionQuestions = remainingSessionQuestions.filter(q => q.text !== gameState.currentQuestion.text);
            sessionWeakQuestionsRef.current = remainingSessionQuestions;
        }

        if (masteredCurrentQuestion && remainingWeakQuestions.some(q => q.text === gameState.currentQuestion.text)) {
            remainingWeakQuestions = remainingWeakQuestions.filter(q => q.text !== gameState.currentQuestion.text);
        }
    }

    const logItem: BattleLogItem = {
        question: gameState.currentQuestion,
        missCount: skipped ? -1 : gameState.missCount, 
        skipped: skipped
    };
    const newBattleLog = [...gameState.battleLog, logItem];

    const activeRemainingQuestions = remainingSessionQuestions
      ?? (gameState.mode === 'weakness' ? remainingWeakQuestions : []);

    if (hadSessionReview && gameState.missCount === 0 && remainingSessionQuestions && remainingSessionQuestions.length === 0) {
      handleGameEnd('win', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs);
      setGameState(prev => ({ ...prev, monsterHp: 0, score: currentScore, history: newHistory, totalKeystrokes: nextKeystrokes, currentBattleMissedQuestions: newMissedQs, battleLog: newBattleLog }));
      return;
    }

    if (gameState.mode === 'weakness' && gameState.missCount === 0 && activeRemainingQuestions.length === 0) {
      handleGameEnd('win', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs);
      setGameState(prev => ({ ...prev, monsterHp: 0, score: currentScore, history: newHistory, totalKeystrokes: nextKeystrokes, currentBattleMissedQuestions: newMissedQs, battleLog: newBattleLog }));
      return;
    }

    if (isMonsterDefeated) {
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      
      const actualId = gameState.challengeModeIndices[gameState.currentMonsterIndex];
      const monster = gameState.currentMonsterList[actualId];
      
      if (gameState.mode !== 'weakness') { 
          saveDefeatedMonster(monster.id); 
      }

      const isLastMonster = gameState.currentMonsterIndex >= gameState.totalMonstersInStage - 1;
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();

      pendingBattleEndTimeoutRef.current = window.setTimeout(() => {
          pendingBattleEndTimeoutRef.current = null;
          if (isLastMonster) soundEngine.playStageClear(); 
          handleGameEnd('win', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs, !isLastMonster);
      }, 800); 

      setGameState(prev => ({ ...prev, monsterHp: 0, score: currentScore, history: newHistory, totalKeystrokes: nextKeystrokes, currentBattleMissedQuestions: newMissedQs, battleLog: newBattleLog }));
      return;
    }

    if (gameState.questionCount >= gameState.maxQuestions) {
       handleGameEnd('draw', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs);
       return;
    }

    let nextQ: Question;
    if (activeRemainingQuestions.length > 0) {
      nextQ = activeRemainingQuestions[Math.floor(Math.random() * activeRemainingQuestions.length)];
    } else {
      nextQ = getNextBattleQuestion(gameState.selectedDifficulty, gameState.selectedLevel, gameState.currentQuestion);
    }
    
    setGameState(prev => ({
      ...prev, monsterHp: nextHp, score: currentScore, combo: skipped ? 0 : prev.combo + 1, currentQuestion: nextQ, userInput: "", 
      startTime: null, history: newHistory, questionCount: prev.questionCount + 1, missCount: 0, totalKeystrokes: nextKeystrokes, hintLength: 0, currentBattleMissedQuestions: newMissedQs,
      battleLog: newBattleLog
    }));
  };
  
  const handleCorrectAnswer = (finalInput: string) => {
    const now = Date.now();
    const start = gameState.startTime || now;
    const durationSec = Math.max((now - start) / 1000, 0.1);
    const charCount = finalInput.length;
    const charsPerSec = charCount / durationSec;
    const baseDamage = charCount * 10;
    const speedMultiplier = getSpeedMultiplier(charsPerSec);
    const damageMultiplier = getBattleDamageMultiplier(gameState.mode, gameState.inputMode);
    const perfectClearDamageFloor = getPerfectClearDamageFloor(
      gameState.bossStage,
      gameState.maxMonsterHp,
      gameState.maxQuestions
    );
    let finalDamage = Math.floor(baseDamage * speedMultiplier * damageMultiplier);
    if (gameState.missCount > 0) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
    } else if (perfectClearDamageFloor > 0) {
      finalDamage = Math.max(finalDamage, perfectClearDamageFloor);
    }
    const willDefeatMonster = gameState.monsterHp - finalDamage <= 0;
    if (!willDefeatMonster) {
      if (speedMultiplier >= 2.0 && gameState.missCount === 0) { soundEngine.playCritical(); } else { soundEngine.playAttack(); }
    }
    setMonsterShake(true);
    setTimeout(() => setMonsterShake(false), 400); 
    setLastSolvedQuestion(gameState.currentQuestion);
    advanceGame(finalDamage, charsPerSec, false, charCount);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const targetText = gameState.currentQuestion.text;
    if (val.length > gameState.userInput.length) soundEngine.playType();
    if (!gameState.startTime && val.length > 0) setGameState(prev => ({ ...prev, startTime: Date.now() }));
    
    if (gameState.mode === 'guide' && gameState.selectedLevel === 1) {
        if (targetText.startsWith(val)) {
            setGameState(prev => ({ ...prev, userInput: val, hintLength: 0 }));
            if (val === targetText) handleCorrectAnswer(val);
        } else {
            soundEngine.playMiss(); setShake(true); setTimeout(() => setShake(false), 300);
            setGameState(prev => ({ ...prev, userInput: "", combo: 0, missCount: prev.missCount + 1, hintLength: 0 })); 
        }
    } else {
        if (targetText.startsWith(val)) {
            setGameState(prev => ({ ...prev, userInput: val, hintLength: 0 }));
            if (val === targetText) handleCorrectAnswer(val);
        } else {
            soundEngine.playMiss(); setShake(true); setTimeout(() => setShake(false), 300);
            const shouldShowHint = gameState.mode === 'challenge';
            setGameState(prev => ({ ...prev, missCount: prev.missCount + 1, hintLength: shouldShowHint ? prev.hintLength + 1 : 0 })); 
        }
    }
  };

  useEffect(() => {
    if (gameState.screen === 'battle' && gameState.inputMode !== 'text-only' && gameState.monsterHp > 0) speakWithSettings(gameState.currentQuestion.text);
  }, [gameState.currentQuestion, gameState.screen, gameState.inputMode, gameState.monsterHp, speakWithSettings]);

  // --- Screens ---
  const selectedSpeechConfig = resolveSpeechConfig(speechVoices, speechVoiceMode);
  const supportedSpeechModes = getSupportedSpeechModes(speechVoices);
  const selectedSpeechLocale = normalizeVoiceLang(selectedSpeechConfig.lang);
  const currentScopedQuestions = useMemo(() => (
    QUESTIONS[gameState.selectedDifficulty]?.[gameState.selectedLevel] ?? []
  ), [gameState.selectedDifficulty, gameState.selectedLevel]);
  const currentQuestionExamples = useMemo(() => (
    new Map(
      currentScopedQuestions.map(question => {
        const questionKey = getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, question);
        return [questionKey, getQuestionExample(gameState.selectedDifficulty, gameState.selectedLevel, question)] as const;
      })
    )
  ), [currentScopedQuestions, gameState.selectedDifficulty, gameState.selectedLevel]);
  const speechDebugCandidates = speechVoices
    .filter(voice => matchesVoiceLocale(voice, selectedSpeechLocale as 'en-us' | 'en-gb'))
    .map(voice => ({
      voice,
      score: getVoiceMatchScore(voice, selectedSpeechConfig.mode),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const handleToggleSelectedQuestion = useCallback((question: Question) => {
    toggleSelectedQuestion(gameState.selectedDifficulty, gameState.selectedLevel, question);
  }, [gameState.selectedDifficulty, gameState.selectedLevel]);

  const handleUpdateManualLevel = useCallback((question: Question, level: LearningLevel) => {
    updateManualQuestionStatus(
      gameState.selectedDifficulty,
      gameState.selectedLevel,
      question,
      current => ({ ...current, manualOverrideLevel: current.manualOverrideLevel === level ? null : level })
    );
  }, [gameState.selectedDifficulty, gameState.selectedLevel, updateManualQuestionStatus]);

  const handleToggleExcludedQuestion = useCallback((question: Question) => {
    updateManualQuestionStatus(
      gameState.selectedDifficulty,
      gameState.selectedLevel,
      question,
      current => ({ ...current, excluded: !current.excluded })
    );
  }, [gameState.selectedDifficulty, gameState.selectedLevel, updateManualQuestionStatus]);

  const startAutoPlaySequence = (
    entries: Array<{
      label: string;
      text: string;
      lang: string;
      voice: SpeechSynthesisVoice | null;
      gapAfterSeconds: number;
      nowPlaying: AutoPlayNowPlaying;
    }>,
  ) => {
    if (entries.length === 0) {
      stopAutoPlay('再生できる項目がありません');
      return;
    }

    autoPlayRunIdRef.current += 1;
    const runId = autoPlayRunIdRef.current;
    clearAutoPlayTimeout();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAutoPlayNowPlaying(null);
    setIsAutoPlaying(true);

    const playAt = (index: number) => {
      if (autoPlayRunIdRef.current !== runId) return;

      if (index >= entries.length) {
        setIsAutoPlaying(false);
        setAutoPlayNowPlaying(null);
        setAutoPlayStatusText('再生が完了しました');
        return;
      }

      const entry = entries[index];
      setAutoPlayNowPlaying(entry.nowPlaying);
      setAutoPlayStatusText(`${index + 1}/${entries.length} ${entry.label}`);
      const playbackRate = Math.max(0.5, autoPlaySettings.playbackRatePercent / 100);
      const minGapSeconds = index < entries.length - 1
        ? entries[index + 1].label.startsWith('次の単語')
          ? MIN_AUTO_PLAY_QUESTION_GAP_SECONDS
          : MIN_AUTO_PLAY_ITEM_GAP_SECONDS
        : 0;
      const nextDelaySeconds = Math.max(minGapSeconds, entry.gapAfterSeconds / playbackRate);

      speakText(entry.text, {
        voice: entry.voice,
        lang: entry.lang,
        rate: entry.lang.startsWith('ja') ? 1 : autoPlaySettings.playbackRatePercent / 100,
        interrupt: false,
        onend: () => {
          if (autoPlayRunIdRef.current !== runId) return;
          autoPlayTimeoutRef.current = window.setTimeout(() => {
            autoPlayTimeoutRef.current = null;
            playAt(index + 1);
          }, nextDelaySeconds * 1000);
        },
        onerror: () => {
          if (autoPlayRunIdRef.current !== runId) return;
          autoPlayTimeoutRef.current = window.setTimeout(() => {
            autoPlayTimeoutRef.current = null;
            playAt(index + 1);
          }, nextDelaySeconds * 1000);
        },
      });
    };

    playAt(0);
  };

  if (gameState.screen === 'rank-list') {
      const allMonsterIds = Object.values(MONSTERS).flatMap(lvl => [...lvl.guide, ...lvl.challenge]).map(m => m.id);
      const uniqueDefeatedIds = new Set(gameState.defeatedMonsterIds.map(key => extractMonsterId(key)));
      const totalDefeated = [...uniqueDefeatedIds].filter(id => allMonsterIds.includes(id)).length;
      return (
        <ScreenContainer className="bg-slate-900">
            <div className="max-w-4xl w-full p-4 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
                    <h2 className="text-2xl font-bold text-yellow-400 flex items-center gap-2"><Medal /> 称号リスト (Rank List)</h2>
                </div>
                <Box title={`Current Rank & Progress (Total Defeated: ${totalDefeated})`} className="flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-y-auto pr-2 custom-scrollbar flex-1"><div className="grid gap-3">
                            {RANKS.map((rank, idx) => {
                                const isUnlocked = totalDefeated >= rank.threshold;
                                return (
                                    <div key={idx} className={`p-4 rounded-lg border-2 flex items-center justify-between transition-all ${isUnlocked ? 'bg-slate-800/80 border-yellow-500/50 shadow-lg' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-xl ${isUnlocked ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-500'}`}>{isUnlocked ? <Crown size={24} /> : <Lock size={24} />}</div>
                                            <div><h3 className={`text-xl font-bold ${isUnlocked ? rank.color : 'text-slate-500'}`}>{rank.title}</h3><p className="text-sm text-slate-400">必要撃破数: <span className="text-white font-mono">{rank.threshold}</span> 体</p></div>
                                        </div>
                                        {isUnlocked && <div className="text-yellow-400 font-bold text-sm bg-yellow-900/30 px-3 py-1 rounded-full border border-yellow-500/30">GET!</div>}
                                    </div>
                                );
                            })}
                        </div></div>
                </Box>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }`}</style>
        </ScreenContainer>
      );
  }

  if (gameState.screen === 'score-view') {
      return (
        <ScreenContainer className="bg-slate-900">
            <div className="max-w-4xl w-full p-4">
                <div className="flex justify-between items-center mb-6">
                    <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
                    <h2 className="text-2xl font-bold text-yellow-400 flex items-center gap-2"><Trophy /> Best Records</h2>
                </div>
                <div className="mb-6 flex flex-wrap justify-center gap-4">
                   {DIFFICULTIES.map(diff => (
                     <button
                       key={diff}
                       onClick={() => setScoreViewDiff(diff)}
                       className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${scoreViewDiff === diff ? DIFFICULTY_SCORE_TAB_ACTIVE_CLASSES[diff] : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                     >
                       {DIFFICULTY_LABELS[diff]}
                     </button>
                   ))}
                </div>
                <Box title={`${DIFFICULTY_LABELS[scoreViewDiff]} Records`} className="w-full">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead><tr className="border-b-2 border-slate-600 text-slate-400 text-sm uppercase"><th className="p-4">Level</th><th className="p-4 text-center text-blue-300">Training (Guide)</th><th className="p-4 text-center text-red-300">Battle (Challenge)</th></tr></thead>
                            <tbody className="divide-y divide-slate-700">
                                {getAvailableLevels(scoreViewDiff).map((lvl) => {
                                    const guideKey = `${scoreViewDiff}_${lvl}_guide`;
                                    const challengeKey = `${scoreViewDiff}_${lvl}_challenge`;
                                    return (<tr key={lvl} className="hover:bg-slate-700/50 transition-colors"><td className="p-4 font-bold text-xl">Level {lvl}</td><td className="p-4 text-center">{bestScores[guideKey] > 0 ? <span className="text-xl font-mono font-bold text-white">{bestScores[guideKey]}</span> : <span className="text-slate-600">-</span>}</td><td className="p-4 text-center">{bestScores[challengeKey] > 0 ? <span className="text-xl font-mono font-bold text-yellow-400">{bestScores[challengeKey]}</span> : <span className="text-slate-600">-</span>}</td></tr>);
                                })}
                            </tbody>
                        </table>
                    </div>
                </Box>
            </div>
        </ScreenContainer>
      );
  }

  if (gameState.screen === 'monster-book') {
    const monstersObj = MONSTERS[bookLevel];
    const visibleGuideMonsters = monstersObj.guide.slice(0, getGuideTargetCount(bookDifficulty, bookLevel));
    const visibleChallengeMonsterIndices = getBattleStageIndices(monstersObj.challenge, HARD_TARGET_COUNT, 'challenge', 'text-only');
    const visibleChallengeMonsters = visibleChallengeMonsterIndices.map(index => monstersObj.challenge[index]).filter(Boolean);
    const allMonsters = [...visibleGuideMonsters, ...visibleChallengeMonsters];
    const availableBookLevels = getAvailableLevels(bookDifficulty);
    const guideDefeatedCount = countDefeatedMonstersForBook(
      visibleGuideMonsters,
      gameState.defeatedMonsterIds,
      bookDifficulty,
      bookLevel,
      'guide'
    );
    const challengeDefeatedCount = countDefeatedMonstersForBook(
      visibleChallengeMonsters,
      gameState.defeatedMonsterIds,
      bookDifficulty,
      bookLevel,
      'challenge'
    );
    const isMonsterDefeatedInBook = (monsterId: string) => (
      isMonsterDefeatedForBook(gameState.defeatedMonsterIds, bookDifficulty, bookLevel, 'guide', monsterId)
      || isMonsterDefeatedForBook(gameState.defeatedMonsterIds, bookDifficulty, bookLevel, 'challenge', monsterId)
    );
    const getBookMonsterHp = (
      monster: Monster,
      monsterIndex: number,
      monsters: Monster[],
      mode: Extract<Mode, 'guide' | 'challenge'>,
      inputMode: InputMode
    ) => {
      const bossStage = getBossStage(mode, inputMode, monsterIndex, monsters.length);
      return getBattleHp(bookDifficulty, monster.baseHp, bossStage);
    };
    const totalDefeated = guideDefeatedCount + challengeDefeatedCount;
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-6xl w-full p-4">
           <div className="flex justify-between items-center mb-6">
              <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-4 py-2 rounded-full shadow-sm text-yellow-400"><Trophy size={20} /><span className="font-bold">撃破数: {totalDefeated} / {allMonsters.length}</span></div>
           </div>
           <Box title={`Monster Collection - ${DIFFICULTY_LABELS[bookDifficulty]} - Level ${bookLevel}`} className="w-full">
               <div className="mb-4 flex flex-wrap justify-center gap-3">{DIFFICULTIES.map((diff) => (<button key={diff} onClick={() => updateBookDifficulty(diff)} className={`px-5 py-2 rounded-full font-bold transition-all border-2 ${bookDifficulty === diff ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>{DIFFICULTY_LABELS[diff]}</button>))}</div>
               <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center text-xs text-slate-300">
                 モンスターの種類はレベルごとに共通です。ここでは <span className="font-bold text-blue-200">{DIFFICULTY_LABELS[bookDifficulty]}</span> の進行状況を表示しています。
               </div>
               <div className="flex justify-center gap-4 mb-8">{availableBookLevels.map((lvl) => (<button key={lvl} onClick={() => setBookLevel(lvl as Level)} className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${bookLevel === lvl ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg scale-105' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>レベル {lvl}</button>))}</div>
               <div className="mb-8">
                 <h3 className="text-blue-300 font-bold mb-4 flex items-center gap-2 text-xl"><Shield size={20} /> 練習エリア (Training Zone)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {visibleGuideMonsters.map((m, index, monsters) => {
                      const isDefeated = isMonsterDefeatedInBook(m.id);
                      const displayHp = getBookMonsterHp(m, index, monsters, 'guide', 'voice-text');
                      return (<div key={m.id} className={`relative p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all border-2 ${isDefeated ? 'bg-slate-700/50 border-slate-500' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>{isDefeated ? (<><div className="mb-2 scale-75"><MonsterAvatar type={m.type} color={m.color} size={100} visualStyle={getMonsterVisualStyle(m)} /></div><div className="font-bold text-sm text-blue-300 mb-1">{m.name}</div><div className="mb-1 rounded-full border border-cyan-500/30 bg-cyan-950/70 px-2 py-1 text-[11px] font-black text-cyan-200">HP {displayHp}</div><div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">{m.theme}</div><div className="absolute top-2 right-2 text-yellow-400"><Star size={16} fill="currentColor" /></div></>) : (<><div className="mb-2 scale-75 opacity-30 grayscale filter blur-[1px]"><MonsterAvatar type={m.type} color={m.color} size={100} visualStyle={getMonsterVisualStyle(m)} /></div><div className="font-bold text-sm text-slate-600 mb-1">???</div><div className="mb-1 rounded-full border border-cyan-500/30 bg-cyan-950/70 px-2 py-1 text-[11px] font-black text-cyan-200">HP {displayHp}</div><div className="absolute top-2 right-2 text-slate-700"><Lock size={16} /></div></>)}</div>);
                    })}
                 </div>
               </div>
               <div>
                 <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2 text-xl"><Skull size={20} /> 危険エリア (Danger Zone)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {visibleChallengeMonsters.map((m, index, monsters) => {
                      const isDefeated = isMonsterDefeatedInBook(m.id);
                      const displayHp = getBookMonsterHp(m, index, monsters, 'challenge', 'text-only');
                      return (<div key={m.id} className={`relative p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all border-2 ${isDefeated ? 'bg-red-900/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>{isDefeated ? (<><div className="mb-2 scale-90"><MonsterAvatar type={m.type} color={m.color} size={100} visualStyle={getMonsterVisualStyle(m)} /></div><div className="font-bold text-sm text-red-300 mb-1">{m.name}</div><div className="mb-1 rounded-full border border-red-500/30 bg-red-950/70 px-2 py-1 text-[11px] font-black text-red-100">HP {displayHp}</div><div className="text-xs text-red-200 bg-red-900/50 px-2 py-1 rounded-full">{m.theme}</div><div className="absolute top-2 right-2 text-yellow-400"><Star size={16} fill="currentColor" /></div></>) : (<><div className="mb-2 scale-90 opacity-30 grayscale filter blur-[1px]"><MonsterAvatar type={m.type} color={m.color} size={100} visualStyle={getMonsterVisualStyle(m)} /></div><div className="font-bold text-sm text-slate-600 mb-1">???</div><div className="mb-1 rounded-full border border-red-500/30 bg-red-950/70 px-2 py-1 text-[11px] font-black text-red-100">HP {displayHp}</div><div className="absolute top-2 right-2 text-slate-700"><Lock size={16} /></div></>)}</div>);
                    })}
                 </div>
               </div>
           </Box>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'question-list') {
    const questions = currentScopedQuestions;
    const selectionScopeKey = getReviewScopeKey(gameState.selectedDifficulty, gameState.selectedLevel);
    const learningSummary = getScopedLearningSummary(gameState.selectedDifficulty, gameState.selectedLevel);
    const weakQuestionTexts = new Set(weakQuestions.map(q => q.text));
    const playableQuestions = questions.filter(q => !isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, q));
    const excludedQuestions = questions.filter(q => isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, q));
    const weakQuestionsInView = questions.filter(q => weakQuestionTexts.has(q.text) && !isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, q));
    const selectedQuestionKeys = selectedQuestionKeysByScope[selectionScopeKey] ?? [];
    const selectedQuestionKeySet = new Set(selectedQuestionKeys);
    const selectedQuestionsInView = playableQuestions.filter(q => selectedQuestionKeySet.has(getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q)));
    const savedSelectionListsInScope = savedSelectionLists
      .filter(list => list.difficulty === gameState.selectedDifficulty && list.level === gameState.selectedLevel)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const weakCountInView = weakQuestionsInView.length;
    const manualReviewQuestions = playableQuestions.filter(q => getEffectiveLearningLevel(getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q)) < 3);
    const manualStudyCount = learningSummary.learningCount;
    const manualCautionCount = learningSummary.cautionCount;
    const sortedWeakQuestions = [...weakQuestionsInView].sort((a, b) => {
      const aStats = weakQuestionStats[a.text] ?? { missCount: 0, lastMissedAt: 0 };
      const bStats = weakQuestionStats[b.text] ?? { missCount: 0, lastMissedAt: 0 };
      if (weakListSort === 'frequent') {
        return (bStats.missCount - aStats.missCount) || (bStats.lastMissedAt - aStats.lastMissedAt) || a.text.localeCompare(b.text);
      }
      return (bStats.lastMissedAt - aStats.lastMissedAt) || (bStats.missCount - aStats.missCount) || a.text.localeCompare(b.text);
    });
    const visibleQuestions = questionListFilter === 'weak' ? sortedWeakQuestions : questions;
    const visiblePlayableQuestions = visibleQuestions.filter(q => !isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, q));
    const recentWeakSamples = [...weakQuestionsInView]
      .sort((a, b) => (weakQuestionStats[b.text]?.lastMissedAt ?? 0) - (weakQuestionStats[a.text]?.lastMissedAt ?? 0))
      .slice(0, 3);
    const repeatedWeakSamples = [...weakQuestionsInView]
      .filter(q => (weakQuestionStats[q.text]?.missCount ?? 0) >= 2)
      .sort((a, b) => (weakQuestionStats[b.text]?.missCount ?? 0) - (weakQuestionStats[a.text]?.missCount ?? 0))
      .slice(0, 3);
    const topMissedQuestions = [...weakQuestionsInView]
      .sort((a, b) => ((weakQuestionStats[b.text]?.missCount ?? 0) - (weakQuestionStats[a.text]?.missCount ?? 0)) || ((weakQuestionStats[b.text]?.lastMissedAt ?? 0) - (weakQuestionStats[a.text]?.lastMissedAt ?? 0)))
      .slice(0, 10);
    const reviewTargetQuestions = questionListFilter === 'weak' ? visibleQuestions : weakQuestionsInView;
    const autoPlayTargetQuestions = autoPlaySettings.source === 'all'
      ? visiblePlayableQuestions
      : autoPlaySettings.source === 'weak'
        ? weakQuestionsInView
        : selectedQuestionsInView;
    const autoPlayJapaneseVoice = getJapaneseSpeechVoice();
    const autoPlayPlayableQuestionCount = autoPlayTargetQuestions.filter(q => {
      if (autoPlaySettings.playText || autoPlaySettings.playTranslation) return true;
      const questionKey = getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q);
      return !!currentQuestionExamples.get(questionKey);
    }).length;
    const learningLevelSelectionOptions: Array<{ level: LearningLevel; label: string; questions: Question[]; className: string }> = [
      {
        level: 1,
        label: '学習中',
        questions: visiblePlayableQuestions.filter(q => getEffectiveLearningLevel(getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q)) === 1),
        className: 'border-sky-500/40 text-sky-200 hover:bg-sky-900/20',
      },
      {
        level: 2,
        label: 'もう少し',
        questions: visiblePlayableQuestions.filter(q => getEffectiveLearningLevel(getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q)) === 2),
        className: 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/20',
      },
      {
        level: 3,
        label: '覚えた',
        questions: visiblePlayableQuestions.filter(q => getEffectiveLearningLevel(getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q)) === 3),
        className: 'border-violet-500/40 text-violet-200 hover:bg-violet-900/20',
      },
    ];
    const manualReviewSamples = manualReviewQuestions.slice(0, 5).map(q => q.text).join(' / ');

    const startReviewFromList = (mode: Mode, inputMode: InputMode) => {
      if (reviewTargetQuestions.length === 0) return;
      startGame(gameState.selectedDifficulty, gameState.selectedLevel, mode, inputMode, reviewTargetQuestions);
    };

    const startManualReview = (mode: Mode, inputMode: InputMode) => {
      if (manualReviewQuestions.length === 0) return;
      startGame(gameState.selectedDifficulty, gameState.selectedLevel, mode, inputMode, manualReviewQuestions);
    };

    const startTopMissReview = (mode: Mode, inputMode: InputMode) => {
      if (topMissedQuestions.length === 0) return;
      startGame(gameState.selectedDifficulty, gameState.selectedLevel, mode, inputMode, topMissedQuestions);
    };

    const updateAutoPlaySetting = <K extends keyof AutoPlaySettings>(key: K, value: AutoPlaySettings[K]) => {
      setAutoPlaySettings(prev => ({
        ...prev,
        [key]: value,
      }));
    };

    const handleStartAutoPlay = () => {
      if (!autoPlaySettings.playText && !autoPlaySettings.playTranslation && !autoPlaySettings.playExample) {
        setAutoPlayStatusText('再生対象を1つ以上選んでください');
        return;
      }

      const entries = autoPlayTargetQuestions.flatMap((question, questionIndex) => {
        const questionKey = getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, question);
        const example = currentQuestionExamples.get(questionKey);
        const nextEntries: Array<{
          label: string;
          text: string;
          lang: string;
          voice: SpeechSynthesisVoice | null;
          gapAfterSeconds: number;
          nowPlaying: AutoPlayNowPlaying;
        }> = [];
        const pushEntry = (entry: {
          label: string;
          text: string;
          lang: string;
          voice: SpeechSynthesisVoice | null;
          nowPlaying: AutoPlayNowPlaying;
        }) => {
          nextEntries.push({
            ...entry,
            gapAfterSeconds: autoPlaySettings.itemGapSeconds,
          });
        };

        if (autoPlaySettings.playText) {
          pushEntry({
            label: `単語: ${question.text}`,
            text: question.text,
            lang: selectedSpeechConfig.lang,
            voice: selectedSpeechConfig.voice,
            nowPlaying: {
              questionText: question.text,
              translation: question.translation,
              basicMeaning: question.basicMeaning,
              example: example ?? null,
              activePart: 'text',
            },
          });
        }

        if (autoPlaySettings.playTranslation) {
          pushEntry({
            label: `和訳: ${question.translation}`,
            text: question.translation,
            lang: autoPlayJapaneseVoice?.lang || 'ja-JP',
            voice: autoPlayJapaneseVoice,
            nowPlaying: {
              questionText: question.text,
              translation: question.translation,
              basicMeaning: question.basicMeaning,
              example: example ?? null,
              activePart: 'translation',
            },
          });
        }

        if (autoPlaySettings.playExample && example) {
          pushEntry({
            label: `例文: ${question.text}`,
            text: example,
            lang: selectedSpeechConfig.lang,
            voice: selectedSpeechConfig.voice,
            nowPlaying: {
              questionText: question.text,
              translation: question.translation,
              basicMeaning: question.basicMeaning,
              example,
              activePart: 'example',
            },
          });
        }

        if (nextEntries.length > 0) {
          nextEntries[nextEntries.length - 1].gapAfterSeconds = questionIndex < autoPlayTargetQuestions.length - 1
            ? autoPlaySettings.questionGapSeconds
            : 0;
        }

        return nextEntries;
      });

      startAutoPlaySequence(entries);
    };

    const questionRows = visibleQuestions.map((q, idx) => {
      const questionKey = getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q);
      return (
        <QuestionListRow
          key={questionKey}
          idx={idx}
          displayIndex={idx + 1}
          question={q}
          questionKey={questionKey}
          isWeakQuestion={weakQuestionTexts.has(q.text)}
          stats={weakQuestionStats[q.text]}
          manualStatus={getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q)}
          isSelectedForAutoPlay={selectedQuestionKeySet.has(questionKey)}
          example={currentQuestionExamples.get(questionKey)}
          onSpeak={speakWithSettings}
          onToggleSelected={handleToggleSelectedQuestion}
          onUpdateManualLevel={handleUpdateManualLevel}
          onToggleExcluded={handleToggleExcludedQuestion}
        />
      );
    });

    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-4xl w-full p-4 h-full flex flex-col">
           <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
              <h2 className="text-2xl font-bold text-blue-300 flex items-center gap-2"><ClipboardList /> 問題リスト (Word List)</h2>
           </div>
           <div className="flex flex-col md:flex-row gap-4 mb-6 flex-shrink-0">
               <div className="flex flex-wrap bg-slate-800 p-1 rounded-lg">{DIFFICULTIES.map(d => (<button key={d} onClick={() => updateSelectedDifficulty(d)} className={`px-4 py-2 rounded-md font-bold transition-colors ${gameState.selectedDifficulty === d ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{DIFFICULTY_LABELS[d]}</button>))}</div>
               <div className="flex bg-slate-800 p-1 rounded-lg">{getAvailableLevels(gameState.selectedDifficulty).map(l => (<button key={l} onClick={() => setGameState(prev => ({ ...prev, selectedLevel: l }))} className={`px-4 py-2 rounded-md font-bold transition-colors ${gameState.selectedLevel === l ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Level {l}</button>))}</div>
           </div>
           <div className="mb-4 flex-shrink-0 rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_58%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(12,18,32,0.92))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
             <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
               <div>
                 <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Word Progress</p>
                 <h3 className="mt-1 text-xl font-black text-white">{'\u5b66\u7fd2\u306e\u9032\u307f\u5177\u5408'}</h3>
               </div>
               <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-900/30 px-4 py-2 text-sm font-bold text-orange-200">
                 <AlertCircle size={16} className="text-orange-300" />
                 {'\u82e6\u624b'} {weakCountInView}{'\u4ef6'}
               </div>
             </div>
             <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
               <div className="rounded-2xl border border-sky-400/30 bg-sky-500/12 p-4 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
                 <div className="flex items-center gap-2 text-sky-200">
                   <BookOpen size={18} className="text-sky-300" />
                   <p className="text-[12px] font-black tracking-[0.16em]">{'\u5b66\u7fd2\u4e2d'}</p>
                 </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.learningCount}</p>
               </div>
               <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/12 p-4 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
                 <div className="flex items-center gap-2 text-emerald-200">
                   <CheckCircle2 size={18} className="text-emerald-300" />
                   <p className="text-[12px] font-black tracking-[0.16em]">{'\u3082\u3046\u5c11\u3057'}</p>
                 </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.cautionCount}</p>
               </div>
               <div className="rounded-2xl border border-violet-400/30 bg-violet-500/12 p-4 shadow-[0_0_28px_rgba(167,139,250,0.16)]">
                 <div className="flex items-center gap-2 text-violet-200">
                   <Crown size={18} className="text-violet-300" />
                   <p className="text-[12px] font-black tracking-[0.16em]">{'\u899a\u3048\u305f'}</p>
                 </div>
                <p className="mt-3 bg-gradient-to-r from-violet-100 via-white to-violet-200 bg-clip-text text-4xl font-black leading-none text-transparent">{learningSummary.masteredCount}</p>
               </div>
               <div className="rounded-2xl border border-slate-500/40 bg-slate-900/70 p-4 text-slate-300">
                 <div className="flex items-center gap-2 text-slate-300">
                   <Shield size={18} className="text-slate-400" />
                   <p className="text-[12px] font-black tracking-[0.16em]">{'\u9664\u5916\u4e2d'}</p>
                 </div>
                <p className="mt-3 text-3xl font-black leading-none text-white">{learningSummary.excludedCount}</p>
               </div>
             </div>
           </div>
           <div className="mb-4 hidden flex-shrink-0">
             <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-900/30 px-4 py-2 text-sm font-bold text-orange-200">
               <AlertCircle size={16} className="text-orange-300" />
               この一覧の苦手語: {weakCountInView}件
             </div>
             <div className="mt-3 flex flex-wrap gap-3">
               <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/20 px-4 py-2 text-sm font-bold text-sky-200">
                 <BookOpen size={16} className="text-sky-300" />
                 学習中 {manualStudyCount}件
               </div>
               <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-sm font-bold text-emerald-200">
                 <CheckCircle2 size={16} className="text-emerald-300" />
                 もう少し {manualCautionCount}件
               </div>
               <div className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 bg-slate-800/80 px-4 py-2 text-sm font-bold text-slate-300">
                 <Shield size={16} className="text-slate-400" />
                 除外 {excludedQuestions.length}件
               </div>
             </div>
           </div>
            <div className="mb-4 flex-shrink-0">
              <div className="flex flex-wrap gap-3">
                <div className="flex bg-slate-800 p-1 rounded-lg self-start">
                <button onClick={() => setQuestionListFilter('all')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${questionListFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>すべて</button>
                <button onClick={() => setQuestionListFilter('weak')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${questionListFilter === 'weak' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>苦手だけ</button>
                </div>
                {questionListFilter === 'weak' && (
                  <div className="flex bg-slate-800 p-1 rounded-lg self-start">
                    <button onClick={() => setWeakListSort('recent')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${weakListSort === 'recent' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>最近ミス順</button>
                    <button onClick={() => setWeakListSort('frequent')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${weakListSort === 'frequent' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>回数順</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mb-4 flex-shrink-0">
              <button
                onClick={() => setWordListToolsOpen(prev => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-left transition-colors hover:bg-cyan-900/25"
              >
                <div>
                  <p className="text-sm font-bold text-cyan-200">選択・自動再生ツール</p>
                  <p className="mt-1 text-xs text-slate-400">任意選択、25語まとめ選択、自動再生を必要なときだけ開けます。</p>
                </div>
                <span className="text-sm font-bold text-cyan-100">{wordListToolsOpen ? '閉じる ▲' : '開く ▼'}</span>
              </button>
            </div>
            {wordListToolsOpen && (
            <>
            <div className="mb-4 flex-shrink-0 rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
              <div className="mb-3 hidden flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-bold text-sky-200">自分で決めた学習メモから復習する</p>
                  <p className="mt-1 text-xs text-slate-400">学習中と「もう少し」にした単語をまとめて復習できます。苦手判定はこれまで通りゲーム側でも続き、除外した単語だけここから外れます。</p>
                </div>
                <div className="text-xs text-slate-300">
                  {manualReviewQuestions.length > 0 ? manualReviewSamples : 'まだありません'}
                </div>
              </div>
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-bold text-sky-200">{'\u624b\u52d5\u8a2d\u5b9a\u306e\u5358\u8a9e\u3092\u307e\u3068\u3081\u3066\u5fa9\u7fd2'}</p>
                  <p className="mt-1 text-xs text-slate-400">{'\u300c\u5b66\u7fd2\u4e2d\u300d\u3068\u300c\u3082\u3046\u5c11\u3057\u300d\u306b\u3057\u305f\u5358\u8a9e\u3092\u307e\u3068\u3081\u3066\u5fa9\u7fd2\u3067\u304d\u307e\u3059\u3002\u82e6\u624b\u5224\u5b9a\u306f\u3053\u308c\u307e\u3067\u901a\u308a\u30b2\u30fc\u30e0\u5074\u3067\u3082\u7d9a\u304d\u3001\u9664\u5916\u3057\u305f\u5358\u8a9e\u3060\u3051\u3053\u3053\u304b\u3089\u5916\u308c\u307e\u3059\u3002'}</p>
                </div>
                <div className="text-xs text-slate-300">
                  {manualReviewQuestions.length > 0 ? manualReviewSamples : '\u307e\u3060\u3042\u308a\u307e\u305b\u3093'}
                </div>
              </div>
              <div className="hidden grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <GameButton onClick={() => startManualReview('guide', 'voice-text')} size="sm" variant="outline" className="border-blue-500/40 text-blue-200 hover:bg-blue-900/20" disabled={manualReviewQuestions.length === 0}>
                  <Brain size={16} className="mr-1" /> Basic Training復習
                </GameButton>
                <GameButton onClick={() => startManualReview('challenge', 'voice-text')} size="sm" variant="outline" className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/20" disabled={manualReviewQuestions.length === 0}>
                  <Volume2 size={16} className="mr-1" /> Listening Training復習
                </GameButton>
                <GameButton onClick={() => startManualReview('challenge', 'voice-only')} size="sm" variant="outline" className="border-orange-500/40 text-orange-200 hover:bg-orange-900/20" disabled={manualReviewQuestions.length === 0}>
                  <Sword size={16} className="mr-1" /> Listening Battle復習
                </GameButton>
                <GameButton onClick={() => startManualReview('challenge', 'text-only')} size="sm" className="bg-sky-600 border-sky-400 text-white hover:bg-sky-500" disabled={manualReviewQuestions.length === 0}>
                  <Flame size={16} className="mr-1" /> Translation Battle復習
                </GameButton>
              </div>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 flex-shrink-0">
              <GameButton onClick={() => startManualReview('guide', 'voice-text')} size="sm" variant="outline" className="border-blue-500/40 text-blue-200 hover:bg-blue-900/20" disabled={manualReviewQuestions.length === 0}>
                <Brain size={16} className="mr-1" /> {'Basic Training\u5fa9\u7fd2'}
              </GameButton>
              <GameButton onClick={() => startManualReview('challenge', 'voice-text')} size="sm" variant="outline" className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/20" disabled={manualReviewQuestions.length === 0}>
                <Volume2 size={16} className="mr-1" /> {'Listening Training\u5fa9\u7fd2'}
              </GameButton>
              <GameButton onClick={() => startManualReview('challenge', 'voice-only')} size="sm" variant="outline" className="border-orange-500/40 text-orange-200 hover:bg-orange-900/20" disabled={manualReviewQuestions.length === 0}>
                <Sword size={16} className="mr-1" /> {'Listening Battle\u5fa9\u7fd2'}
              </GameButton>
              <GameButton onClick={() => startManualReview('challenge', 'text-only')} size="sm" className="bg-sky-600 border-sky-400 text-white hover:bg-sky-500" disabled={manualReviewQuestions.length === 0}>
                <Flame size={16} className="mr-1" /> {'Translation Battle\u5fa9\u7fd2'}
              </GameButton>
            </div>
            <div className="mb-4 flex-shrink-0 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Auto Play</p>
                  <h3 className="mt-1 text-xl font-black text-white">単語一覧の連続再生</h3>
                  <p className="mt-2 text-xs text-slate-300">苦手語だけ、または自分で選んだ単語だけを連続再生できます。和訳は日本語音声、用語と例文は英語音声で読み上げます。</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                  <div>対象数: <span className="font-black text-white">{autoPlayTargetQuestions.length}</span></div>
                  <div>再生可能: <span className="font-black text-cyan-200">{autoPlayPlayableQuestionCount}</span></div>
                  <div className="mt-1 text-xs text-slate-400">{autoPlayStatusText}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <p className="text-sm font-bold text-cyan-200">1. 再生元</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateAutoPlaySetting('source', 'all')}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${autoPlaySettings.source === 'all' ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                    >
                      このレベル全部 ({visiblePlayableQuestions.length})
                    </button>
                    <button
                      onClick={() => updateAutoPlaySetting('source', 'weak')}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${autoPlaySettings.source === 'weak' ? 'border-orange-300 bg-orange-500/20 text-orange-100' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                    >
                      苦手語だけ ({weakQuestionsInView.length})
                    </button>
                    <button
                      onClick={() => updateAutoPlaySetting('source', 'selected')}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${autoPlaySettings.source === 'selected' ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                    >
                      自分で選んだ語 ({selectedQuestionsInView.length})
                    </button>
                  </div>
                  <p className="mt-4 text-sm font-bold text-cyan-200">2. 再生する内容</p>
                  {autoPlaySettings.source !== 'all' && autoPlayTargetQuestions.length === 0 && visiblePlayableQuestions.length > 0 && (
                    <p className="mt-3 text-xs text-amber-200">
                      このレベルでは、まだ対象語がありません。「このレベル全部」を選ぶと自動再生できます。
                    </p>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      { key: 'playText', label: '用語', checked: autoPlaySettings.playText },
                      { key: 'playTranslation', label: '和訳', checked: autoPlaySettings.playTranslation },
                      { key: 'playExample', label: '例文', checked: autoPlaySettings.playExample },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => updateAutoPlaySetting(item.key as keyof AutoPlaySettings, e.target.checked as never)}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-400"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-bold text-cyan-200">3. 間隔</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">用語・和訳・例文の間隔</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={autoPlaySettings.itemGapSeconds}
                        onChange={(e) => updateAutoPlaySetting('itemGapSeconds', Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">次の用語までの間隔</span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        step={0.5}
                        value={autoPlaySettings.questionGapSeconds}
                        onChange={(e) => updateAutoPlaySetting('questionGapSeconds', Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-cyan-200">英語の再生速度</span>
                      <span className="text-sm font-bold text-white">{autoPlaySettings.playbackRatePercent / 100}x</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {AUTO_PLAY_RATE_OPTIONS.map(rateOption => (
                        <button
                          key={rateOption}
                          onClick={() => updateAutoPlaySetting('playbackRatePercent', rateOption)}
                          className={`rounded-lg border px-2 py-2 text-sm font-bold transition-colors ${autoPlaySettings.playbackRatePercent === rateOption ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                        >
                          {rateOption / 100}x
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-cyan-200">現在再生中</span>
                      <span className="text-xs font-bold text-slate-400">{isAutoPlaying ? '再生中' : '待機中'}</span>
                    </div>
                    {autoPlayNowPlaying ? (
                      <div className="mt-3 space-y-2">
                        <div className={`rounded-lg border px-3 py-2 text-sm transition-colors ${autoPlayNowPlaying.activePart === 'text' ? 'border-cyan-300 bg-cyan-500/15 text-cyan-50' : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">用語</div>
                          <div className="mt-1 break-words font-semibold">{autoPlayNowPlaying.questionText}</div>
                        </div>
                        <div className={`rounded-lg border px-3 py-2 text-sm transition-colors ${autoPlayNowPlaying.activePart === 'translation' ? 'border-emerald-300 bg-emerald-500/15 text-emerald-50' : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">和訳</div>
                          <div className="mt-1 break-words font-semibold">{autoPlayNowPlaying.translation}</div>
                          {autoPlayNowPlaying.basicMeaning && (
                            <div className="mt-1 break-words text-[11px] font-medium text-slate-400">
                              Basic: {autoPlayNowPlaying.basicMeaning}
                            </div>
                          )}
                        </div>
                        {autoPlayNowPlaying.example && (
                          <div className={`rounded-lg border px-3 py-2 text-sm transition-colors ${autoPlayNowPlaying.activePart === 'example' ? 'border-violet-300 bg-violet-500/15 text-violet-50' : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">例文</div>
                            <div className="mt-1 break-words leading-relaxed">{autoPlayNowPlaying.example}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
                        再生を開始すると、ここに用語・和訳・例文を表示します。
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <GameButton
                      onClick={handleStartAutoPlay}
                      size="sm"
                      className="bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500"
                      disabled={isAutoPlaying || autoPlayPlayableQuestionCount === 0}
                    >
                      <Volume2 size={16} className="mr-1" /> 連続再生を開始
                    </GameButton>
                    <GameButton
                      onClick={() => stopAutoPlay()}
                      size="sm"
                      variant="outline"
                      className="border-slate-500 text-slate-200 hover:bg-slate-800"
                      disabled={!isAutoPlaying}
                    >
                      <Square size={16} className="mr-1" /> 停止
                    </GameButton>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-cyan-200">任意選択リスト</p>
                      <p className="mt-1 text-xs text-slate-400">この難易度・レベルで選んだ単語は自動保存されます。さらに名前を付けて複数保存できます。</p>
                    </div>
                    <div className="text-xs text-slate-400">現在の選択: {selectedQuestionsInView.length}語</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GameButton
                      onClick={() => updateSelectedQuestionKeysForScope(gameState.selectedDifficulty, gameState.selectedLevel, weakQuestionsInView.map(q => getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q)))}
                      size="sm"
                      variant="outline"
                      className="border-orange-500/40 text-orange-200 hover:bg-orange-900/20"
                    >
                      苦手語を全部選択
                    </GameButton>
                    <GameButton
                      onClick={() => updateSelectedQuestionKeysForScope(gameState.selectedDifficulty, gameState.selectedLevel, visiblePlayableQuestions.map(q => getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q)))}
                      size="sm"
                      variant="outline"
                      className="border-blue-500/40 text-blue-200 hover:bg-blue-900/20"
                    >
                      表示中を全部選択
                    </GameButton>
                    <GameButton
                      onClick={() => updateSelectedQuestionKeysForScope(gameState.selectedDifficulty, gameState.selectedLevel, [])}
                      size="sm"
                      variant="outline"
                      className="border-slate-500 text-slate-200 hover:bg-slate-800"
                    >
                      選択解除
                    </GameButton>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {learningLevelSelectionOptions.map(option => (
                      <GameButton
                        key={option.level}
                        onClick={() => updateSelectedQuestionKeysForScope(
                          gameState.selectedDifficulty,
                          gameState.selectedLevel,
                          option.questions.map(q => getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q)),
                        )}
                        size="sm"
                        variant="outline"
                        className={option.className}
                      >
                        {option.label}を選択 ({option.questions.length})
                      </GameButton>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <input
                      value={selectionListName}
                      onChange={(e) => setSelectionListName(e.target.value)}
                      placeholder="保存名を入力"
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                    <GameButton
                      onClick={() => saveCurrentSelectionList(gameState.selectedDifficulty, gameState.selectedLevel, selectedQuestionKeys, selectionListName)}
                      size="sm"
                      className="bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500"
                      disabled={selectedQuestionKeys.length === 0 || selectionListName.trim().length === 0}
                    >
                      保存する
                    </GameButton>
                  </div>
                  <div className="mt-4 space-y-2">
                    {savedSelectionListsInScope.length > 0 ? savedSelectionListsInScope.map(list => (
                      <div key={list.id} className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-bold text-white">{list.name}</div>
                          <div className="mt-1 text-xs text-slate-400">{list.questionKeys.length}語 / 更新 {new Date(list.updatedAt).toLocaleString('ja-JP')}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <GameButton onClick={() => applySavedSelectionList(list)} size="sm" variant="outline" className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/20">
                            読み込む
                          </GameButton>
                          <GameButton onClick={() => deleteSavedSelectionList(list.id)} size="sm" variant="outline" className="border-red-500/40 text-red-200 hover:bg-red-900/20">
                            削除
                          </GameButton>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">まだ保存済みリストはありません。</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
            {questionListFilter === 'weak' && (
              <div className="mb-4 flex-shrink-0">
                <button
                  onClick={() => setWeakReviewPanelOpen(prev => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-orange-500/30 bg-orange-950/20 px-4 py-3 text-left transition-colors hover:bg-orange-900/25"
                >
                  <div>
                    <p className="text-sm font-bold text-orange-200">苦手語レビュー詳細</p>
                    <p className="mt-1 text-xs text-slate-400">苦手語の統計や復習ボタンは必要なときだけ開けます。</p>
                  </div>
                  <span className="text-sm font-bold text-orange-100">{weakReviewPanelOpen ? '閉じる ▲' : '開く ▼'}</span>
                </button>
              </div>
            )}
            {questionListFilter === 'weak' && weakReviewPanelOpen && (
              <div className="mb-4 grid gap-4 md:grid-cols-3 flex-shrink-0">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Recent Mistakes</p>
                  <p className="mt-2 text-2xl font-black text-white">{recentWeakSamples.length}</p>
                  <p className="mt-2 text-xs text-slate-300">{recentWeakSamples.length > 0 ? recentWeakSamples.map(q => q.text).join(' / ') : 'まだありません'}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Repeated Mistakes</p>
                  <p className="mt-2 text-2xl font-black text-white">{weakQuestionsInView.filter(q => (weakQuestionStats[q.text]?.missCount ?? 0) >= 2).length}</p>
                  <p className="mt-2 text-xs text-slate-300">{repeatedWeakSamples.length > 0 ? repeatedWeakSamples.map(q => `${q.text} x${weakQuestionStats[q.text]?.missCount ?? 0}`).join(' / ') : 'まだありません'}</p>
                </div>
                <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Need Review</p>
                  <p className="mt-2 text-2xl font-black text-white">{weakQuestionsInView.length}</p>
                  <p className="mt-2 text-xs text-slate-300">まだ克服できていない苦手語です。</p>
                </div>
              </div>
            )}
            {questionListFilter === 'weak' && weakReviewPanelOpen && (
              <div className="mb-4 flex-shrink-0 rounded-xl border border-orange-500/30 bg-orange-950/20 p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold text-orange-200">表示中の苦手語を復習する</p>
                  <p className="mt-1 text-xs text-slate-400">一覧を見てから、自分に合ったモードでそのまま復習できます。</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <GameButton onClick={() => startReviewFromList('guide', 'voice-text')} size="sm" variant="outline" className="border-blue-500/40 text-blue-200 hover:bg-blue-900/20" disabled={reviewTargetQuestions.length === 0}>
                    <Brain size={16} className="mr-1" /> Basic Training復習
                  </GameButton>
                  <GameButton onClick={() => startReviewFromList('challenge', 'voice-text')} size="sm" variant="outline" className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/20" disabled={reviewTargetQuestions.length === 0}>
                    <Volume2 size={16} className="mr-1" /> Listening Training復習
                  </GameButton>
                  <GameButton onClick={() => startReviewFromList('challenge', 'voice-only')} size="sm" variant="outline" className="border-orange-500/40 text-orange-200 hover:bg-orange-900/20" disabled={reviewTargetQuestions.length === 0}>
                    <Sword size={16} className="mr-1" /> Listening Battle復習
                  </GameButton>
                  <GameButton onClick={() => startReviewFromList('challenge', 'text-only')} size="sm" className="bg-orange-600 border-orange-400 text-white hover:bg-orange-500" disabled={reviewTargetQuestions.length === 0}>
                    <Flame size={16} className="mr-1" /> Translation Battle復習
                  </GameButton>
                </div>
              </div>
            )}
            {questionListFilter === 'weak' && weakReviewPanelOpen && (
              <div className="mb-4 flex-shrink-0 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold text-amber-200">特に間違いが多い問題から復習する</p>
                  <p className="mt-1 text-xs text-slate-400">ミス回数が多い順の上位問題を優先して、集中的に復習できます。</p>
                </div>
                <div className="mb-3 text-xs text-slate-300">
                  {topMissedQuestions.length > 0
                    ? topMissedQuestions.slice(0, 5).map(q => `${q.text} x${weakQuestionStats[q.text]?.missCount ?? 0}`).join(' / ')
                    : 'まだ対象がありません'}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <GameButton onClick={() => startTopMissReview('guide', 'voice-text')} size="sm" variant="outline" className="border-blue-500/40 text-blue-200 hover:bg-blue-900/20" disabled={topMissedQuestions.length === 0}>
                    <Brain size={16} className="mr-1" /> Basic上位復習
                  </GameButton>
                  <GameButton onClick={() => startTopMissReview('challenge', 'voice-text')} size="sm" variant="outline" className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/20" disabled={topMissedQuestions.length === 0}>
                    <Volume2 size={16} className="mr-1" /> Listening上位復習
                  </GameButton>
                  <GameButton onClick={() => startTopMissReview('challenge', 'voice-only')} size="sm" variant="outline" className="border-orange-500/40 text-orange-200 hover:bg-orange-900/20" disabled={topMissedQuestions.length === 0}>
                    <Sword size={16} className="mr-1" /> 音声上位復習
                  </GameButton>
                  <GameButton onClick={() => startTopMissReview('challenge', 'text-only')} size="sm" className="bg-amber-600 border-amber-400 text-white hover:bg-amber-500" disabled={topMissedQuestions.length === 0}>
                    <Flame size={16} className="mr-1" /> 和訳上位復習
                  </GameButton>
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0">
               <Box className="h-full flex flex-col" title={`${DIFFICULTY_LABELS[gameState.selectedDifficulty]} - Level ${gameState.selectedLevel} (${questions.length} words)`}>
                   <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">{visibleQuestions.length === 0 ? (
                     <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/40 px-6 text-center">
                       <AlertCircle size={28} className="mb-3 text-slate-500" />
                       <p className="text-lg font-bold text-slate-200">この一覧に苦手語はまだありません</p>
                       <p className="mt-2 text-sm text-slate-400">通常の一覧に戻して、全問題を確認できます。</p>
                       <GameButton onClick={() => setQuestionListFilter('all')} variant="outline" size="sm" className="mt-4">すべて表示に戻す</GameButton>
                     </div>
                   ) : <div className="grid gap-2 pb-4">{questionRows /* visibleQuestions.map((q, idx) => {
                     const isWeakQuestion = weakQuestionTexts.has(q.text);
                     const stats = weakQuestionStats[q.text];
                     const manualStatus = getManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q);
                     const questionKey = getQuestionStatusKey(gameState.selectedDifficulty, gameState.selectedLevel, q);
                     const isSelectedForAutoPlay = selectedQuestionKeySet.has(questionKey);
                     const learningLabel = manualStatus.learningLevel === 1 ? '学習中' : manualStatus.learningLevel === 2 ? 'もう少し' : '覚えた';
                     const autoLabel = manualStatus.battleLevel === 1 ? '学習中' : manualStatus.battleLevel === 2 ? 'もう少し' : '覚えた';
                     const isManualOverrideActive = manualStatus.manualOverrideLevel !== null;
                     const example = currentQuestionExamples.get(questionKey);
                     return (
                       <div key={`${q.text}-${idx}`} className={`p-3 rounded-lg border transition-colors group ${manualStatus.excluded ? 'bg-slate-950/80 border-slate-600 opacity-85' : isWeakQuestion ? 'bg-orange-950/40 border-orange-500/40 hover:border-orange-400/70' : 'bg-slate-900/50 border-slate-700 hover:border-blue-500/50'}`}>
                         <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                           <div className="flex items-start gap-4 min-w-0">
                             <label className="mt-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-950/40 text-cyan-100 transition-colors hover:bg-cyan-900/40">
                               <input
                                 type="checkbox"
                                 checked={isSelectedForAutoPlay}
                                 onChange={() => toggleSelectedQuestion(gameState.selectedDifficulty, gameState.selectedLevel, q)}
                                 className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-400"
                               />
                             </label>
                             <button onClick={() => speakWithSettings(q.text)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white transition-colors flex-shrink-0"><Volume2 size={16} /></button>
                             <div className="min-w-0">
                               <div className="flex flex-wrap items-center gap-3">
                               <span className="text-lg md:text-xl font-mono text-blue-100 font-bold break-all">{q.text}</span>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${manualStatus.learningLevel === 1 ? 'border border-sky-400/35 bg-sky-500/10 text-sky-100' : manualStatus.learningLevel === 2 ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border border-violet-400/35 bg-violet-500/10 text-violet-100'}`}>
                                 {learningLabel}
                               </span>
                                {isSelectedForAutoPlay && <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-100">選択中</span>}
                                {manualStatus.manualOverrideLevel !== null && <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-fuchsia-200">{'\u624b\u52d5\u512a\u5148'}</span>}
                                {manualStatus.excluded && <span className="rounded-full border border-slate-400/40 bg-slate-700/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-200">{'\u9664\u5916\u4e2d'}</span>}
                               {isWeakQuestion && <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">Weak</span>}
                               {isWeakQuestion && stats && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">Miss x{stats.missCount}</span>}
                               {!isWeakQuestion && stats && <span className="rounded-full border border-slate-500/30 bg-slate-700/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">Past Miss x{stats.missCount}</span>}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                 <span className={`rounded-2xl border px-4 py-2 text-xl font-black leading-none tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:text-2xl ${isManualOverrideActive ? 'border-slate-700 bg-slate-900/60 text-slate-300' : manualStatus.learningLevel === 1 ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : manualStatus.learningLevel === 2 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-violet-400/30 bg-violet-500/10 text-violet-100'}`}>
                                  {learningLabel}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${isManualOverrideActive ? 'border-slate-700 bg-slate-900/70 text-slate-400' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'}`}>
                                  {'\u81ea\u52d5'}: {autoLabel}
                                </span>
                              </div>
                             </div>
                            </div>
                           <div className="text-right flex-shrink-0">
                             <div className="text-slate-300 font-bold text-sm md:text-base">{q.translation}</div>
                             {q.basicMeaning && (
                               <div className="mt-0.5 text-[10px] font-medium text-slate-500 md:text-[11px]">
                                 Basic: {q.basicMeaning}
                               </div>
                             )}
                           </div>
                         </div>
                          <div className="mt-3 ml-12 flex flex-wrap items-center gap-2 md:justify-end">
                            <span className="text-[11px] font-bold text-slate-400">{'\u624b\u52d5\u8a2d\u5b9a'}</span>
                           {LEARNING_LEVELS.map(level => (
                             <button
                               key={level}
                               onClick={() => updateManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q, current => ({ ...current, manualOverrideLevel: current.manualOverrideLevel === level ? null : level }))}
                               className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${manualStatus.manualOverrideLevel === level ? level === 1 ? 'border-sky-300 bg-sky-500/20 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.24)]' : level === 2 ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.22)]' : 'border-violet-300 bg-violet-500/20 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.24)]' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                             >
                                {level === 1 ? '\u5b66\u7fd2\u4e2d' : level === 2 ? '\u3082\u3046\u5c11\u3057' : '\u899a\u3048\u305f'}
                             </button>
                           ))}
                           <button
                             onClick={() => updateManualQuestionStatus(gameState.selectedDifficulty, gameState.selectedLevel, q, current => ({ ...current, excluded: !current.excluded }))}
                             className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${manualStatus.excluded ? 'border-slate-300 bg-slate-200 text-slate-900' : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                           >
                              {manualStatus.excluded ? '\u9664\u5916\u3092\u89e3\u9664' : '\u9664\u5916\u3059\u308b'}
                           </button>
                         </div>
                         {example && (
                           <div className="mt-3 ml-12 rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2">
                             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Example</p>
                             <p className="mt-1 text-xs md:text-sm text-slate-200">{example}</p>
                           </div>
                         )}
                       </div>
                     );
                   }) */}</div>}</div>
               </Box>
           </div>
        </div>
        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }`}</style>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'settings') {
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-3xl w-full p-4">
          <div className="flex justify-between items-center mb-6">
            <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
            <h2 className="text-2xl font-bold text-blue-300 flex items-center gap-2"><Volume2 /> ゲーム設定</h2>
          </div>
          <Box title="BGM Volume" className="w-full">
            <div className="space-y-6">
              <p className="text-slate-300 text-sm">バトル中のBGM音量を選べます。`Off` にするとBGMを再生しません。</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Off', '1', '2', '3', '4', '5'].map((label, index) => (
                  <button
                    key={label}
                    onClick={() => handleBgmVolumeSelect(index)}
                    className={`rounded-xl border-2 px-4 py-4 font-bold transition-all ${bgmVolumeLevel === index ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400 hover:bg-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
                現在の設定: <span className="font-black text-white">{['Off', '1', '2', '3', '4', '5'][bgmVolumeLevel]}</span>
              </div>
            </div>
          </Box>
          <Box title="English Voice" className="w-full mt-6">
            <div className="space-y-6">
              <p className="text-slate-300 text-sm">アメリカ英語・イギリス英語の男女4種類と、ランダム切り替えから選べます。利用できる音声はブラウザやOSによって変わるため、近い候補を自動で選びます。</p>
              <p className="text-slate-400 text-xs">American Accent / British Accent を聞き比べながら選べます。</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SPEECH_VOICE_OPTIONS.map((option) => {
                  const exactSupported = option.id === 'random' || supportedSpeechModes.includes(option.id as Exclude<SpeechVoiceMode, 'random'>);
                  const isSupported = isSpeechModeSelectable(speechVoices, option.id);
                  const isSelected = speechVoiceMode === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSpeechVoiceSelect(option.id)}
                      disabled={!isSupported}
                      className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${!isSupported ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500 opacity-70' : isSelected ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400 hover:bg-slate-700'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold">{SPEECH_VOICE_COPY[option.id].label}</div>
                        {!isSupported && <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">未対応</span>}
                        {isSupported && !exactSupported && <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200">代替</span>}
                      </div>
                      <div className={`text-xs mt-1 ${isSupported && isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{SPEECH_VOICE_COPY[option.id].description}</div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="font-bold text-cyan-300">Voice Debug</div>
                <div className="mt-2">Selected Mode: <span className="font-mono text-white">{selectedSpeechConfig.mode}</span></div>
                <div>Requested Lang: <span className="font-mono text-white">{selectedSpeechConfig.lang}</span></div>
                <div>Resolution: <span className="font-mono text-white">{selectedSpeechConfig.resolution}</span></div>
                <div>
                  Active Voice:
                  <span className="ml-2 font-mono text-white">
                    {selectedSpeechConfig.voice ? `${selectedSpeechConfig.voice.name} (${selectedSpeechConfig.voice.lang})` : 'none'}
                  </span>
                </div>
                <div className="mt-3 text-cyan-200">Top locale candidates</div>
                <div className="mt-2 space-y-1">
                  {speechDebugCandidates.length > 0 ? speechDebugCandidates.map(({ voice, score }) => (
                    <div key={voice.voiceURI} className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2">
                      <span className="font-mono text-white">{voice.name}</span>
                      <span className="ml-2 text-slate-400">({voice.lang})</span>
                      <span className="ml-2 text-cyan-300">score: {score}</span>
                    </div>
                  )) : (
                    <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-slate-400">
                      No locale-matching voices found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Box>
          <Box title="Speech Speed" className="w-full mt-6">
            <div className="space-y-6">
              <p className="text-slate-300 text-sm">英語読み上げのスピードを 50%〜200% の範囲で調整できます。</p>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={speechRatePercent}
                onChange={(e) => handleSpeechRateChange(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500"
              />
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
                現在の設定: <span className="font-black text-white">{speechRatePercent}%</span>
              </div>
            </div>
          </Box>
          <div ref={playerProfilesSectionRef}>
          <Box title="Player Profiles" className="w-full mt-6">
            <div className="space-y-5">
              <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4 text-sm text-slate-300">
                <p className="font-bold text-violet-200">現在のプレイヤー</p>
                <p className="mt-2 text-lg font-black text-white">{getCurrentActivePlayer()?.name ?? 'Player'}</p>
                <p className="mt-1 text-xs text-slate-400">端末内でプレイヤーを切り替えて、それぞれ別の学習状態を持てます。</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={newPlayerNameInputRef}
                  type="text"
                  value={newPlayerName}
                  maxLength={PLAYER_NAME_MAX_LENGTH}
                  onChange={(e) => handleNewPlayerNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      createPlayerProfile();
                    }
                  }}
                  placeholder="新しいプレイヤー名"
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                <GameButton
                  onClick={createPlayerProfile}
                  size="sm"
                  className="bg-violet-600 border-violet-400 text-white hover:bg-violet-500"
                  disabled={newPlayerName.trim().length === 0}
                >
                  新規作成
                </GameButton>
              </div>
              <div className="space-y-2">
                {playerProfiles.map((profile) => {
                  const isActive = profile.id === activePlayerId;
                  const draftName = playerNameDrafts[profile.id] ?? profile.name;
                  const canSaveName = draftName.trim().length > 0 && draftName.trim() !== profile.name;
                  return (
                    <div key={profile.id} className={`flex flex-col gap-3 rounded-xl border px-3 py-3 md:flex-row md:items-center md:justify-between ${isActive ? 'border-violet-400/40 bg-violet-500/10' : 'border-slate-700 bg-slate-950/70'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={draftName}
                            maxLength={PLAYER_NAME_MAX_LENGTH}
                            onChange={(e) => handlePlayerNameDraftChange(profile.id, e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                renamePlayerProfile(profile.id);
                              }
                            }}
                            aria-label="プレイヤー名"
                            className="w-full max-w-xs rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white placeholder:text-slate-500 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                          />
                          {isActive && <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-100">Active</span>}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">更新: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString('ja-JP') : '未使用'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <GameButton onClick={() => renamePlayerProfile(profile.id)} size="sm" variant="outline" className="border-violet-500/40 text-violet-100 hover:bg-violet-900/20" disabled={!canSaveName}>
                          保存
                        </GameButton>
                        <GameButton onClick={() => activatePlayerProfile(profile.id)} size="sm" variant="outline" className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/20" disabled={isActive}>
                          切り替える
                        </GameButton>
                        <GameButton onClick={() => deletePlayerProfile(profile.id)} size="sm" variant="outline" className="border-red-500/40 text-red-200 hover:bg-red-900/20" disabled={playerProfiles.length <= 1}>
                          削除
                        </GameButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Box>
          </div>
          <div ref={progressTransferSectionRef}>
          <Box title="Progress Transfer" className="w-full mt-6">
            <div className="space-y-5">
              <p className="text-sm text-slate-300">
                学習データを JSON ファイルとして保存し、別端末で読み込めます。分かる項目だけ復元するので、将来データ項目が増減しても壊れにくい方式です。
              </p>
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
                <p>現在のプレイヤーのみを書き出します。</p>
                <p className="mt-2">読み込むと、そのプレイヤーデータを追加または更新します。</p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-sm text-slate-300">
                <p className="font-bold text-cyan-200">引き継げる主な内容</p>
                <p className="mt-2">苦手語、ミス統計、手動設定、除外設定、復習キュー、日次進捗、保存済み選択リスト、自動再生設定</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <GameButton onClick={downloadProgressSnapshot} className="sm:flex-1 bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500">
                  <ClipboardList size={18} /> 学習データを書き出す
                </GameButton>
                <GameButton onClick={openProgressImportPicker} variant="outline" className="sm:flex-1 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/20">
                  <BookOpen size={18} /> 学習データを読み込む
                </GameButton>
              </div>
              <input
                ref={progressImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportProgressFile}
              />
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
                <p>保存形式: `english-typing-rpg-progress-*.json`</p>
                <p className="mt-1">読み込み時は未知の項目を無視し、足りない項目は既定値で補います。</p>
                {progressTransferStatus && (
                  <p className="mt-3 font-bold text-cyan-200">{progressTransferStatus}</p>
                )}
              </div>
            </div>
          </Box>
          </div>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'help') {
    return (
      <HelpScreen onBack={() => setGameState(prev => ({ ...prev, screen: 'title' }))} />
    );
  }

  if (gameState.screen === 'title') {
    const allMonsterIds = Object.values(MONSTERS).flatMap(lvl => [...lvl.guide, ...lvl.challenge]).map(m => m.id);
    const uniqueDefeatedIds = new Set(gameState.defeatedMonsterIds.map(key => extractMonsterId(key)));
    const totalDefeated = [...uniqueDefeatedIds].filter(id => allMonsterIds.includes(id)).length;
    const totalMonsters = allMonsterIds.length;
    const selectedQuestions = QUESTIONS[gameState.selectedDifficulty]?.[gameState.selectedLevel] ?? [];
    const selectedWeakTexts = new Set(weakQuestions.map(q => q.text));
    const weakCount = selectedQuestions.filter(question => (
      selectedWeakTexts.has(question.text)
      && !isQuestionExcluded(gameState.selectedDifficulty, gameState.selectedLevel, question)
    )).length;
    const todayQuestionCount = dailyProgress.date === getTodayKey() ? dailyProgress.questionCount : 0;
    const reviewQueueCount = reviewQueueRef.current.length;

    return (
      <ScreenContainer>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[url('https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2544&auto=format&fit=crop')] bg-cover bg-center">
            <div className="absolute inset-0 bg-slate-900/68 backdrop-blur-[1px]"></div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-y-0 left-1/2 hidden w-[64vw] min-w-[520px] max-w-[1080px] -translate-x-1/2 items-center justify-center md:flex">
                <img
                  src={MAIN_CHARACTER_BACKGROUND_IMAGE}
                  alt=""
                  aria-hidden="true"
                  className="h-auto max-h-[110vh] w-full scale-[1.08] object-contain object-center opacity-50 saturate-[1.08] contrast-[1.04] blur-[0.3px] drop-shadow-[0_22px_60px_rgba(96,165,250,0.34)] [mask-image:radial-gradient(circle_at_center,black_56%,transparent_92%)]"
                />
              </div>
              <div className="absolute inset-y-0 left-0 hidden w-[56%] bg-gradient-to-r from-slate-900/86 via-slate-900/54 to-transparent md:block"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,rgba(96,165,250,0.16),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(251,191,36,0.10),transparent_22%)]"></div>
            </div>
            <div className="relative z-10 flex flex-col items-center md:max-w-5xl w-full">
                <div className="mb-5 flex w-full max-w-4xl flex-col items-center gap-4 md:items-start">
                    <div className="px-1 py-2 text-center md:max-w-[62%] md:text-left">
                      <div className="mb-2 inline-flex rounded-full border border-yellow-400/30 bg-yellow-500/10 px-4 py-1 text-xs font-black uppercase tracking-[0.28em] text-yellow-200">
                        HERO
                      </div>
                      <h1
                        className="mb-1 text-5xl font-black tracking-[0.05em] text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-200 to-cyan-300 [text-shadow:0_2px_0_rgba(255,255,255,0.18),0_0_18px_rgba(125,211,252,0.34),0_10px_26px_rgba(15,23,42,0.78)] md:text-8xl"
                        style={{ fontFamily: "'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif" }}
                      >
                        English Typing
                      </h1>
                      <h2
                        className="text-4xl font-black tracking-[0.22em] text-yellow-200 [text-shadow:0_2px_0_rgba(255,251,235,0.18),0_0_16px_rgba(253,224,71,0.28),0_8px_24px_rgba(0,0,0,0.88)] md:text-6xl"
                        style={{ fontFamily: "'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif" }}
                      >
                        FANTASY
                      </h2>
                      <p className="mt-3 text-sm md:text-base font-semibold text-slate-200/90">
                        タイピングで英語を覚えて、主人公といっしょにモンスターを倒そう。
                      </p>
                    </div>
                </div>
                <div className="mb-8 flex flex-col md:flex-row gap-4 w-full justify-center">
                     <div className="flex items-center gap-2 bg-gradient-to-r from-red-900 to-slate-900 border border-yellow-500/50 px-6 py-3 rounded-full text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.3)] backdrop-blur-sm"><Trophy size={20} className="text-yellow-400" /><span className="font-bold text-lg tracking-wide">撃破数: <span className="text-white text-xl mx-1">{totalDefeated}</span> / {totalMonsters}</span></div>
                     <div className="flex items-center gap-2 bg-slate-800/80 px-6 py-3 rounded-full text-emerald-300 shadow-md border border-emerald-500/40"><Target size={20} className="text-emerald-400" /><span className="font-bold text-sm">今日の問題数 <span className="text-white font-mono text-xl mx-1">{todayQuestionCount}</span> 問</span></div>
                     <div className="flex items-center gap-2 bg-slate-800/80 px-5 py-3 rounded-full text-amber-300 shadow-md border border-amber-500/40"><RotateCcw size={18} className="text-amber-400" /><span className="font-bold text-sm">復習待ち <span className="text-white font-mono text-lg mx-1">{reviewQueueCount}</span> 件</span></div>
                     <div className="flex items-center gap-2 bg-slate-800/80 px-6 py-3 rounded-full text-blue-300 shadow-md border border-slate-600"><Keyboard size={20} className="text-blue-400" /><span className="font-bold text-sm">最高入力: <span className="text-white font-mono text-xl mx-1">{maxKeystrokes}</span></span></div>
                </div>
                <div className="w-full space-y-4 max-w-4xl">
                    <div className="rounded-2xl border border-violet-400/25 bg-slate-950/65 px-4 py-3 shadow-[0_10px_24px_rgba(76,29,149,0.18)] backdrop-blur-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-200">Current Player</div>
                          <div className="truncate text-lg font-black text-white md:text-xl">{getCurrentActivePlayer()?.name ?? 'Player'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {playerProfiles.map((profile) => {
                            const isActive = profile.id === activePlayerId;
                            return (
                              <GameButton
                                key={profile.id}
                                onClick={() => activatePlayerProfile(profile.id)}
                                size="sm"
                                variant="outline"
                                className={isActive
                                  ? 'border-violet-300 bg-violet-500/20 text-white'
                                  : 'border-slate-600 text-slate-200 hover:border-violet-300 hover:bg-violet-900/15'}
                                disabled={isActive}
                              >
                                {profile.name}
                              </GameButton>
                            );
                          })}
                          <GameButton
                            onClick={openPlayerProfileSettings}
                            size="sm"
                            variant="outline"
                            className="border-violet-400/50 text-violet-100 hover:border-violet-300 hover:bg-violet-900/20"
                          >
                            <Volume2 size={16} /> 管理
                          </GameButton>
                        </div>
                      </div>
                    </div>
                     <GameButton onClick={openWeakReviewHub} className={`w-full ${weakCount > 0 ? 'bg-gradient-to-r from-orange-600 to-red-600 border-orange-400 text-white animate-pulse' : 'bg-slate-700 border-slate-500 text-slate-400'}`} size="lg" disabled={weakCount === 0}><div className="flex items-center justify-center gap-2"><Flame size={24} className={weakCount > 0 ? "text-yellow-300" : "text-slate-500"} /><span className="font-bold">{weakCount > 0 ? `苦手復習を開く (Weakness: ${weakCount})` : "苦手な単語はありません"}</span></div></GameButton>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {DIFFICULTIES.map(diff => (
                          <GameButton
                            key={diff}
                            onClick={() => updateSelectedDifficulty(diff, 'level-select')}
                            title={DIFFICULTY_GRADE_LABELS[diff]}
                            className="w-full min-h-[86px] px-4"
                            size="lg"
                            variant={DIFFICULTY_BUTTON_VARIANTS[diff]}
                          >
                            <span className="flex min-w-0 flex-col items-center justify-center leading-tight">
                              <span className="text-base font-black tracking-[0.04em] md:text-lg">{DIFFICULTY_LABELS[diff]}</span>
                              <span className="mt-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                                {DIFFICULTY_GRADE_SUBLABELS[diff]}
                              </span>
                            </span>
                          </GameButton>
                        ))}
                    </div>
                    <GameButton
                      onClick={openProgressTransferSettings}
                      variant="outline"
                      className="hidden"
                    >
                      <ClipboardList size={18} /> 学習データ保存／読み込み
                    </GameButton>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                         <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'monster-book' }))} variant="outline" className="px-2"><BookOpen size={20} /> 図鑑</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'score-view' }))} variant="outline" className="px-2 border-slate-600 text-slate-300">Records</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'question-list' }))} variant="outline" className="px-2 border-slate-600 text-slate-300">Word List</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'settings' }))} variant="outline" className="px-2 border-slate-600 text-slate-300"><Volume2 size={16} /> ゲーム設定</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'help' }))} variant="outline" className="px-2 border-slate-600 text-slate-300"><AlertCircle size={16} /> ヘルプ</GameButton>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <GameButton onClick={openProgressTransferSettings} variant="outline" className="border-cyan-500/50 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-900/20">
                          <ClipboardList size={16} /> 学習データ保存／読み込み
                        </GameButton>
                        <GameButton onClick={handleResetHistory} variant="outline" className="border-red-700/60 text-red-300 hover:border-red-500 hover:bg-red-950/40">
                          <RotateCcw size={16} /> 履歴をリセット
                        </GameButton>
                    </div>
                    {showResetConfirm && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowResetConfirm(false)}></div>
                        <div className="relative w-full max-w-xl rounded-xl border-2 border-red-700/60 bg-slate-900 p-6 shadow-2xl">
                          <h3 className="mb-4 text-2xl font-black text-red-300">履歴をリセット</h3>
                          <div className="space-y-2 text-slate-200">
                            <p>本当にPlay履歴データを消去して良いですか？</p>
                            <p>Are you sure you want to delete your Play history data?</p>
                          </div>
                          <div className="mt-6 flex justify-end gap-3">
                            <GameButton onClick={() => setShowResetConfirm(false)} variant="outline" size="sm" autoFocus>No</GameButton>
                            <GameButton onClick={confirmResetHistory} size="sm" className="bg-red-600 border-red-400 text-white hover:bg-red-500">Yes</GameButton>
                          </div>
                        </div>
                      </div>
                    )}
                    {showHelp && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)}></div>
                        <div className="relative w-full max-w-xl rounded-xl border-2 border-slate-500 bg-slate-900 p-6 shadow-2xl">
                          <h3 className="mb-4 text-2xl font-black text-blue-300">遊び方 (How to Play)</h3>
                          <div className="space-y-2 text-slate-200">
                            <p>1. 難易度とレベルを選んでバトルを開始します。</p>
                            <p>2. 表示された英語を正しく入力するとモンスターにダメージを与えます。</p>
                            <p>3. ミスが増えるとスコアが伸びにくくなるので、正確さを意識してください。</p>
                            <p>4. 苦手特訓や図鑑を使って、単語と記録を確認できます。</p>
                          </div>
                          <div className="mt-6 flex justify-end">
                            <GameButton onClick={() => setShowHelp(false)} variant="outline" size="sm" autoFocus>閉じる</GameButton>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
            </div>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'level-select') {
    const availableLevels = getAvailableLevels(gameState.selectedDifficulty);
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-5xl w-full p-4 mt-10">
          <GameButton size="sm" variant="ghost" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))} className="mb-6 text-slate-400 hover:text-white">&larr; 戻る</GameButton>
          <h2 className="text-3xl font-bold mb-8 text-center text-blue-300 tracking-widest border-b border-slate-700 pb-4">レベルをえらぶ</h2>
          <div className={`grid grid-cols-1 gap-8 ${availableLevels.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>{availableLevels.map((lvl) => (<div key={lvl} className="group bg-slate-800 border-2 border-slate-600 hover:border-blue-400 rounded-xl overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1"><div className={`h-32 flex items-center justify-center text-6xl bg-gradient-to-br ${lvl===1 ? 'from-blue-900 to-slate-900' : lvl===2 ? 'from-green-900 to-slate-900' : 'from-red-900 to-slate-900'}`}>{lvl === 1 ? '⚔️' : lvl === 2 ? '🛡️' : '📜'}</div><div className="p-6"><h3 className="text-2xl font-bold mb-2 text-white">LEVEL {lvl}</h3><p className="text-slate-400 mb-6 text-sm">{lvl === 1 ? "Short Words (単語)" : lvl === 2 ? "Phrases (熟語)" : "Sentences (文章)"}</p><GameButton className="w-full" variant="outline" onClick={() => setGameState(prev => ({ ...prev, selectedLevel: lvl as Level, screen: 'mode-select' }))}>決定</GameButton></div></div>))}</div>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'mode-select') {
    const monstersObj = MONSTERS[gameState.selectedLevel];
    const learningSummary = getScopedLearningSummary(gameState.selectedDifficulty, gameState.selectedLevel);
    const guideTargetCount = getGuideTargetCount(gameState.selectedDifficulty, gameState.selectedLevel);
    const listeningTargetCount = getListeningTargetCount(gameState.selectedDifficulty, gameState.selectedLevel);
    const guideFinalMonsterName = monstersObj.guide[guideTargetCount - 1]?.name ?? '???';
    const listeningFinalMonsterName = monstersObj.guide[listeningTargetCount - 1]?.name ?? '???';
    const normalBattleIndices = getBattleStageIndices(monstersObj.challenge, NORMAL_TARGET_COUNT, 'challenge', 'voice-only');
    const hardBattleIndices = getBattleStageIndices(monstersObj.challenge, HARD_TARGET_COUNT, 'challenge', 'text-only');
    const normalFinalMonsterName = monstersObj.challenge[normalBattleIndices[normalBattleIndices.length - 1] ?? NORMAL_TARGET_COUNT - 1]?.name ?? '???';
    const hardFinalMonsterName = monstersObj.challenge[hardBattleIndices[hardBattleIndices.length - 1] ?? HARD_TARGET_COUNT - 1]?.name ?? '???';
    
    const getModeProgress = (list: Monster[], mode: Mode, inputMode: InputMode, targetCount: number) => {
        const targetIndices = getBattleStageIndices(list, targetCount, mode, inputMode);
        const nextMonsterIndex = targetIndices.find(monsterIndex => !matchesDefeatedMonster(
          gameState.defeatedMonsterIds,
          gameState.selectedDifficulty,
          gameState.selectedLevel,
          mode,
          inputMode,
          list[monsterIndex]?.id ?? ''
        ));
        
        return {
            nextTargetName: nextMonsterIndex == null
              ? null
              : list[nextMonsterIndex]?.name ?? null,
            isComplete: nextMonsterIndex == null,
        };
    };

    const guideStatus = getModeProgress(monstersObj.guide, 'guide', 'voice-text', guideTargetCount);
    const easyStatus = getModeProgress(monstersObj.guide, 'challenge', 'voice-text', listeningTargetCount);
    const normalStatus = getModeProgress(monstersObj.challenge, 'challenge', 'voice-only', NORMAL_TARGET_COUNT);
    const hardStatus = getModeProgress(monstersObj.challenge, 'challenge', 'text-only', HARD_TARGET_COUNT);

    return (
      <ScreenContainer className="bg-slate-900 flex items-center justify-center">
        <Box className="max-w-5xl w-full" title="モードをえらぶ">
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_58%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(12,18,32,0.92))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Learning Progress</p>
                <h3 className="mt-1 text-xl font-black text-white">{'\u3044\u307e\u306e\u5b66\u7fd2\u72b6\u6cc1'}</h3>
              </div>
              <div className="rounded-full border border-cyan-400/25 bg-cyan-950/40 px-4 py-2 text-sm font-bold text-cyan-100">
                {learningSummary.playableCount}{'\u5358\u8a9e\u4e2d'} {learningSummary.masteredCount}{'\u5358\u8a9e\u304c\u899a\u3048\u305f'}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-500/12 p-4 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
                <div className="flex items-center gap-2 text-sky-200">
                  <BookOpen size={18} className="text-sky-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u5b66\u7fd2\u4e2d'}</p>
                </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.learningCount}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/12 p-4 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
                <div className="flex items-center gap-2 text-emerald-200">
                  <CheckCircle2 size={18} className="text-emerald-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u3082\u3046\u5c11\u3057'}</p>
                </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.cautionCount}</p>
              </div>
              <div className="rounded-2xl border border-violet-400/30 bg-violet-500/12 p-4 shadow-[0_0_28px_rgba(167,139,250,0.16)]">
                <div className="flex items-center gap-2 text-violet-200">
                  <Crown size={18} className="text-violet-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u899a\u3048\u305f'}</p>
                </div>
                <p className="mt-3 bg-gradient-to-r from-violet-100 via-white to-violet-200 bg-clip-text text-4xl font-black leading-none text-transparent">{learningSummary.masteredCount}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-slate-800/50 rounded-xl p-4 border-2 border-blue-900/50 flex flex-col">
                <div className="flex items-center gap-3 mb-6 border-b border-blue-800/50 pb-4"><div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center"><Brain className="text-blue-300" /></div><div><h3 className="text-xl font-bold text-blue-200">TRAINING ZONE</h3><p className="text-xs text-blue-400">まずはここで練習しよう！({guideTargetCount}体)</p></div></div>
                <div className="space-y-4 flex-1">
                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'guide', 'voice-text')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${guideStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-blue-900/20 border border-blue-700/30 hover:bg-blue-800/40 hover:border-blue-500'}`}>
                        {guideStatus.isComplete && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>}
                        {!guideStatus.isComplete && <div className="absolute top-0 right-0 bg-slate-950/80 text-blue-200 text-[10px] font-black px-2 py-0.5 rounded-bl border-l border-b border-blue-400/30">FINAL: {guideFinalMonsterName}</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${guideStatus.isComplete ? 'text-yellow-200' : 'text-blue-100 group-hover:text-white'}`}>🛡️ Basic Training / 基礎練習</span>
                            {!guideStatus.isComplete && <span className="text-[10px] bg-blue-900 text-blue-300 px-2 py-0.5 rounded">基礎練習</span>}
                        </div>
                        <p className={`text-xs mb-2 ${guideStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>スペルを見て入力。指の運動に最適！</p>
                        {guideStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">免許皆伝！次のレベルへ！</span></div> 
                            : <span className="text-xs text-blue-300 flex items-center gap-1"><Target size={12}/> NEXT: {guideStatus.nextTargetName}</span>}
                    </button>

                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'challenge', 'voice-text')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${easyStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-indigo-900/20 border border-indigo-700/30 hover:bg-indigo-800/40 hover:border-indigo-500'}`}>
                        {easyStatus.isComplete && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>}
                        {!easyStatus.isComplete && <div className="absolute top-0 right-0 bg-slate-950/80 text-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-bl border-l border-b border-indigo-400/30">FINAL: {listeningFinalMonsterName}</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${easyStatus.isComplete ? 'text-yellow-200' : 'text-indigo-100 group-hover:text-white'}`}>🔊 Listening Training / リスニング練習</span>
                            {!easyStatus.isComplete && <span className="text-[10px] bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">リスニング</span>}
                        </div>
                        <p className={`text-xs mb-2 ${easyStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>音声と日本語を見て練習。スペルは隠れます。</p>
                        {easyStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">免許皆伝！次のレベルへ！</span></div> 
                            : <span className="text-xs text-indigo-300 flex items-center gap-1"><Target size={12}/> NEXT: {easyStatus.nextTargetName}</span>}
                    </button>
                </div>
            </div>
            <div className="flex-1 bg-red-950/30 rounded-xl p-4 border-2 border-red-900/50 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">本番</div>
                <div className="flex items-center gap-3 mb-6 border-b border-red-900/50 pb-4"><div className="w-12 h-12 rounded-full bg-red-900 flex items-center justify-center"><Sword className="text-red-300" /></div><div><h3 className="text-xl font-bold text-red-200">BATTLE ZONE</h3><p className="text-xs text-red-400">実力を試そう！ゲームオーバーあり</p></div></div>
                <div className="space-y-4 flex-1">
                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'challenge', 'voice-only')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${normalStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-orange-900/20 border border-orange-700/30 hover:bg-orange-800/40 hover:border-orange-500'}`}>
                        {normalStatus.isComplete && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>}
                        {!normalStatus.isComplete && <div className="absolute top-0 right-0 bg-slate-950/80 text-orange-200 text-[10px] font-black px-2 py-0.5 rounded-bl border-l border-b border-orange-400/30">FINAL: {normalFinalMonsterName}</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${normalStatus.isComplete ? 'text-yellow-200' : 'text-orange-100 group-hover:text-white'}`}>👂 Listening Battle / 音声バトル</span>
                            {!normalStatus.isComplete && <span className="text-[10px] bg-orange-900 text-orange-300 px-2 py-0.5 rounded">音声</span>}
                        </div>
                        <p className={`text-xs mb-2 ${normalStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>音声だけを聞いて入力。耳を頼りに戦います。</p>
                        {normalStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">見事！次はTranslation Battle！</span></div> 
                            : <span className="text-xs text-orange-300 flex items-center gap-1"><Target size={12}/> NEXT: {normalStatus.nextTargetName}</span>}
                    </button>

                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'challenge', 'text-only')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${hardStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gradient-to-r from-red-900/40 to-slate-900/40 border border-red-500/50 hover:border-red-400 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]'}`}>
                        {hardStatus.isComplete ? 
                            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>
                            : <div className="absolute -top-2 -right-2 text-2xl animate-bounce">👑</div>
                         }
                        {!hardStatus.isComplete && <div className="absolute top-0 right-8 bg-slate-950/80 text-red-200 text-[10px] font-black px-2 py-0.5 rounded-bl border-l border-b border-red-400/30">FINAL: {hardFinalMonsterName}</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold text-lg ${hardStatus.isComplete ? 'text-yellow-200' : 'text-red-100 group-hover:text-white'}`}>🦸 Translation Battle / 和訳バトル</span>
                            {!hardStatus.isComplete && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">和訳</span>}
                        </div>
                        <p className={`text-xs mb-2 ${hardStatus.isComplete ? 'text-yellow-100' : 'text-red-200'}`}>和訳だけを見て入力。できればかなり実力派です。</p>
                        {hardStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">伝説の英雄！おめでとう！</span></div> 
                            : <span className="text-xs text-red-300 flex items-center gap-1"><Target size={12}/> NEXT: {hardStatus.nextTargetName}</span>}
                    </button>
                </div>
            </div>
          </div>
          <div className="mt-8 text-center"><GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'level-select' }))} className="text-slate-500 hover:text-slate-300 text-sm font-bold">キャンセル</GameButton></div>
        </Box>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'battle') {
    const actualMonsterId = gameState.challengeModeIndices[gameState.currentMonsterIndex] ?? 0;
    const currentMonster = gameState.currentMonsterList[actualMonsterId] ?? gameState.currentMonsterList[0];
    if (!currentMonster) {
      return (
        <ScreenContainer className="bg-slate-900">
          <div className="w-full max-w-xl p-6">
            <Box title="Battle Error" className="w-full">
              <div className="space-y-4 text-center">
                <p className="text-slate-300">バトルの初期化に失敗しました。モード選択へ戻ります。</p>
                <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'mode-select' }))} variant="outline">戻る</GameButton>
              </div>
            </Box>
          </div>
        </ScreenContainer>
      );
    }
    const hpPercent = (gameState.monsterHp / gameState.maxMonsterHp) * 100;
    const isBoss = currentMonster.type === 'boss';
    const showJapanese = gameState.inputMode !== 'voice-only';
    const previousQuestionExample = lastSolvedQuestion
      ? getQuestionExample(gameState.selectedDifficulty, gameState.selectedLevel, lastSolvedQuestion)
      : null;
    const showPreviousStudyCard = !!lastSolvedQuestion;
    const showGuide = gameState.mode === 'guide'; 
    const questionsLeft = gameState.maxQuestions - gameState.questionCount + 1;
    const remainingWeakCount = getScopedWeakQuestions(gameState.selectedDifficulty, gameState.selectedLevel).length;
    const isFinalMonster = gameState.currentMonsterIndex === gameState.totalMonstersInStage - 1;
    const nextBossStage = getBossStage(gameState.mode, gameState.inputMode, gameState.currentMonsterIndex + 1, gameState.totalMonstersInStage);
    const nextBattleAlertLabel = getNextBattleAlertLabel(nextBossStage);
    const bossIntroLabel = getBossIntroLabel(gameState.bossStage);
    const shouldShowNextBattleAlert = nextBossStage > gameState.bossStage && !isFinalMonster;
    const monsterEmotion = gameState.monsterHp <= 0 ? 'win' : flash ? 'damage' : 'normal';
    const comboLabel = getComboLabel(gameState.combo);
    const questionPresentation = getBattleQuestionPresentation(gameState.currentQuestion.text);
    const monsterDialogue = getBattleBubbleDialogue(currentMonster, {
      isDefeated: gameState.monsterHp <= 0,
      isDamaged: flash,
      hpRate: hpPercent,
      combo: gameState.combo,
      missCount: gameState.missCount,
    });

    return (
      <ScreenContainer className={isBoss ? "bg-red-950" : "bg-slate-900"}>
        {showBossIntro && bossIntroLabel && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            <div className="absolute inset-0 animate-[finalBossFlash_520ms_ease-out_forwards] bg-white" />
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="animate-[finalBossReveal_900ms_ease-out_forwards] rounded-2xl border border-red-400/60 bg-slate-950/78 px-8 py-5 text-center shadow-[0_0_40px_rgba(248,113,113,0.35)]">
                <p className="text-xs font-black tracking-[0.45em] text-red-200">WARNING</p>
                <p className="mt-3 text-3xl font-black tracking-[0.18em] text-white md:text-5xl">{bossIntroLabel}</p>
              </div>
            </div>
          </div>
        )}
        <div className="w-full bg-slate-900/80 border-b border-slate-700 p-2 z-20 flex justify-between items-center shadow-md">
             <GameButton
               size="sm"
               variant="ghost"
               onClick={() => {
                 soundEngine.stopBattleAmbience();
                 soundEngine.stopBattleMusic();
                 setGameState(prev => ({ ...prev, screen: 'title' }));
               }}
               className="text-slate-400 text-xs py-1"
             >
               <Home size={16} /> EXIT
             </GameButton>
             <div className="flex gap-4">
               <div className="bg-red-900/50 border border-red-500/50 px-3 py-1 rounded-full text-red-200 text-xs font-bold">あと {questionsLeft}問</div>
               {gameState.mode === 'weakness' && (
                 <div className="bg-orange-900/50 border border-orange-500/50 px-3 py-1 rounded-full text-orange-200 text-xs font-bold">
                   残り苦手語: {remainingWeakCount}
                 </div>
               )}
             </div>
        </div>
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-start mt-4 px-4 pb-20">
            <div className="relative w-full flex flex-col items-center z-10 mb-4">
                {shouldShowNextBattleAlert && nextBattleAlertLabel && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 px-4 py-1.5 text-sm font-black tracking-[0.18em] text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.22)]">
                    <Skull size={16} className="text-red-300" />
                    {nextBattleAlertLabel}
                  </div>
                )}
                {gameState.combo >= 3 && (
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-1.5 text-sm font-black uppercase tracking-[0.2em] text-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                    <Flame size={16} className="text-yellow-300" />
                    {comboLabel} x{gameState.combo}
                  </div>
                )}
                <div className={`transition-all duration-300 ${flash ? 'scale-110' : ''} mb-2`}><div className="inline-block bg-white text-slate-900 px-4 py-1.5 rounded-xl shadow-lg border-2 border-slate-200 font-bold relative text-xs">{monsterDialogue}<div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-b-2 border-r-2 border-slate-200"></div></div></div>
                <div className={`transition-transform duration-100 relative ${flash ? 'translate-x-2 -translate-y-2 brightness-150 saturate-150' : monsterShake ? 'animate-shake brightness-110' : 'animate-bounce-slow'}`}><MonsterAvatar type={currentMonster.type} color={currentMonster.color} emotion={monsterEmotion} size={140} visualStyle={getMonsterVisualStyle(currentMonster)} />{isBoss && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded animate-pulse">BOSS</div>}</div>
                <div className="w-64 mt-2 bg-slate-800/80 p-2 rounded-lg border border-slate-600"><div className="flex justify-between text-slate-300 text-[10px] font-bold mb-1 px-1"><span className="flex items-center gap-2">{currentMonster.name} <span className="bg-slate-700 px-1 rounded text-slate-400">Lv.{gameState.currentMonsterIndex + 1}</span></span><span>{gameState.monsterHp} / {gameState.maxMonsterHp}</span></div><div className="h-3 bg-slate-900 rounded-full overflow-hidden relative shadow-inner"><div className={`h-full transition-all duration-300 relative overflow-hidden ${hpPercent < 30 ? 'bg-red-600' : 'bg-green-500'}`} style={{ width: `${hpPercent}%` }}><div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div></div></div></div>
            </div>
            <div className="w-full bg-slate-800/95 backdrop-blur border-4 border-slate-600 rounded-2xl shadow-xl p-4 md:p-5 mt-4 relative">
                 <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div>
                 <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                   <div className="flex flex-wrap items-center gap-2">
                     <button
                       type="button"
                       onClick={() => {
                         speakCurrentQuestion();
                         inputRef.current?.focus();
                       }}
                       title="音声をもう一度再生 (Right Ctrl)"
                       aria-label="音声をもう一度再生"
                       className="inline-flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-2.5 text-sm font-black text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all hover:border-blue-300 hover:bg-blue-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                     >
                       <Volume2 size={20} />
                       <span>もう一回聞く</span>
                     </button>
                     <div className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-[11px] font-bold text-slate-200">
                       <span className="text-slate-400">音声:</span>
                       <span>ボタン / Right Ctrl</span>
                     </div>
                   </div>
                   <button
                     type="button"
                     onClick={handleSkip}
                     title="この問題をスキップ"
                     aria-label="この問題をスキップ"
                     className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition-all hover:scale-[1.02] hover:from-amber-400 hover:to-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 md:self-auto"
                   >
                     <SkipForward size={18} />
                     <span>Skip</span>
                   </button>
                 </div>
                 <div className="text-center mb-2 min-h-[24px]">
                   {showJapanese && (
                     <div>
                       <p className="text-blue-300 text-lg md:text-xl font-bold drop-shadow-md">{gameState.currentQuestion.translation}</p>
                       {gameState.currentQuestion.basicMeaning && (
                         <p className="mt-1 text-[11px] font-medium text-slate-400 md:text-xs">
                           Basic: {gameState.currentQuestion.basicMeaning}
                         </p>
                       )}
                     </div>
                   )}
                 </div>
                 <div
                  className={`relative bg-black/40 rounded-xl border border-slate-700 shadow-inner ${questionPresentation.panelClass}`}
                   onClick={() => inputRef.current?.focus()}
                 >
                   <div className={`${questionPresentation.textClass} ${questionPresentation.minHeightClass} font-mono text-center pointer-events-none select-none tracking-[0.08em] text-slate-600 relative z-20 flex flex-wrap items-center justify-center content-center gap-y-1 break-words px-3 md:px-4`}>
                        {gameState.currentQuestion.text.split('').map((char, index) => {
                            const isTyped = index < gameState.userInput.length;
                            const isCurrent = index === gameState.userInput.length;
                            const isHint = !isTyped && (index < gameState.userInput.length + gameState.hintLength);
                            const isAlwaysVisible = showGuide;
                            let className = "inline-block min-w-[0.56em] transition-colors duration-100 ";
                            if (isTyped) { className += "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]"; } else if (isCurrent) { className += "text-white border-b-4 border-yellow-400 animate-pulse pb-1"; if (char === ' ') className += " bg-yellow-500/30"; } else if (isHint) { className += "text-slate-400/80"; } else if (isAlwaysVisible) { className += "text-slate-300"; } else { className += "opacity-0"; }
                            return <span key={index} className={className}>{(!isTyped && !isHint && !isAlwaysVisible && isCurrent) ? '_' : (char === ' ' ? '\u00A0' : char)}</span>;
                        })}
                    </div>
                    <input ref={inputRef} type="text" value={gameState.userInput} onChange={handleInput} className="w-full h-full opacity-0 absolute inset-0 cursor-default z-10" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
                 </div>
                 {showPreviousStudyCard && lastSolvedQuestion && (
                   <div className="mx-auto mt-3 max-w-3xl rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
                     <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-left leading-snug">
                       <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                         Previous
                       </span>
                       <span className="font-mono text-lg font-bold text-white md:text-xl">{lastSolvedQuestion.text}</span>
                       <div className="flex flex-col">
                         <span className="text-base font-bold text-emerald-100 md:text-lg">{lastSolvedQuestion.translation}</span>
                         {lastSolvedQuestion.basicMeaning && (
                           <span className="text-xs font-medium text-slate-400 md:text-sm">Basic: {lastSolvedQuestion.basicMeaning}</span>
                         )}
                       </div>
                       {previousQuestionExample && (
                         <>
                           <span className="hidden text-slate-500 md:inline">|</span>
                           <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Example</span>
                           <span className="text-base text-slate-200 md:text-lg">{previousQuestionExample}</span>
                         </>
                       )}
                     </div>
                   </div>
                 )}
            </div>
             <div className="mt-2 text-center"><span className="text-slate-500 text-[10px] uppercase tracking-widest border border-slate-700 px-2 py-0.5 rounded bg-slate-900">Type the spell to attack</span></div>
        </div>
        <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } .animate-shake { animation: shake 0.3s ease-in-out; } .animate-bounce-slow { animation: bounce 2s infinite; } @keyframes finalBossFlash { 0% { opacity: 0; } 12% { opacity: 0.96; } 100% { opacity: 0; } } @keyframes finalBossReveal { 0% { opacity: 0; transform: scale(0.88); } 18% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.04); } }`}</style>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'result') {
    const isWin = gameState.battleResult === 'win';
    const learningSummary = getScopedLearningSummary(gameState.selectedDifficulty, gameState.selectedLevel);
    const actualMonsterId = gameState.challengeModeIndices[gameState.currentMonsterIndex];
    const defeatedMonster = gameState.currentMonsterList[actualMonsterId];
    const remainingHpToWin = isWin ? 0 : Math.max(gameState.monsterHp, 0);
    const missedCount = gameState.currentBattleMissedQuestions.length;
    const perfectCount = gameState.battleLog.filter(log => !log.skipped && log.missCount === 0).length;
    const recoveredCount = gameState.battleLog.filter(log => !log.skipped && log.missCount > 0).length;
    const skippedCount = gameState.battleLog.filter(log => log.skipped).length;
    const answeredCount = gameState.battleLog.length - skippedCount;
    const perfectRate = answeredCount > 0 ? Math.round((perfectCount / answeredCount) * 100) : 0;
    // Advance while the current step is still within the generated stage length.
    const isNextAvailable = gameState.currentMonsterIndex < gameState.totalMonstersInStage - 1;
    const nextMonsterIsFinal = gameState.currentMonsterIndex === gameState.totalMonstersInStage - 2;
    
    const handleNextMonster = () => initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex + 1, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, gameState.totalKeystrokes);
    const handleRetry = () => initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.battleStartScore, gameState.battleStartKeystrokes);
    const handleBackToMode = () => {
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
      setGameState(prev => ({ ...prev, screen: 'mode-select' }));
    };
    const handleBackToLevel = () => {
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
      setGameState(prev => ({ ...prev, screen: 'level-select' }));
    };
    const handleBackToTitle = () => {
      soundEngine.stopBattleAmbience();
      soundEngine.stopBattleMusic();
      setGameState(prev => ({ ...prev, screen: 'title' }));
    };
    const handleOpenWeakList = () => {
      setQuestionListFilter('weak');
      setGameState(prev => ({ ...prev, screen: 'question-list' }));
    };
    const handleStartWeaknessFromResult = () => openWeakReviewHub();
    const handleStartBattleReview = () => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'weakness', 'text-only', gameState.currentBattleMissedQuestions);

    return (
      <ScreenContainer className="items-center justify-center p-4">
        {/* Main Result Box - Scrollable if content is long, but constrained to viewport */}
        <Box className="max-w-5xl w-full text-center border-4 border-yellow-600/50 bg-slate-800 relative flex flex-col max-h-full">
          {gameState.isNewRecord && (<div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-black text-xl shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-bounce z-50 whitespace-nowrap">👑 NEW RECORD! 👑</div>)}
          
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="mb-4 flex-shrink-0">
              {isWin ? (
                <>
                  <div className="mb-2 animate-bounce"><Trophy size={60} className="text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" /></div>
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-1">CLEAR!</h2>
                  <p className="text-slate-400 text-sm">モンスターをやっつけた！</p>
                  {defeatedMonster && (
                    <div className="mt-4 rounded-xl border border-yellow-500/40 bg-gradient-to-b from-yellow-900/30 to-slate-900/40 p-4">
                      <div className="flex flex-col items-center gap-2">
                        <MonsterAvatar type={defeatedMonster.type} color={defeatedMonster.color} emotion="win" size={110} visualStyle={getMonsterVisualStyle(defeatedMonster)} />
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">Defeated Monster</p>
                        <p className="text-xl font-black text-white">{defeatedMonster.name}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                 <>
                  <div className="mb-2"><Zap size={60} className="text-slate-600 mx-auto" /></div>
                  <h2 className="text-3xl font-black text-slate-400 mb-1">ざんねん...</h2>
                  <p className="text-slate-500 text-sm">にげられてしまった！</p>
                  <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/25 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Remaining HP</p>
                    <p className="mt-2 text-3xl font-black text-white">{remainingHpToWin}</p>
                    <p className="mt-2 text-sm text-red-100">あと {remainingHpToWin} HP へらせばクリア！</p>
                  </div>
                </>
              )}
              {missedCount > 0 && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-900/30 px-4 py-2 text-sm font-bold text-orange-200">
                  <AlertCircle size={16} className="text-orange-300" />
                  今回の苦手登録: {missedCount}語
                </div>
              )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 flex-shrink-0">
            <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Perfect</p>
              <p className="mt-1 text-2xl font-black text-white">{perfectCount}</p>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Recovered</p>
              <p className="mt-1 text-2xl font-black text-white">{recoveredCount}</p>
            </div>
            <div className="rounded-xl border border-slate-500/30 bg-slate-900/40 p-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Skip</p>
              <p className="mt-1 text-2xl font-black text-white">{skippedCount}</p>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Perfect Rate</p>
              <p className="mt-1 text-2xl font-black text-white">{perfectRate}%</p>
            </div>
          </div>
          </div>

          <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_58%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(12,18,32,0.92))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Learning Progress</p>
                <h3 className="mt-1 text-xl font-black text-white">{'\u3053\u3053\u307e\u3067\u306e\u5b66\u7fd2\u72b6\u6cc1'}</h3>
              </div>
              <div className="rounded-full border border-cyan-400/25 bg-cyan-950/40 px-4 py-2 text-sm font-bold text-cyan-100">
                {learningSummary.playableCount}{'\u5358\u8a9e\u4e2d'} {learningSummary.masteredCount}{'\u5358\u8a9e\u304c\u899a\u3048\u305f'}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-500/12 p-4 text-left shadow-[0_0_24px_rgba(56,189,248,0.12)]">
                <div className="flex items-center gap-2 text-sky-200">
                  <BookOpen size={18} className="text-sky-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u5b66\u7fd2\u4e2d'}</p>
                </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.learningCount}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/12 p-4 text-left shadow-[0_0_24px_rgba(52,211,153,0.12)]">
                <div className="flex items-center gap-2 text-emerald-200">
                  <CheckCircle2 size={18} className="text-emerald-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u3082\u3046\u5c11\u3057'}</p>
                </div>
                <p className="mt-3 text-4xl font-black leading-none text-white">{learningSummary.cautionCount}</p>
              </div>
              <div className="rounded-2xl border border-violet-400/30 bg-violet-500/12 p-4 text-left shadow-[0_0_28px_rgba(167,139,250,0.16)]">
                <div className="flex items-center gap-2 text-violet-200">
                  <Crown size={18} className="text-violet-300" />
                  <p className="text-[12px] font-black tracking-[0.16em]">{'\u899a\u3048\u305f'}</p>
                </div>
                <p className="mt-3 bg-gradient-to-r from-violet-100 via-white to-violet-200 bg-clip-text text-4xl font-black leading-none text-transparent">{learningSummary.masteredCount}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-auto flex-shrink-0">
              {missedCount > 0 && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-3 text-left">
                  <p className="mb-3 text-sm font-bold text-orange-200">復習に進む</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <GameButton onClick={handleOpenWeakList} size="sm" variant="outline" className="border-orange-500/40 text-orange-200 hover:bg-orange-900/30">
                      <ClipboardList size={16} className="mr-2" /> 苦手だけ見る
                    </GameButton>
                    <GameButton onClick={handleStartBattleReview} size="sm" variant="outline" className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/20">
                      <RotateCcw size={16} className="mr-2" /> 今回のミスだけ復習
                    </GameButton>
                    <GameButton onClick={handleStartWeaknessFromResult} size="sm" className="bg-orange-600 border-orange-400 text-white hover:bg-orange-500 md:col-span-2">
                      <Flame size={16} className="mr-2" /> 苦手復習へ
                    </GameButton>
                  </div>
                </div>
              )}
              {isWin ? (
                  isNextAvailable ? (
                    <GameButton onClick={handleNextMonster} className="w-full text-lg py-3" variant="success" autoFocus>{nextMonsterIsFinal ? '最後のモンスターへ' : 'つぎのモンスターへ'} <ArrowRight className="ml-2" size={20}/></GameButton>
                  ) : (
                    // Course Cleared!
                    <GameButton onClick={handleBackToMode} className="w-full text-lg py-3" variant="primary" autoFocus>コース選択へ戻る <LayoutGrid className="ml-2" size={20}/></GameButton>
                  )
              ) : (
                  <GameButton onClick={handleRetry} className="w-full text-lg py-3" variant="warning" autoFocus>もういちど！ <RotateCcw className="ml-2" size={20}/></GameButton>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                 <GameButton onClick={handleBackToMode} size="sm" variant="outline">コースをえらぶ</GameButton>
                 <GameButton onClick={handleBackToLevel} size="sm" variant="outline">レベルをえらぶ</GameButton>
                 <GameButton onClick={handleBackToTitle} size="sm" variant="ghost">ホームへ <LogOut className="ml-1" size={14}/></GameButton>
                 <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'monster-book' }))} size="sm" variant="ghost"><BookOpen size={16} className="mr-2" /> 図鑑</GameButton>
              </div>
          </div>

          <div className="mb-4 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-left">
             <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 sticky top-0 bg-slate-900/90 p-1 border-b border-slate-700">Battle Review</h3>
             <div className="space-y-1">
                 {gameState.battleLog.map((log, idx) => {
                     const example = getQuestionExample(gameState.selectedDifficulty, gameState.selectedLevel, log.question);
                     return (
                       <div key={idx} className="rounded bg-slate-800 p-2 text-xs border border-slate-700">
                         <div className="flex items-center justify-between gap-3">
                           <div className="flex min-w-0 flex-1 items-start gap-3">
                               <button onClick={() => speakWithSettings(log.question.text)} className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-slate-400 transition-colors hover:bg-blue-600 hover:text-white">
                                 <Volume2 size={14} />
                               </button>
                               <div className="min-w-0 flex-1">
                                   <span className="block font-mono text-blue-200 font-bold break-all">{log.question.text}</span>
                                   <span className="block text-slate-500">{log.question.translation}</span>
                               </div>
                           </div>
                           <div className="flex items-center flex-shrink-0">
                               {log.skipped ? 
                                  <span className="text-slate-500 flex items-center gap-1"><FastForward size={14}/> Skip</span> :
                                  log.missCount === 0 ? 
                                  <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={14}/> Perfect</span> :
                                  <span className="text-yellow-500 flex items-center gap-1"><AlertCircle size={14}/> Miss x{log.missCount}</span>
                               }
                           </div>
                         </div>
                         {example && (
                           <div className="mt-2 ml-11 rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2">
                             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Example</p>
                             <p className="mt-1 text-xs text-slate-200">{example}</p>
                           </div>
                         )}
                       </div>
                     );
                 })}
             </div>
          </div>
        </Box>
      </ScreenContainer>
    );
  }
  return <div>Loading...</div>;
}
