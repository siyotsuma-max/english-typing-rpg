import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Sword, Shield, Trophy, Home, SkipForward, Zap, ArrowRight, RotateCcw, BookOpen, Star, Lock, Flame, Skull, ClipboardList, Crown, Target, Medal, Keyboard, AlertCircle, Brain, CheckCircle2, FastForward, LayoutGrid, LogOut } from 'lucide-react';

// --- Types & Interfaces ---

type Difficulty = 'Eiken5' | 'Eiken4';
type Level = 1 | 2 | 3;
type Mode = 'guide' | 'challenge' | 'weakness'; 
type InputMode = 'voice-text' | 'text-only' | 'voice-only';
type BattleResult = 'win' | 'lose' | 'draw' | null;

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
  theme: string;
}

interface Question {
  text: string;
  translation: string;
}

interface BattleLogItem {
    question: Question;
    missCount: number;
    skipped: boolean;
}

interface GameState {
  screen: 'title' | 'monster-book' | 'question-list' | 'score-view' | 'rank-list' | 'level-select' | 'mode-select' | 'battle' | 'result';
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
  history: { damage: number; speed: number }[];
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
}

// --- Rank System ---
interface RankData { threshold: number; title: string; color: string; }

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

const getRankData = (defeatedCount: number): RankData => {
    const sortedRanks = [...RANKS].reverse();
    return sortedRanks.find(r => defeatedCount >= r.threshold) || RANKS[0];
};

const getUniqueKey = (mode: Mode, inputMode: InputMode, monsterId: string) => {
    return `${mode}:${inputMode}:${monsterId}`;
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

const speakText = (text: string) => {
  // Cancel any ongoing speech to prevent queuing lag
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  
  window.speechSynthesis.speak(utterance);
};


// --- Sound Engine ---
class SoundEngine {
  private ctx: AudioContext | null = null;

  constructor() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
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

  playClear() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    const timings = [0, 100, 200, 350, 450, 600];
    melody.forEach((freq, i) => {
        setTimeout(() => {
            this.playTone(freq, 'square', 0.2, 0.15); 
            this.playTone(freq * 0.5, 'triangle', 0.3, 0.1); 
        }, timings[i]);
    });
    setTimeout(() => {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => { this.playTone(1200 + (i * 200), 'sine', 0.1, 0.05); }, i * 40);
        }
    }, 350);
  }
  
  playStageClear() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 1318.51, 1567.98];
    const timings = [0, 150, 300, 450, 600, 750, 1000];

    melody.forEach((freq, i) => {
        setTimeout(() => {
            this.playTone(freq, 'square', 0.2, 0.1); 
            this.playTone(freq * 0.5, 'sawtooth', 0.3, 0.1); 
        }, timings[i]);
    });
    
    setTimeout(() => {
        this.playTone(1046.50, 'sine', 1.5, 0.1);
        this.playTone(1318.51, 'sine', 1.5, 0.1);
        this.playTone(1567.98, 'sine', 1.5, 0.1);
    }, 1200);
  }

  playFail() {
    if (!this.ctx) return;
    [300, 200, 100].forEach((freq, i) => setTimeout(() => this.playTone(freq, 'sawtooth', 0.6, 0.1), i * 200));
  }
  
  playNewRecord() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    [1000, 1200, 1500, 2000].forEach((freq, i) => { setTimeout(() => this.playTone(freq, 'sine', 0.1, 0.1), i * 80); });
  }
}
const soundEngine = new SoundEngine();

// --- Rich Monster Avatar Component (SVG) ---
const MonsterAvatar = ({ type, color, emotion = 'normal', size = 150 }: { type: MonsterType, color: string, emotion?: 'normal' | 'damage' | 'win', size?: number }) => {
  const mainColor = color;
  const gradientId = `grad-${type}-${color.replace('#', '')}`;
  
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
      case 'boss': 
        return <g filter="url(#shadow)"><path d="M-50 -10 L-70 -30 L-50 -20" fill="gold" stroke="#222" strokeWidth="2" /><path d="M50 -10 L70 -30 L50 -20" fill="gold" stroke="#222" strokeWidth="2" /><path d="M-30 -40 C-50 -70 -70 -50 -80 -60" fill="none" stroke="#222" strokeWidth="8" /><path d="M-30 -40 C-50 -70 -70 -50 -80 -60" fill="none" stroke="#ddd" strokeWidth="4" /><path d="M30 -40 C50 -70 70 -50 80 -60" fill="none" stroke="#222" strokeWidth="8" /><path d="M30 -40 C50 -70 70 -50 80 -60" fill="none" stroke="#ddd" strokeWidth="4" /><path d="M-50 -30 Q0 -70 50 -30 L45 50 Q0 80 -45 50 Z" fill={`url(#${gradientId})`} stroke="#222" strokeWidth="4" /><path d="M0 -30 L0 50" stroke="rgba(0,0,0,0.2)" strokeWidth="2" /><path d="M-25 -10 L25 -10" stroke="rgba(0,0,0,0.2)" strokeWidth="2" /><path d="M-35 20 L35 20" stroke="rgba(0,0,0,0.2)" strokeWidth="2" /><path d="M-25 -45 L-12 -75 L0 -55 L12 -75 L25 -45 Z" fill="gold" stroke="#222" strokeWidth="3" /><circle cx="0" cy="-45" r="8" fill="red" stroke="#222" strokeWidth="2" filter="url(#glow)" /></g>;
      default: return <circle cx="0" cy="0" r="35" fill={`url(#${gradientId})`} />;
    }
  };

  const renderFace = () => {
    const isRobot = type === 'robot';
    const isGhost = type === 'ghost';
    const eyeFill = isRobot || isGhost ? (emotion === 'damage' ? '#ff0000' : '#00ffcc') : '#222';
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
      <g className={emotion === 'damage' ? 'translate-x-2 translate-y-2' : ''}>{renderBody()}{renderFace()}</g>
    </svg>
  );
};


// --- Game Data (Compressed) ---
const QUESTIONS: Record<Difficulty, Record<Level, Question[]>> = {
  Eiken5: {
    1: [
      { text: "banana", translation: "バナナ" }, { text: "piano", translation: "ピアノ" }, { text: "camera", translation: "カメラ" }, { text: "computer", translation: "コンピューター" }, { text: "bus", translation: "バス" }, { text: "taxi", translation: "タクシー" }, { text: "hotel", translation: "ホテル" }, { text: "restaurant", translation: "レストラン" }, { text: "sandwich", translation: "サンドイッチ" },
      { text: "hamburger", translation: "ハンバーガー" }, { text: "pizza", translation: "ピザ" }, { text: "curry", translation: "カレー" }, { text: "juice", translation: "ジュース" }, { text: "coffee", translation: "コーヒー" }, { text: "milk", translation: "牛乳" }, { text: "cake", translation: "ケーキ" }, { text: "chocolate", translation: "チョコレート" },
      { text: "orange", translation: "オレンジ" }, { text: "apple", translation: "りんご" }, { text: "tomato", translation: "トマト" }, { text: "salad", translation: "サラダ" }, { text: "melon", translation: "メロン" }, { text: "lemon", translation: "レモン" }, { text: "music", translation: "音楽" }, { text: "guitar", translation: "ギター" }, { text: "violin", translation: "バイオリン" },
      { text: "flute", translation: "フルート" }, { text: "concert", translation: "コンサート" }, { text: "radio", translation: "ラジオ" }, { text: "sport", translation: "スポーツ" }, { text: "tennis", translation: "テニス" }, { text: "soccer", translation: "サッカー" },
      { text: "baseball", translation: "野球" }, { text: "basketball", translation: "バスケットボール" }, { text: "volleyball", translation: "バレーボール" }, { text: "badminton", translation: "バドミントン" }, { text: "ski", translation: "スキーする" }, { text: "skate", translation: "スケートする" }, { text: "pool", translation: "プール" }, { text: "racket", translation: "ラケット" }, { text: "glove", translation: "手袋" },
      { text: "bat", translation: "バット" }, { text: "team", translation: "チーム" }, { text: "player", translation: "選手" }, { text: "score", translation: "得点" }, { text: "game", translation: "ゲーム、試合" }, { text: "start", translation: "始める" }, { text: "goal", translation: "ゴール" }, { text: "camp", translation: "キャンプする" }, { text: "picnic", translation: "ピクニック" },
      { text: "hiking", translation: "ハイキング" }, { text: "party", translation: "パーティー" }, { text: "festival", translation: "祭り" }, { text: "present", translation: "プレゼント" }, { text: "card", translation: "カード" }, { text: "calendar", translation: "カレンダー" }, { text: "notebook", translation: "ノート" }, { text: "pen", translation: "ペン" }, { text: "pencil", translation: "鉛筆" },
      { text: "eraser", translation: "消しゴム" }, { text: "ruler", translation: "定規" }, { text: "bag", translation: "かばん" }, { text: "cap", translation: "帽子 (キャップ)" }, { text: "hat", translation: "帽子 (ハット)" }, { text: "shirt", translation: "シャツ" }, { text: "coat", translation: "コート" }, { text: "jacket", translation: "ジャケット" },
      { text: "sweater", translation: "セーター" }, { text: "dress", translation: "ドレス" }, { text: "skirt", translation: "スカート" }, { text: "shoe", translation: "靴" }, { text: "sock", translation: "靴下" }, { text: "pocket", translation: "ポケット" }, { text: "umbrella", translation: "傘" }, { text: "watch", translation: "腕時計" }, { text: "cup", translation: "カップ" },
      { text: "glass", translation: "グラス" }, { text: "dish", translation: "皿、料理" }, { text: "plate", translation: "皿" }, { text: "spoon", translation: "スプーン" }, { text: "fork", translation: "フォーク" }, { text: "knife", translation: "ナイフ" }, { text: "chopstick", translation: "箸" }, { text: "bottle", translation: "ボトル" }, { text: "box", translation: "箱" },
      { text: "basket", translation: "バスケット" }, { text: "table", translation: "テーブル" }, { text: "chair", translation: "椅子" }, { text: "desk", translation: "机" }, { text: "bed", translation: "ベッド" }, { text: "sofa", translation: "ソファ" }, { text: "curtain", translation: "カーテン" }, { text: "door", translation: "ドア" }, { text: "window", translation: "窓" },
      { text: "floor", translation: "床" }, { text: "wall", translation: "壁" }, { text: "room", translation: "部屋" }, { text: "kitchen", translation: "台所" }, { text: "bathroom", translation: "浴室" }, { text: "bedroom", translation: "寝室" }, { text: "garden", translation: "庭" }, { text: "school", translation: "学校" }, { text: "classroom", translation: "教室" }, { text: "gym", translation: "体育館" }, { text: "library", translation: "図書館" }, { text: "office", translation: "オフィス" }, { text: "hospital", translation: "病院" }, { text: "bank", translation: "銀行" }, 
      { text: "station", translation: "駅" }, { text: "airport", translation: "空港" }, { text: "park", translation: "公園" }, { text: "bookstore", translation: "本屋" }, { text: "supermarket", translation: "スーパーマーケット" }, 
      { text: "building", translation: "建物" }, { text: "apartment", translation: "アパート" }, { text: "zoo", translation: "動物園" }, { text: "museum", translation: "博物館" }, { text: "theater", translation: "劇場" }, { text: "stadium", translation: "スタジアム" }, { text: "bridge", translation: "橋" }, { text: "tower", translation: "塔" }, { text: "street", translation: "通り" },
      { text: "city", translation: "都市" }, { text: "town", translation: "町" }, { text: "village", translation: "村" }, { text: "country", translation: "国" }, { text: "world", translation: "世界" }, { text: "Japan", translation: "日本" }, { text: "America", translation: "アメリカ" }, { text: "Canada", translation: "カナダ" }, { text: "Australia", translation: "オーストラリア" },
      { text: "China", translation: "中国" }, { text: "France", translation: "フランス" }, { text: "English", translation: "英語" }, { text: "Chinese", translation: "中国語" }, { text: "French", translation: "フランス語" }, { text: "car", translation: "車" }, { text: "bike", translation: "自転車 (バイク)" },
      { text: "bicycle", translation: "自転車 (バイシクル)" }, { text: "train", translation: "電車" }, { text: "plane", translation: "飛行機" }, { text: "ship", translation: "船" }, { text: "boat", translation: "ボート" }, { text: "truck", translation: "トラック" }, { text: "ticket", translation: "チケット" }, { text: "passport", translation: "パスポート" }, { text: "map", translation: "地図" },
      { text: "picture", translation: "絵、写真" }, { text: "letter", translation: "手紙" }, { text: "postcard", translation: "はがき" }, { text: "phone", translation: "電話" }, { text: "book", translation: "本" }, { text: "magazine", translation: "雑誌" }, { text: "newspaper", translation: "新聞" }, { text: "dictionary", translation: "辞書" },
      { text: "textbook", translation: "教科書" }, { text: "story", translation: "物語" }, { text: "page", translation: "ページ" }, { text: "dog", translation: "犬" }, { text: "cat", translation: "猫" }, { text: "rabbit", translation: "うさぎ" }, { text: "hamster", translation: "ハムスター" }, { text: "bird", translation: "鳥" },
      { text: "fish", translation: "魚" }, { text: "animal", translation: "動物" }, { text: "lion", translation: "ライオン" }, { text: "tiger", translation: "トラ" }, { text: "elephant", translation: "象" }, { text: "monkey", translation: "猿" }, { text: "bear", translation: "熊" }, { text: "panda", translation: "パンダ" }, { text: "horse", translation: "馬" },
      { text: "cow", translation: "牛" }, { text: "pig", translation: "豚" }, { text: "sheep", translation: "羊" }, { text: "chicken", translation: "鶏" }, { text: "dolphin", translation: "イルカ" }, { text: "whale", translation: "クジラ" }, { text: "insect", translation: "昆虫" }, { text: "flower", translation: "花" }, { text: "rose", translation: "バラ" },
      { text: "tree", translation: "木" }, { text: "leaf", translation: "葉" }, { text: "grass", translation: "草" }, { text: "mountain", translation: "山" }, { text: "river", translation: "川" }, { text: "sea", translation: "海" }, { text: "beach", translation: "ビーチ" }, { text: "sky", translation: "空" }, { text: "star", translation: "星" },
      { text: "sun", translation: "太陽" }, { text: "moon", translation: "月" }, { text: "cloud", translation: "雲" }, { text: "rain", translation: "雨" }, { text: "snow", translation: "雪" }, { text: "wind", translation: "風" }, { text: "weather", translation: "天気" }, { text: "sunny", translation: "晴れた" }, { text: "cloudy", translation: "曇った" },
      { text: "rainy", translation: "雨の" }, { text: "snowy", translation: "雪の" }, { text: "windy", translation: "風の強い" }, { text: "warm", translation: "暖かい" }, { text: "cool", translation: "涼しい" }, { text: "hot", translation: "暑い" }, { text: "cold", translation: "寒い" }, { text: "spring", translation: "春" }, { text: "summer", translation: "夏" },
      { text: "fall", translation: "秋" }, { text: "winter", translation: "冬" }, { text: "color", translation: "色" }, { text: "red", translation: "赤" }, { text: "blue", translation: "青" }, { text: "white", translation: "白" }, { text: "black", translation: "黒" }, { text: "green", translation: "緑" }, { text: "yellow", translation: "黄色" },
      { text: "pink", translation: "ピンク" }, { text: "orange", translation: "オレンジ色" }, { text: "brown", translation: "茶色" }, { text: "purple", translation: "紫" }, { text: "gold", translation: "金" }, { text: "silver", translation: "銀" }, { text: "one", translation: "1" }, { text: "two", translation: "2" }, { text: "three", translation: "3" },
      { text: "four", translation: "4" }, { text: "five", translation: "5" }, { text: "six", translation: "6" }, { text: "seven", translation: "7" }, { text: "eight", translation: "8" }, { text: "nine", translation: "9" }, { text: "ten", translation: "10" }, { text: "eleven", translation: "11" }, { text: "twelve", translation: "12" },
      { text: "thirteen", translation: "13" }, { text: "fourteen", translation: "14" }, { text: "fifteen", translation: "15" }, { text: "sixteen", translation: "16" }, { text: "seventeen", translation: "17" }, { text: "eighteen", translation: "18" }, { text: "nineteen", translation: "19" }, { text: "twenty", translation: "20" }, { text: "thirty", translation: "30" },
      { text: "forty", translation: "40" }, { text: "fifty", translation: "50" }, { text: "sixty", translation: "60" }, { text: "seventy", translation: "70" }, { text: "eighty", translation: "80" }, { text: "ninety", translation: "90" }, { text: "hundred", translation: "100" }, { text: "thousand", translation: "1000" }, { text: "first", translation: "1番目" },
      { text: "second", translation: "2番目" }, { text: "third", translation: "3番目" }, { text: "fourth", translation: "4番目" }, { text: "fifth", translation: "5番目" }, { text: "sixth", translation: "6番目" }, { text: "seventh", translation: "7番目" }, { text: "eighth", translation: "8番目" }, { text: "ninth", translation: "9番目" }, { text: "tenth", translation: "10番目" },
      { text: "Sunday", translation: "日曜日" }, { text: "Monday", translation: "月曜日" }, { text: "Tuesday", translation: "火曜日" }, { text: "Wednesday", translation: "水曜日" }, { text: "Thursday", translation: "木曜日" }, { text: "Friday", translation: "金曜日" }, { text: "Saturday", translation: "土曜日" }, { text: "January", translation: "1月" }, { text: "February", translation: "2月" },
      { text: "March", translation: "3月" }, { text: "April", translation: "4月" }, { text: "May", translation: "5月" }, { text: "June", translation: "6月" }, { text: "July", translation: "7月" }, { text: "August", translation: "8月" }, { text: "September", translation: "9月" }, { text: "October", translation: "10月" }, { text: "November", translation: "11月" },
      { text: "December", translation: "12月" }, { text: "time", translation: "時間" }, { text: "hour", translation: "時間" }, { text: "minute", translation: "分" }, { text: "second", translation: "秒" }, { text: "morning", translation: "朝" }, { text: "afternoon", translation: "午後" }, { text: "evening", translation: "夕方" },
      { text: "night", translation: "夜" }, { text: "noon", translation: "正午" }, { text: "day", translation: "日" }, { text: "week", translation: "週" }, { text: "month", translation: "月" }, { text: "year", translation: "年" }, { text: "today", translation: "今日" }, { text: "tomorrow", translation: "明日" }, { text: "yesterday", translation: "昨日" },
      { text: "weekend", translation: "週末" }, { text: "holiday", translation: "休日" }, { text: "birthday", translation: "誕生日" }, { text: "Christmas", translation: "クリスマス" }, { text: "date", translation: "日付" }, { text: "breakfast", translation: "朝食" }, { text: "lunch", translation: "昼食" }, { text: "dinner", translation: "夕食" }, { text: "supper", translation: "夕食" },
      { text: "snack", translation: "おやつ" }, { text: "food", translation: "食べ物" }, { text: "fruit", translation: "果物" }, { text: "vegetable", translation: "野菜" }, { text: "meat", translation: "肉" }, { text: "fish", translation: "魚肉" }, { text: "egg", translation: "卵" }, { text: "bread", translation: "パン" }, { text: "rice", translation: "ご飯" },
      { text: "water", translation: "水" }, { text: "tea", translation: "お茶" }, { text: "jam", translation: "ジャム" }, { text: "butter", translation: "バター" }, { text: "salt", translation: "塩" }, { text: "sugar", translation: "砂糖" }, { text: "pepper", translation: "こしょう" }, { text: "soy sauce", translation: "醤油" }, { text: "oil", translation: "油" },
      { text: "family", translation: "家族" }, { text: "father", translation: "父" }, { text: "mother", translation: "母" }, { text: "parent", translation: "親" }, { text: "brother", translation: "兄弟" }, { text: "sister", translation: "姉妹" }, { text: "grandfather", translation: "祖父" }, { text: "grandmother", translation: "祖母" }, { text: "uncle", translation: "おじ" },
      { text: "aunt", translation: "おば" }, { text: "son", translation: "息子" }, { text: "daughter", translation: "娘" }, { text: "baby", translation: "赤ちゃん" }, { text: "child", translation: "子供" }, { text: "children", translation: "子供たち" }, { text: "boy", translation: "男の子" }, { text: "girl", translation: "女の子" }, { text: "man", translation: "男性" },
      { text: "woman", translation: "女性" }, { text: "friend", translation: "友達" }, { text: "classmate", translation: "クラスメート" }, { text: "neighbor", translation: "近所の人" }, { text: "people", translation: "人々" }, { text: "person", translation: "人" }, { text: "name", translation: "名前" }, { text: "address", translation: "住所" }, { text: "job", translation: "仕事" },
      { text: "teacher", translation: "先生" }, { text: "student", translation: "生徒" }, { text: "doctor", translation: "医者" }, { text: "nurse", translation: "看護師" }, { text: "dentist", translation: "歯科医" }, { text: "firefighter", translation: "消防士" }, { text: "pilot", translation: "パイロット" }, 
      { text: "driver", translation: "運転手" }, { text: "cook", translation: "料理人" }, { text: "baker", translation: "パン屋" }, { text: "farmer", translation: "農家" }, { text: "singer", translation: "歌手" }, { text: "artist", translation: "芸術家" }, { text: "writer", translation: "作家" }, { text: "scientist", translation: "科学者" }, { text: "clerk", translation: "店員" },
      { text: "waiter", translation: "ウェイター" }, { text: "waitress", translation: "ウェイトレス" }, { text: "head", translation: "頭" }, { text: "face", translation: "顔" }, { text: "eye", translation: "目" }, { text: "ear", translation: "耳" }, { text: "nose", translation: "鼻" }, { text: "mouth", translation: "口" }, { text: "tooth", translation: "歯" },
      { text: "teeth", translation: "歯（複数）" }, { text: "hair", translation: "髪" }, { text: "hand", translation: "手" }, { text: "finger", translation: "指" }, { text: "arm", translation: "腕" }, { text: "shoulder", translation: "肩" }, { text: "leg", translation: "脚" }, { text: "foot", translation: "足" }, { text: "feet", translation: "足（複数）" },
      { text: "knee", translation: "膝" }, { text: "body", translation: "体" }, { text: "heart", translation: "心臓、心" }, { text: "stomach", translation: "胃" }, { text: "back", translation: "背中" }, { text: "tall", translation: "背が高い" }, { text: "short", translation: "背が低い、短い" }, { text: "long", translation: "長い" }, { text: "big", translation: "大きい" },
      { text: "small", translation: "小さい" }, { text: "little", translation: "小さい" }, { text: "large", translation: "大きい" }, { text: "fat", translation: "太った" }, { text: "thin", translation: "やせた" }, { text: "heavy", translation: "重い" }, { text: "light", translation: "軽い" }, { text: "old", translation: "古い、年をとった" }, { text: "new", translation: "新しい" },
      { text: "young", translation: "若い" }, { text: "good", translation: "良い" }, { text: "bad", translation: "悪い" }, { text: "nice", translation: "素敵な" }, { text: "great", translation: "素晴らしい" }, { text: "wonderful", translation: "素晴らしい" }, { text: "beautiful", translation: "美しい" }, { text: "pretty", translation: "かわいい" }, { text: "cute", translation: "かわいい" },
      { text: "happy", translation: "幸せな" }, { text: "sad", translation: "悲しい" }, { text: "angry", translation: "怒った" }, { text: "tired", translation: "疲れた" }, { text: "sleepy", translation: "眠い" }, { text: "hungry", translation: "お腹がすいた" }, { text: "thirsty", translation: "喉が渇いた" }, { text: "sick", translation: "病気の" }, { text: "fine", translation: "元気な" },
      { text: "well", translation: "元気な" }, { text: "busy", translation: "忙しい" }, { text: "free", translation: "暇な" }, { text: "easy", translation: "簡単な" }, { text: "hard", translation: "難しい、一生懸命" }, { text: "difficult", translation: "難しい" }, { text: "interesting", translation: "面白い" }, { text: "exciting", translation: "興奮させる" }, { text: "fun", translation: "楽しい" },
      { text: "funny", translation: "おかしい" }, { text: "kind", translation: "親切な" }, { text: "friendly", translation: "友好的な" }, { text: "strong", translation: "強い" }, { text: "weak", translation: "弱い" }, { text: "fast", translation: "速い" }, { text: "slow", translation: "遅い" }, { text: "high", translation: "高い" }, { text: "low", translation: "低い" },
      { text: "right", translation: "正しい、右" }, { text: "left", translation: "左" }, { text: "wrong", translation: "間違った" }, { text: "same", translation: "同じ" }, { text: "different", translation: "違う" }, { text: "important", translation: "重要な" }, { text: "special", translation: "特別な" }, { text: "famous", translation: "有名な" }, { text: "clean", translation: "きれいな" },
      { text: "dirty", translation: "汚れた" }, { text: "quiet", translation: "静かな" }, { text: "noisy", translation: "うるさい" }, { text: "sweet", translation: "甘い" }, { text: "sour", translation: "酸っぱい" }, { text: "soft", translation: "柔らかい" }, { text: "hard", translation: "硬い" }, { text: "favorite", translation: "お気に入りの" }, { text: "popular", translation: "人気のある" },
      { text: "lucky", translation: "運が良い" }, { text: "careful", translation: "注意深い" }, { text: "ready", translation: "準備ができた" }, { text: "sorry", translation: "ごめんなさい" }, { text: "glad", translation: "嬉しい" }, { text: "sure", translation: "もちろん" }, { text: "really", translation: "本当に" }, { text: "very", translation: "とても" }, { text: "so", translation: "とても" },
      { text: "too", translation: "〜も、あまりに" }, { text: "much", translation: "たくさんの" }, { text: "many", translation: "多くの" }, { text: "a lot of", translation: "たくさんの" }, { text: "some", translation: "いくつかの" }, { text: "any", translation: "何か、どんな〜も" }, { text: "all", translation: "すべての" }, { text: "every", translation: "すべての" }, { text: "each", translation: "それぞれの" },
      { text: "other", translation: "他の" }, { text: "another", translation: "もう一つの" }, { text: "both", translation: "両方の" }, { text: "only", translation: "〜だけ" }, { text: "just", translation: "ちょうど、ただ〜だけ" }, { text: "about", translation: "およそ" }, { text: "almost", translation: "ほとんど" }, { text: "always", translation: "いつも" }, { text: "usually", translation: "普段" },
      { text: "often", translation: "よく" }, { text: "sometimes", translation: "時々" }, { text: "never", translation: "決して〜ない" }, { text: "again", translation: "再び" }, { text: "also", translation: "〜もまた" }, { text: "too", translation: "〜もまた" }, { text: "either", translation: "〜もまた（否定文）" }, { text: "together", translation: "一緒に" }, { text: "alone", translation: "一人で" },
      { text: "here", translation: "ここに" }, { text: "there", translation: "そこに" }, { text: "near", translation: "近くに" }, { text: "far", translation: "遠くに" }, { text: "away", translation: "離れて" }, { text: "home", translation: "家へ" }, { text: "out", translation: "外へ" }, { text: "into", translation: "〜の中へ" },
    ],
    2: [
      { text: "get up", translation: "起きる" }, { text: "go to school", translation: "学校へ行く" }, { text: "come home", translation: "家に帰る" }, { text: "look at", translation: "〜を見る (視線を向ける)" }, { text: "listen to", translation: "〜を聞く (耳を傾ける)" }, { text: "sit down", translation: "座る" }, { text: "stand up", translation: "立つ" }, { text: "write down", translation: "書き留める" }, { text: "clean up", translation: "掃除する" },
      { text: "wake up", translation: "目を覚ます" }, { text: "go to bed", translation: "寝る" }, { text: "take a bath", translation: "お風呂に入る" }, { text: "have breakfast", translation: "朝食を食べる" }, { text: "have lunch", translation: "昼食を食べる" }, { text: "have dinner", translation: "夕食を食べる" }, { text: "a cup of", translation: "一杯の" }, { text: "a piece of", translation: "一枚の" }, { text: "a lot of", translation: "たくさんの" },
      { text: "kind of", translation: "種類" }, { text: "in front of", translation: "〜の前に" }, { text: "next to", translation: "〜の隣に" },
      // Moved from Level 1
      { text: "police officer", translation: "警察官" }, { text: "flight attendant", translation: "客室乗務員" },
      { text: "ice cream", translation: "アイスクリーム" }, { text: "living room", translation: "居間" }, { text: "post office", translation: "郵便局" }, { text: "police station", translation: "警察署" }, { text: "department store", translation: "デパート" }, { text: "United Kingdom", translation: "イギリス" }, { text: "comic book", translation: "漫画本" }, { text: "junior high school", translation: "中学校" }, { text: "high school", translation: "高校" }, { text: "elementary school", translation: "小学校" }, { text: "station master", translation: "駅長" }, { text: "bus stop", translation: "バス停" }, { text: "train station", translation: "駅" }, { text: "traffic light", translation: "信号" }, { text: "convenience store", translation: "コンビニ" }, { text: "drug store", translation: "薬局" }, { text: "book shop", translation: "本屋" }, { text: "flower shop", translation: "花屋" }, { text: "shoe shop", translation: "靴屋" }, { text: "pet shop", translation: "ペットショップ" }, { text: "toy shop", translation: "おもちゃ屋" }, { text: "cake shop", translation: "ケーキ屋" }, { text: "hot dog", translation: "ホットドッグ" }, { text: "french fries", translation: "フライドポテト" }, { text: "apple pie", translation: "アップルパイ" }, { text: "orange juice", translation: "オレンジジュース" }, { text: "school lunch", translation: "給食" }, { text: "lunch box", translation: "弁当箱" }, { text: "supper time", translation: "夕食の時間" }, { text: "dining room", translation: "食堂" }, { text: "bath room", translation: "浴室" }, { text: "music room", translation: "音楽室" }, { text: "science room", translation: "理科室" }, { text: "computer room", translation: "コンピュータ室" }, { text: "staff room", translation: "職員室" }, { text: "nurse's office", translation: "保健室" }, { text: "video game", translation: "テレビゲーム" }, { text: "card game", translation: "カードゲーム" }, { text: "board game", translation: "ボードゲーム" }, { text: "pop music", translation: "ポップ音楽" }, { text: "rock music", translation: "ロック音楽" }, { text: "classical music", translation: "クラシック音楽" }, { text: "jazz music", translation: "ジャズ音楽" }, { text: "folk song", translation: "フォークソング" },
      { text: "over there", translation: "あそこに" }, { text: "right here", translation: "ちょうどここに" }, { text: "all day", translation: "一日中" }, { text: "all night", translation: "一晩中" }, { text: "all the time", translation: "ずっと" }, { text: "for a long time", translation: "長い間" }, { text: "once a week", translation: "週に一度" }, { text: "twice a month", translation: "月に二度" }, { text: "three times a year", translation: "年に三度" }, { text: "every morning", translation: "毎朝" }, { text: "last night", translation: "昨夜" }, { text: "this morning", translation: "今朝" }, { text: "tomorrow morning", translation: "明日の朝" }, { text: "day after tomorrow", translation: "明後日" }, { text: "day before yesterday", translation: "一昨日" }, { text: "next week", translation: "来週" }, { text: "last month", translation: "先月" }, { text: "next year", translation: "来年" },
      { text: "T-shirt", translation: "Tシャツ" }, 
      // Added phrases
      { text: "take a picture", translation: "写真を撮る" },
      { text: "go home", translation: "家に帰る" },
      { text: "go to the park", translation: "公園に行く" },
      { text: "play the piano", translation: "ピアノを弾く" },
      { text: "play the guitar", translation: "ギターを弾く" },
      { text: "play soccer", translation: "サッカーをする" },
      { text: "play baseball", translation: "野球をする" },
      { text: "play tennis", translation: "テニスをする" },
      { text: "listen to music", translation: "音楽を聴く" },
      { text: "watch TV", translation: "テレビを見る" },
      { text: "read a book", translation: "本を読む" },
      { text: "write a letter", translation: "手紙を書く" },
      { text: "study English", translation: "英語を勉強する" },
      { text: "cook dinner", translation: "夕食を作る" },
      { text: "help my mother", translation: "母を手伝う" },
      { text: "do my homework", translation: "宿題をする" },
      { text: "wash my hands", translation: "手を洗う" },
      { text: "clean my room", translation: "部屋を掃除する" },
      { text: "use a computer", translation: "コンピュータを使う" },
      { text: "make a cake", translation: "ケーキを作る" },
      { text: "speak English", translation: "英語を話す" },
      { text: "swim in the sea", translation: "海で泳ぐ" },
      { text: "run fast", translation: "速く走る" },
      { text: "walk to school", translation: "歩いて学校へ行く" },
      { text: "come from", translation: "〜出身である" },
      { text: "live in", translation: "〜に住んでいる" },
      { text: "like to", translation: "〜するのが好き" },
      { text: "want to", translation: "〜したい" },
      { text: "thank you", translation: "ありがとう" },
      { text: "you are welcome", translation: "どういたしまして" },
      { text: "excuse me", translation: "すみません" },
      { text: "I am sorry", translation: "ごめんなさい" },
      { text: "see you", translation: "またね" },
      { text: "good morning", translation: "おはよう" },
      { text: "good afternoon", translation: "こんにちは" },
      { text: "good evening", translation: "こんばんは" },
      { text: "good night", translation: "おやすみ" },
      { text: "how are you", translation: "元気ですか" },
      { text: "nice to meet you", translation: "はじめまして" },
      { text: "of course", translation: "もちろん" },
      { text: "all right", translation: "いいですよ/大丈夫" },
      { text: "that is right", translation: "その通りです" },
      { text: "at home", translation: "家で" },
      { text: "at school", translation: "学校で" },
      { text: "in the morning", translation: "朝に" },
      { text: "in the afternoon", translation: "午後に" },
      { text: "in the evening", translation: "夕方に" },
      { text: "at night", translation: "夜に" },
      { text: "on Sunday", translation: "日曜日に" },
      { text: "after school", translation: "放課後" },
      { text: "go shopping", translation: "買い物に行く" },
      { text: "look for", translation: "〜を探す" },
      { text: "talk with", translation: "〜と話す" },
      { text: "wait for", translation: "〜を待つ" }
    ],
    3: [
      { text: "I am a student.", translation: "私は生徒です。" }, { text: "You are kind.", translation: "あなたは親切です。" }, { text: "He is my teacher.", translation: "彼は私の先生です。" }, { text: "She is a nurse.", translation: "彼女は看護師です。" }, { text: "It is a dog.", translation: "それは犬です。" }, { text: "This is a pen.", translation: "これはペンです。" }, { text: "That is a bird.", translation: "あれは鳥です。" }, { text: "We are friends.", translation: "私たちは友達です。" },
      { text: "They are happy.", translation: "彼らは幸せです。" }, { text: "I like music.", translation: "私は音楽が好きです。" }, { text: "I play tennis.", translation: "私はテニスをします。" }, { text: "I have a book.", translation: "私は本を持っています。" }, { text: "He runs fast.", translation: "彼は速く走ります。" }, { text: "She cooks well.", translation: "彼女は料理が上手です。" }, { text: "We study English.", translation: "私たちは英語を勉強します。" }, { text: "They play soccer.", translation: "彼らはサッカーをします。" },
      { text: "Do you like cats?", translation: "あなたは猫が好きですか？" }, { text: "Can you swim?", translation: "あなたは泳げますか？" }, { text: "Is this yours?", translation: "これはあなたのですか？" }, { text: "Who is he?", translation: "彼は誰ですか？" }, { text: "What is this?", translation: "これは何ですか？" }, { text: "Where is my bag?", translation: "私のかばんはどこですか？" }, { text: "When is your birthday?", translation: "誕生日はいつですか？" }, { text: "How are you?", translation: "元気ですか？" },
      { text: "What time is it?", translation: "何時ですか？" }, { text: "How many books?", translation: "本は何冊ですか？" }, { text: "How much is it?", translation: "いくらですか？" }, { text: "Open the door.", translation: "ドアを開けてください。" }, { text: "Close your book.", translation: "本を閉じてください。" }, { text: "Let's go home.", translation: "家に帰りましょう。" }, { text: "Let's play baseball.", translation: "野球をしましょう。" }, { text: "Stand up, please.", translation: "立ってください。" },
      { text: "Sit down, please.", translation: "座ってください。" }, { text: "Thank you very much.", translation: "本当にありがとう。" }, { text: "You are welcome.", translation: "どういたしまして。" }, { text: "Nice to meet you.", translation: "はじめまして。" }, { text: "I want a bike.", translation: "私は自転車が欲しいです。" }, { text: "I need some water.", translation: "私は水が必要です。" }, { text: "He lives in Tokyo.", translation: "彼は東京に住んでいます。" }, { text: "She goes to school.", translation: "彼女は学校へ行きます。" },
      { text: "My father is busy.", translation: "私の父は忙しいです。" }, { text: "My mother is kind.", translation: "私の母は親切です。" }, { text: "I have two dogs.", translation: "私は犬を2匹飼っています。" }, { text: "Do you have a pen?", translation: "ペンを持っていますか？" }, { text: "I don't know.", translation: "私は知りません。" }, { text: "I can't play piano.", translation: "私はピアノが弾けません。" }, { text: "It is sunny today.", translation: "今日は晴れです。" }, { text: "It is hot today.", translation: "今日は暑いです。" },
      { text: "It is cold now.", translation: "今は寒いです。" }, { text: "Look at the sky.", translation: "空を見てください (視線を向ける)。" }, { text: "Listen to me.", translation: "私の話を聞いてください (耳を傾ける)。" }, { text: "Wash your hands.", translation: "手を洗ってください。" }, { text: "Don't run here.", translation: "ここで走ってはいけません。" }, { text: "Let's eat lunch.", translation: "昼食を食べましょう。" }, { text: "Let's study together.", translation: "一緒に勉強しましょう。" }, { text: "Are you hungry?", translation: "お腹が空いていますか？" },
      { text: "Are you tired?", translation: "疲れていますか？" }, { text: "Is he your brother?", translation: "彼はあなたの兄ですか？" }, { text: "Is she your sister?", translation: "彼女はあなたの姉ですか？" }, { text: "What do you do?", translation: "あなたは何をしますか？" }, { text: "Where do you live?", translation: "どこに住んでいますか？" }, { text: "When do you study?", translation: "いつ勉強しますか？" }, { text: "Why are you sad?", translation: "なぜ悲しいのですか？" }, { text: "How do you come?", translation: "どうやって来ますか？" },
      { text: "Whose bag is this?", translation: "これは誰のかばんですか？" }, { text: "Which color do you like?", translation: "どの色が好きですか？" }, { text: "I went to the park.", translation: "私は公園に行きました。" }, { text: "I saw a movie.", translation: "私は映画を見ました。" }, { text: "He came here.", translation: "彼はここに来ました。" }, { text: "She bought a pen.", translation: "彼女はペンを買いました。" }, { text: "Did you enjoy it?", translation: "楽しみましたか？" }, { text: "Yes, I did.", translation: "はい、しました。" },
      { text: "No, I didn't.", translation: "いいえ、しませんでした。" }, { text: "I will go there.", translation: "私はそこへ行くつもりです。" }, { text: "It will rain tomorrow.", translation: "明日は雨でしょう。" }, { text: "I am reading a book.", translation: "私は本を読んでいます。" }, { text: "He is playing soccer.", translation: "彼はサッカーをしています。" }, { text: "She is watching TV.", translation: "彼女はテレビを見ています。" }, { text: "What are you doing?", translation: "何をしていますか？" }, { text: "There is a cat.", translation: "猫がいます。" },
      { text: "There are two birds.", translation: "鳥が2羽います。" }, { text: "There is an apple.", translation: "りんごがあります。" }, { text: "The dog is cute.", translation: "その犬はかわいいです。" }, { text: "The flower is red.", translation: "その花は赤いです。" }, { text: "My bag is heavy.", translation: "私のかばんは重いです。" }, { text: "His car is new.", translation: "彼の車は新しいです。" }, { text: "Her dress is nice.", translation: "彼女のドレスは素敵です。" }, { text: "Our school is big.", translation: "私たちの学校は大きいです。" },
      { text: "Their house is small.", translation: "彼らの家は小さいです。" }, { text: "I like apples.", translation: "私はりんごが好きです。" }, { text: "I want to be a doctor.", translation: "私は医者になりたいです。" }, { text: "I want to go.", translation: "私は行きたいです。" }, { text: "I like to swim.", translation: "私は泳ぐことが好きです。" }, { text: "To see is to believe.", translation: "見ることは信じることです。" }, { text: "It is fun to play.", translation: "遊ぶことは楽しいです。" }, { text: "Please help me.", translation: "私を助けてください。" },
      { text: "Give me a pen.", translation: "私にペンをください。" }, { text: "Show me your picture.", translation: "あなたの写真を見せて。" }, { text: "Tell me the truth.", translation: "本当のことを話して。" }, { text: "Have a nice day.", translation: "よい一日を。" }
    ]
  },
  Eiken4: {
      1: [
          { text: "delicious", translation: "おいしい" }, { text: "library", translation: "図書館" }, { text: "station", translation: "駅" }, { text: "hospital", translation: "病院" }, { text: "restaurant", translation: "レストラン" }, { text: "museum", translation: "博物館" }, { text: "science", translation: "科学" }, { text: "history", translation: "歴史" }, { text: "math", translation: "数学" }, { text: "subject", translation: "教科" }, { text: "homework", translation: "宿題" }, { text: "uniform", translation: "制服" },
          { text: "vacation", translation: "休暇" }, { text: "travel", translation: "旅行" }, { text: "tour", translation: "ツアー" }, { text: "ticket", translation: "チケット" }, { text: "guide", translation: "ガイド" }, { text: "passport", translation: "パスポート" }, { text: "airport", translation: "空港" }, { text: "flight", translation: "フライト" }, { text: "hotel", translation: "ホテル" }, { text: "nature", translation: "自然" }, { text: "earth", translation: "地球" }, { text: "plant", translation: "植物" },
          { text: "forest", translation: "森" }, { text: "river", translation: "川" }, { text: "ocean", translation: "海" }, { text: "weather", translation: "天気" }, { text: "environment", translation: "環境" }, { text: "garbage", translation: "ゴミ" }, { text: "recycle", translation: "リサイクル" }, { text: "energy", translation: "エネルギー" }, { text: "save", translation: "節約する、救う" }, { text: "future", translation: "未来" }, { text: "peace", translation: "平和" }, { text: "dream", translation: "夢" }
      ],
      2: [{ text: "sample phrase", translation: "サンプル熟語" }],
      3: [{ text: "This is a sample.", translation: "これはサンプルです。" }]
  }
};

const MONSTERS: Record<Level, { guide: Monster[], challenge: Monster[] }> = {
  1: {
    guide: [
      { id: 'm1_1', name: 'ねぼすけスライム', type: 'slime', color: '#87CEEB', baseHp: 150, dialogueStart: "あと5分だけ...", dialogueDefeat: "わー！遅刻するー！", theme: "Sleepy" },
      { id: 'm1_2', name: 'ちらかしゴブリン', type: 'beast', color: '#90EE90', baseHp: 180, dialogueStart: "片付けなんてやだ！", dialogueDefeat: "ピカピカにします...", theme: "Messy" },
      { id: 'm1_3', name: 'おしゃべりバード', type: 'wing', color: '#FFD700', baseHp: 200, dialogueStart: "授業中もおしゃべり！", dialogueDefeat: "静かにします...", theme: "Noisy" },
      { id: 'm1_4', name: 'つまみぐいオーク', type: 'beast', color: '#DEB887', baseHp: 220, dialogueStart: "お菓子もっとくれ！", dialogueDefeat: "お腹いっぱい...", theme: "Gluttony" },
      { id: 'm1_5', name: 'らくがき妖精', type: 'ghost', color: '#FF69B4', baseHp: 250, dialogueStart: "教科書に落書きだ！", dialogueDefeat: "消しゴムで消して〜", theme: "Art" },
      { id: 'm1_6', name: 'まいごの消しゴム', type: 'object', color: '#F0F8FF', baseHp: 280, dialogueStart: "どこいった～？", dialogueDefeat: "筆箱に戻るよ...", theme: "Lost" },
      { id: 'm1_7', name: 'そうじのホコリ', type: 'slime', color: '#D3D3D3', baseHp: 300, dialogueStart: "掃除サボっちゃえ！", dialogueDefeat: "吸い込まれる〜", theme: "Dust" },
      { id: 'm1_8', name: '給食大好きオーガ', type: 'beast', color: '#FFA500', baseHp: 350, dialogueStart: "おかわり全部よこせ！", dialogueDefeat: "みんなで食べよう...", theme: "Lunch" },
      { id: 'm1_9', name: 'としょかんミミック', type: 'object', color: '#8B4513', baseHp: 400, dialogueStart: "本を読むな〜！", dialogueDefeat: "読書って楽しいね...", theme: "Book" },
      { id: 'm1_10', name: 'ゲーム中毒ドラゴン', type: 'boss', color: '#FF4500', baseHp: 500, dialogueStart: "宿題よりゲームだ！", dialogueDefeat: "勉強もします...", theme: "Addiction" },
    ],
    challenge: [
      { id: 'c1_1', name: '暗黒スライム', type: 'slime', color: '#4B0082', baseHp: 600, dialogueStart: "すべてを飲み込む...", dialogueDefeat: "光が...眩しい...", theme: "Darkness" },
      { id: 'c1_2', name: '炎の番犬', type: 'beast', color: '#DC143C', baseHp: 800, dialogueStart: "通しはせんぞ！", dialogueDefeat: "見事だ...", theme: "Fire" },
      { id: 'c1_3', name: 'ストームウイング', type: 'wing', color: '#008080', baseHp: 1000, dialogueStart: "風より速く！", dialogueDefeat: "追いつかれたか...", theme: "Wind" },
      { id: 'c1_4', name: 'カースド・ゴースト', type: 'ghost', color: '#800080', baseHp: 1200, dialogueStart: "呪ってやる...", dialogueDefeat: "成仏します...", theme: "Curse" },
      { id: 'c1_5', name: '鉄壁のガーディアン', type: 'robot', color: '#708090', baseHp: 1500, dialogueStart: "排除シマス。", dialogueDefeat: "システムダウン...", theme: "Steel" },
      { id: 'c1_6', name: 'ギガント・ゴーレム', type: 'object', color: '#8B4513', baseHp: 1800, dialogueStart: "通さん...", dialogueDefeat: "崩れる...", theme: "Earth" },
      { id: 'c1_7', name: '魔王ドラゴニス', type: 'boss', color: '#2F4F4F', baseHp: 2000, dialogueStart: "我に挑む愚か者よ", dialogueDefeat: "貴様こそ勇者だ...", theme: "Boss" },
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
      { id: 'c2_7', name: '冥王ハーデス', type: 'boss', color: '#000000', baseHp: 3000, dialogueStart: "絶望を味わえ", dialogueDefeat: "光が戻るのか...", theme: "Death" },
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
      { id: 'c3_7', name: '終焉のドラゴン', type: 'boss', color: '#8B0000', baseHp: 5000, dialogueStart: "全てを無に還す", dialogueDefeat: "未来を託そう...", theme: "End" },
    ]
  }
};

// --- Components ---
const GameButton = ({ onClick, children, className = "", variant = "primary", disabled = false, size = "md", autoFocus = false, type = "button" }: any) => {
  const baseStyle = "relative font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 overflow-hidden border-2 rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300";
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-6 py-3", lg: "px-10 py-4 text-xl" };
  const variants = {
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
    <button ref={btnRef} type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizes[size as keyof typeof sizes]} ${variants[variant as keyof typeof variants]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
    </button>
  );
};

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
    battleLog: []
  });

  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [maxKeystrokes, setMaxKeystrokes] = useState<number>(0);
  const [weakQuestions, setWeakQuestions] = useState<Question[]>([]); 
  const [bookLevel, setBookLevel] = useState<Level>(1);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [monsterShake, setMonsterShake] = useState(false); 
  const [scoreViewDiff, setScoreViewDiff] = useState<Difficulty>('Eiken5');
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('etyping_defeated_monsters');
    if (saved) setGameState(prev => ({ ...prev, defeatedMonsterIds: JSON.parse(saved) }));
    
    const savedScores = localStorage.getItem('etyping_best_scores');
    if (savedScores) setBestScores(JSON.parse(savedScores));

    const savedMaxK = localStorage.getItem('etyping_max_keystrokes');
    if (savedMaxK) setMaxKeystrokes(parseInt(savedMaxK, 10));

    const savedWeak = localStorage.getItem('etyping_weak_questions');
    if (savedWeak) setWeakQuestions(JSON.parse(savedWeak));
  }, []);

  useEffect(() => {
    if (gameState.screen === 'battle') inputRef.current?.focus();
  }, [gameState.screen, gameState.currentQuestion]);
  
  // Keyboard Support & Right-Control Speech
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState.screen === 'battle') {
            if (e.code === 'ControlRight') {
                e.preventDefault();
                speakCurrentQuestion();
            }
        } else if (gameState.screen === 'result') {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Find primary action button and click it
                if (gameState.battleResult === 'win') {
                    const isNextAvailable = gameState.currentMonsterIndex < gameState.totalMonstersInStage - 1;
                    if (isNextAvailable) {
                         // Next Monster
                         initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex + 1, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, gameState.totalKeystrokes);
                    } else {
                         // Back to Mode Select (Complete)
                         setGameState(prev => ({ ...prev, screen: 'mode-select' }));
                    }
                } else {
                    // Retry
                    initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, 0);
                }
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const speakCurrentQuestion = () => {
      if (!gameState.currentQuestion.text) return;
      speakText(gameState.currentQuestion.text);
      setTimeout(() => inputRef.current?.focus(), 10);
  };

  const saveDefeatedMonster = (monsterId: string) => {
    setGameState(prev => {
      const uniqueKey = getUniqueKey(prev.mode, prev.inputMode, monsterId);
      if (prev.defeatedMonsterIds.includes(uniqueKey)) return prev;
      const newIds = [...prev.defeatedMonsterIds, uniqueKey];
      localStorage.setItem('etyping_defeated_monsters', JSON.stringify(newIds));
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
      localStorage.setItem('etyping_weak_questions', JSON.stringify(updatedWeak));
  };

  const handleGameEnd = (result: BattleResult, finalScore: number, history: any[], diff: Difficulty, level: Level, mode: Mode, finalKeystrokes: number, missedQs: Question[]) => {
      const key = `${diff}_${level}_${mode}`;
      const currentBest = bestScores[key] || 0;
      let isNewRecord = false;

      if (mode !== 'weakness') {
        if (finalScore > currentBest) {
            isNewRecord = true;
            const newScores = { ...bestScores, [key]: finalScore };
            setBestScores(newScores);
            localStorage.setItem('etyping_best_scores', JSON.stringify(newScores));
            soundEngine.playNewRecord();
        } else if (result === 'win') {
            soundEngine.playClear();
        } else {
            soundEngine.playFail();
        }
        if (finalKeystrokes > maxKeystrokes) {
            setMaxKeystrokes(finalKeystrokes);
            localStorage.setItem('etyping_max_keystrokes', finalKeystrokes.toString());
        }
      } else {
          if (result === 'win') soundEngine.playClear();
          else soundEngine.playFail();
      }
      saveWeakQuestions(missedQs);
      setGameState(prev => ({ ...prev, screen: 'result', battleResult: result, score: finalScore, history: history, isNewRecord: isNewRecord, missCount: 0, hintLength: 0 }));
  };

  const startGame = (diff: Difficulty, level: Level, mode: Mode, inputMode: InputMode) => {
    const monstersObj = MONSTERS[level];
    let selectedList: Monster[] = [];
    let indices: number[] = [];
    let totalStageMonsters = 0;

    // --- MODE CONFIGURATION ---
    const GUIDE_TARGET_COUNT = 3;
    const CHALLENGE_TARGET_COUNT = 3; 
    const NORMAL_TARGET_COUNT = 5;
    const HARD_TARGET_COUNT = 7;

    const findStageIndices = (list: Monster[], targetMode: Mode, targetInputMode: InputMode, countToSelect: number, rangeLimit: number) => {
        const pool = list.slice(0, rangeLimit); 
        const unDefeated = pool.map((m, i) => ({m, i})).filter(x => !gameState.defeatedMonsterIds.includes(getUniqueKey(targetMode, targetInputMode, x.m.id)));
        let resultIndices: number[] = [];
        if (unDefeated.length > 0) {
            resultIndices.push(unDefeated[0].i); 
        } else {
             resultIndices.push(Math.floor(Math.random() * pool.length));
        }
        while(resultIndices.length < countToSelect) {
            resultIndices.push(Math.floor(Math.random() * pool.length));
        }
        return resultIndices;
    };

    if (mode === 'guide') {
      selectedList = monstersObj.guide;
      indices = findStageIndices(selectedList, 'guide', 'voice-text', GUIDE_TARGET_COUNT, GUIDE_TARGET_COUNT); 
      totalStageMonsters = GUIDE_TARGET_COUNT;
    } else if (mode === 'weakness') {
        if (weakQuestions.length === 0) { alert("まだ苦手な単語がありません！"); return; }
        selectedList = monstersObj.guide; 
        const count = Math.min(weakQuestions.length, 10);
        indices = Array.from({length: count}, (_, i) => i % selectedList.length);
        totalStageMonsters = count;
    } else {
      if (inputMode === 'voice-text') {
        selectedList = monstersObj.guide;
        indices = findStageIndices(selectedList, 'challenge', 'voice-text', CHALLENGE_TARGET_COUNT, CHALLENGE_TARGET_COUNT);
        totalStageMonsters = CHALLENGE_TARGET_COUNT;
      } else if (inputMode === 'voice-only') {
        selectedList = monstersObj.challenge;
        // Normal Mode: Fixed order, 5 monsters. No randomization.
        indices = [0, 1, 2, 3, 4];
        totalStageMonsters = NORMAL_TARGET_COUNT;
      } else {
        selectedList = monstersObj.challenge;
        // Hard Mode: Fixed order, 7 monsters.
        indices = [0, 1, 2, 3, 4, 5, 6];
        totalStageMonsters = HARD_TARGET_COUNT;
      }
    }

    let startStep = 0;
    // For Fixed Order modes (Normal/Hard), resume from first undefeated if available
    // But allow replay from start if all cleared.
    if (mode === 'challenge' && inputMode !== 'voice-text') {
         for (let i = 0; i < indices.length; i++) {
            const uniqueKey = getUniqueKey(mode, inputMode, selectedList[indices[i]].id);
            if (!gameState.defeatedMonsterIds.includes(uniqueKey)) {
                startStep = i;
                break;
            }
        }
        // If startStep remains 0, it means either none defeated or all defeated.
        // We want to start from 0 in both cases (Standard start or Replay).
    }

    initBattle(diff, level, mode, inputMode, startStep, indices, selectedList, totalStageMonsters, 0, 0);
  };

  const initBattle = (diff: Difficulty, level: Level, mode: Mode, inputMode: InputMode, stepIndex: number, indices: number[], monsterList: Monster[], totalMonsters: number, currentScore: number, currentKeystrokes: number) => {
    const actualMonsterIndex = indices[stepIndex];
    const startingMonster = monsterList[actualMonsterIndex];
    let question: Question;
    if (mode === 'weakness') {
        if (weakQuestions.length > 0) { question = weakQuestions[Math.floor(Math.random() * weakQuestions.length)]; } 
        else { question = { text: "No Weakness", translation: "苦手なし" }; }
    } else {
        question = getRandomQuestion(diff, level, null);
    }

    setGameState(prev => ({
      ...prev, screen: 'battle', selectedDifficulty: diff, selectedLevel: level, mode: mode, inputMode: inputMode,
      currentMonsterIndex: stepIndex, currentMonsterList: monsterList, challengeModeIndices: indices,
      monsterHp: startingMonster.baseHp, maxMonsterHp: startingMonster.baseHp, score: currentScore, combo: 0,
      currentQuestion: question, userInput: "", startTime: null, history: [], questionCount: 1, maxQuestions: 10,
      battleResult: null, totalMonstersInStage: totalMonsters, isNewRecord: false, missCount: 0,
      totalKeystrokes: currentKeystrokes, hintLength: 0, currentBattleMissedQuestions: [],
      battleLog: [] 
    }));
  };

  const getRandomQuestion = (diff: Difficulty, level: Level, currentQ: Question | null): Question => {
    const list = QUESTIONS[diff]?.[level] || []; 
    if (list.length === 0) return { text: "No Data", translation: "データがありません" };
    let nextQ = list[Math.floor(Math.random() * list.length)];
    if (currentQ && list.length > 1 && nextQ.text === currentQ.text) nextQ = list[Math.floor(Math.random() * list.length)];
    return nextQ;
  };

  const handleSkip = () => { advanceGame(0, 0, true, 0); inputRef.current?.focus(); };

  const advanceGame = (damage: number, speed: number, skipped: boolean, addedChars: number) => {
    let nextHp = skipped ? gameState.monsterHp : Math.max(0, gameState.monsterHp - damage);
    let isMonsterDefeated = !skipped && nextHp <= 0;
    const currentScore = gameState.score + damage;
    const nextKeystrokes = gameState.totalKeystrokes + addedChars;
    const newHistory = [...gameState.history, { damage, speed }];

    let newMissedQs = [...gameState.currentBattleMissedQuestions];
    if (gameState.missCount > 0 && !newMissedQs.some(q => q.text === gameState.currentQuestion.text)) { newMissedQs.push(gameState.currentQuestion); }
    
    if (gameState.mode === 'weakness' && gameState.missCount === 0) {
        const updatedWeak = weakQuestions.filter(q => q.text !== gameState.currentQuestion.text);
        setWeakQuestions(updatedWeak);
        localStorage.setItem('etyping_weak_questions', JSON.stringify(updatedWeak));
    }

    const logItem: BattleLogItem = {
        question: gameState.currentQuestion,
        missCount: skipped ? -1 : gameState.missCount, 
        skipped: skipped
    };
    const newBattleLog = [...gameState.battleLog, logItem];

    if (isMonsterDefeated) {
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      
      const actualId = gameState.challengeModeIndices[gameState.currentMonsterIndex];
      const monster = gameState.currentMonsterList[actualId];
      
      if (gameState.mode !== 'weakness') { 
          saveDefeatedMonster(monster.id); 
      }

      const isLastMonster = gameState.currentMonsterIndex >= gameState.totalMonstersInStage - 1;

      setTimeout(() => {
          if (isLastMonster) soundEngine.playStageClear(); 
          handleGameEnd('win', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs);
      }, 800); 

      setGameState(prev => ({ ...prev, monsterHp: 0, score: currentScore, history: newHistory, totalKeystrokes: nextKeystrokes, currentBattleMissedQuestions: newMissedQs, battleLog: newBattleLog }));
      return;
    }

    if (gameState.questionCount >= gameState.maxQuestions) {
       handleGameEnd('draw', currentScore, newHistory, gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, nextKeystrokes, newMissedQs);
       return;
    }

    let nextQ: Question = (gameState.mode === 'weakness' && weakQuestions.length > 0) ? weakQuestions[Math.floor(Math.random() * weakQuestions.length)] : getRandomQuestion(gameState.selectedDifficulty, gameState.selectedLevel, gameState.currentQuestion);
    
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
    let finalDamage = Math.floor(baseDamage * speedMultiplier);
    if (gameState.mode === 'guide') finalDamage = Math.floor(finalDamage * 0.3);
    if (gameState.missCount > 0) { finalDamage = Math.max(1, Math.floor(finalDamage * 0.5)); }
    if (speedMultiplier >= 2.0 && gameState.missCount === 0) { soundEngine.playCritical(); } else { soundEngine.playAttack(); }
    setMonsterShake(true);
    setTimeout(() => setMonsterShake(false), 400); 
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
    if (gameState.screen === 'battle' && gameState.inputMode !== 'text-only' && gameState.monsterHp > 0) speakText(gameState.currentQuestion.text);
  }, [gameState.currentQuestion, gameState.screen]);

  // --- Screens ---
  const ScreenContainer = ({ children, className = "" }: any) => (
    <div className={`min-h-screen font-sans text-slate-100 flex flex-col relative ${className}`}>
      <div className="fixed inset-0 z-0 bg-slate-900">
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
         <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-slate-900/80"></div>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center w-full overflow-y-auto">{children}</div>
    </div>
  );

  const Box = ({ children, className = "", title }: any) => (
    <div className={`bg-slate-800/90 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm ${className}`}>
      {title && (<div className="bg-slate-700/80 px-4 py-2 border-b border-slate-600 font-bold text-slate-200 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div>{title}</div>)}
      <div className="p-6">{children}</div>
    </div>
  );

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
                <div className="flex justify-center gap-4 mb-6">
                   <button onClick={() => setScoreViewDiff('Eiken5')} className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${scoreViewDiff === 'Eiken5' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>英検5級</button>
                   <button onClick={() => setScoreViewDiff('Eiken4')} className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${scoreViewDiff === 'Eiken4' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>英検4級</button>
                </div>
                <Box title={`${scoreViewDiff} Records`} className="w-full">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead><tr className="border-b-2 border-slate-600 text-slate-400 text-sm uppercase"><th className="p-4">Level</th><th className="p-4 text-center text-blue-300">Training (Guide)</th><th className="p-4 text-center text-red-300">Battle (Challenge)</th></tr></thead>
                            <tbody className="divide-y divide-slate-700">
                                {[1, 2, 3].map((lvl) => {
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
    const allMonsters = [...monstersObj.guide, ...monstersObj.challenge];
    const uniqueDefeatedIds = new Set(gameState.defeatedMonsterIds.map(key => extractMonsterId(key)));
    const totalDefeated = [...uniqueDefeatedIds].filter(id => allMonsters.some(m => m.id === id)).length;
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-6xl w-full p-4">
           <div className="flex justify-between items-center mb-6">
              <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-4 py-2 rounded-full shadow-sm text-yellow-400"><Trophy size={20} /><span className="font-bold">撃破数: {totalDefeated} / {allMonsters.length}</span></div>
           </div>
           <Box title={`Monster Collection - Level ${bookLevel}`} className="w-full">
               <div className="flex justify-center gap-4 mb-8">{[1, 2, 3].map((lvl) => (<button key={lvl} onClick={() => setBookLevel(lvl as Level)} className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${bookLevel === lvl ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>レベル {lvl}</button>))}</div>
               <div className="mb-8">
                 <h3 className="text-blue-300 font-bold mb-4 flex items-center gap-2 text-xl"><Shield size={20} /> 練習エリア (Training Zone)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {monstersObj.guide.map((m) => {
                      const isDefeated = uniqueDefeatedIds.has(m.id);
                      return (<div key={m.id} className={`relative p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all border-2 ${isDefeated ? 'bg-slate-700/50 border-slate-500' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>{isDefeated ? (<><div className="mb-2 scale-75"><MonsterAvatar type={m.type} color={m.color} size={100} /></div><div className="font-bold text-sm text-blue-300 mb-1">{m.name}</div><div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">{m.theme}</div><div className="absolute top-2 right-2 text-yellow-400"><Star size={16} fill="currentColor" /></div></>) : (<><div className="mb-2 scale-75 opacity-30 grayscale filter blur-[1px]"><MonsterAvatar type={m.type} color={m.color} size={100} /></div><div className="font-bold text-sm text-slate-600 mb-1">???</div><div className="absolute top-2 right-2 text-slate-700"><Lock size={16} /></div></>)}</div>);
                    })}
                 </div>
               </div>
               <div>
                 <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2 text-xl"><Skull size={20} /> 危険エリア (Danger Zone)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {monstersObj.challenge.map((m) => {
                      const isDefeated = uniqueDefeatedIds.has(m.id);
                      return (<div key={m.id} className={`relative p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all border-2 ${isDefeated ? 'bg-red-900/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>{isDefeated ? (<><div className="mb-2 scale-90"><MonsterAvatar type={m.type} color={m.color} size={100} /></div><div className="font-bold text-sm text-red-300 mb-1">{m.name}</div><div className="text-xs text-red-200 bg-red-900/50 px-2 py-1 rounded-full">{m.theme}</div><div className="absolute top-2 right-2 text-yellow-400"><Star size={16} fill="currentColor" /></div></>) : (<><div className="mb-2 scale-90 opacity-30 grayscale filter blur-[1px]"><MonsterAvatar type={m.type} color={m.color} size={100} /></div><div className="font-bold text-sm text-slate-600 mb-1">???</div><div className="absolute top-2 right-2 text-slate-700"><Lock size={16} /></div></>)}</div>);
                    })}
                 </div>
               </div>
           </Box>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'question-list') {
    const questions = QUESTIONS[gameState.selectedDifficulty][gameState.selectedLevel] || [];
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-4xl w-full p-4 h-full flex flex-col">
           <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <GameButton size="sm" variant="outline" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))}>&larr; タイトルへ</GameButton>
              <h2 className="text-2xl font-bold text-blue-300 flex items-center gap-2"><ClipboardList /> 問題リスト (Word List)</h2>
           </div>
           <div className="flex flex-col md:flex-row gap-4 mb-6 flex-shrink-0">
               <div className="flex bg-slate-800 p-1 rounded-lg">{(['Eiken5', 'Eiken4'] as Difficulty[]).map(d => (<button key={d} onClick={() => setGameState(prev => ({ ...prev, selectedDifficulty: d }))} className={`px-4 py-2 rounded-md font-bold transition-colors ${gameState.selectedDifficulty === d ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{d === 'Eiken5' ? '英検5級' : '英検4級'}</button>))}</div>
               <div className="flex bg-slate-800 p-1 rounded-lg">{([1, 2, 3] as Level[]).map(l => (<button key={l} onClick={() => setGameState(prev => ({ ...prev, selectedLevel: l }))} className={`px-4 py-2 rounded-md font-bold transition-colors ${gameState.selectedLevel === l ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Level {l}</button>))}</div>
           </div>
           <div className="flex-1 min-h-0">
               <Box className="h-full flex flex-col" title={`${gameState.selectedDifficulty === 'Eiken5' ? '英検5級' : '英検4級'} - Level ${gameState.selectedLevel} (${questions.length} words)`}>
                   <div className="overflow-y-auto pr-2 custom-scrollbar flex-1"><div className="grid gap-2 pb-4">{questions.map((q, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors group"><div className="flex items-center gap-4"><button onClick={() => speakText(q.text)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white transition-colors flex-shrink-0"><Volume2 size={16} /></button><span className="text-lg md:text-xl font-mono text-blue-100 font-bold break-all">{q.text}</span></div><span className="text-slate-300 font-bold text-sm md:text-base ml-4 text-right flex-shrink-0">{q.translation}</span></div>))}</div></div>
               </Box>
           </div>
        </div>
        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }`}</style>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'title') {
    const allMonsterIds = Object.values(MONSTERS).flatMap(lvl => [...lvl.guide, ...lvl.challenge]).map(m => m.id);
    const uniqueDefeatedIds = new Set(gameState.defeatedMonsterIds.map(key => extractMonsterId(key)));
    const totalDefeated = [...uniqueDefeatedIds].filter(id => allMonsterIds.includes(id)).length;
    const totalMonsters = allMonsterIds.length;
    const rank = getRankData(totalDefeated);
    const weakCount = weakQuestions.length;

    return (
      <ScreenContainer>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[url('https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2544&auto=format&fit=crop')] bg-cover bg-center">
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"></div>
            <div className="relative z-10 flex flex-col items-center md:max-w-5xl w-full">
                <div className="mb-6 animate-pulse"><Sword size={80} className="text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]" /></div>
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-300 to-blue-600 mb-2 drop-shadow-sm filter">English Typing</h1>
                <h2 className="text-5xl md:text-6xl font-black text-yellow-400 mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">FANTASY</h2>
                <div className="mb-8 flex flex-col md:flex-row gap-4 w-full justify-center">
                     <div className="flex items-center gap-2 bg-gradient-to-r from-red-900 to-slate-900 border border-yellow-500/50 px-6 py-3 rounded-full text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.3)] backdrop-blur-sm"><Trophy size={20} className="text-yellow-400" /><span className="font-bold text-lg tracking-wide">撃破数: <span className="text-white text-xl mx-1">{totalDefeated}</span> / {totalMonsters}</span></div>
                     <div className="flex items-center gap-2 bg-slate-800/80 px-6 py-3 rounded-full text-blue-300 shadow-md border border-slate-600"><Keyboard size={20} className="text-blue-400" /><span className="font-bold text-sm">最高入力: <span className="text-white font-mono text-xl mx-1">{maxKeystrokes}</span></span></div>
                     <div className="text-sm font-bold bg-black/50 px-6 py-3 rounded-full border border-slate-600 flex items-center gap-2"><Medal size={20} className={rank.color} /><span className={rank.color}>{rank.title}</span></div>
                </div>
                <div className="w-full space-y-4 max-w-4xl">
                     <GameButton onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'weakness', 'text-only')} className={`w-full ${weakCount > 0 ? 'bg-gradient-to-r from-orange-600 to-red-600 border-orange-400 text-white animate-pulse' : 'bg-slate-700 border-slate-500 text-slate-400'}`} size="lg" disabled={weakCount === 0}><div className="flex items-center justify-center gap-2"><Flame size={24} className={weakCount > 0 ? "text-yellow-300" : "text-slate-500"} /><span className="font-bold">{weakCount > 0 ? `苦手特訓 (Weakness: ${weakCount})` : "苦手な単語はありません"}</span></div></GameButton>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, selectedDifficulty: 'Eiken5', screen: 'level-select' }))} className="w-full" size="lg" variant="primary">英検 5級 (Grade 5)</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, selectedDifficulty: 'Eiken4', screen: 'level-select' }))} className="w-full" size="lg" variant="secondary">英検 4級 (Grade 4)</GameButton>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
                         <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'monster-book' }))} variant="outline" className="px-2"><BookOpen size={20} /> 図鑑</GameButton>
                         <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'rank-list' }))} variant="outline" className="px-2 text-yellow-300 border-yellow-700/50 hover:border-yellow-400"><Crown size={20} /> 称号</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'score-view' }))} variant="outline" className="px-2 border-slate-600 text-slate-300">Records</GameButton>
                        <GameButton onClick={() => setGameState(prev => ({ ...prev, screen: 'question-list' }))} variant="outline" className="px-2 border-slate-600 text-slate-300">Word List</GameButton>
                        <GameButton onClick={() => setShowHelp(true)} variant="outline" className="px-2 border-slate-600 text-slate-300"><AlertCircle size={16} /> ヘルプ</GameButton>
                    </div>
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
                            <GameButton onClick={() => setShowHelp(false)} variant="outline" size="sm">閉じる</GameButton>
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
    return (
      <ScreenContainer className="bg-slate-900">
        <div className="max-w-5xl w-full p-4 mt-10">
          <GameButton size="sm" variant="ghost" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))} className="mb-6 text-slate-400 hover:text-white">&larr; 戻る</GameButton>
          <h2 className="text-3xl font-bold mb-8 text-center text-blue-300 tracking-widest border-b border-slate-700 pb-4">レベルをえらぶ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">{[1, 2, 3].map((lvl) => (<div key={lvl} className="group bg-slate-800 border-2 border-slate-600 hover:border-blue-400 rounded-xl overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1"><div className={`h-32 flex items-center justify-center text-6xl bg-gradient-to-br ${lvl===1 ? 'from-blue-900 to-slate-900' : lvl===2 ? 'from-green-900 to-slate-900' : 'from-red-900 to-slate-900'}`}>{lvl === 1 ? '⚔️' : lvl === 2 ? '🛡️' : '📜'}</div><div className="p-6"><h3 className="text-2xl font-bold mb-2 text-white">LEVEL {lvl}</h3><p className="text-slate-400 mb-6 text-sm">{lvl === 1 ? "Short Words (単語)" : lvl === 2 ? "Phrases (熟語)" : "Sentences (文章)"}</p><GameButton className="w-full" variant="outline" onClick={() => setGameState(prev => ({ ...prev, selectedLevel: lvl as Level, screen: 'mode-select' }))}>決定</GameButton></div></div>))}</div>
        </div>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'mode-select') {
    const monstersObj = MONSTERS[gameState.selectedLevel];
    
    // --- MODE CONFIGURATION ---
    const GUIDE_TARGET_COUNT = 3;
    const CHALLENGE_TARGET_COUNT = 3; 
    const NORMAL_TARGET_COUNT = 5;
    const HARD_TARGET_COUNT = 7;

    // Helper to check progress against the LIMITED target count
    const getModeProgress = (list: Monster[], mode: Mode, inputMode: InputMode, targetCount: number) => {
        // Only check the monsters within the target range for "Complete" status
        const targetList = list.slice(0, targetCount);
        const nextMonster = targetList.find(m => !gameState.defeatedMonsterIds.includes(getUniqueKey(mode, inputMode, m.id)));
        
        return {
            nextTargetName: nextMonster?.name || null,
            isComplete: !nextMonster,
        };
    };

    const guideStatus = getModeProgress(monstersObj.guide, 'guide', 'voice-text', GUIDE_TARGET_COUNT);
    const easyStatus = getModeProgress(monstersObj.guide, 'challenge', 'voice-text', CHALLENGE_TARGET_COUNT);
    const normalStatus = getModeProgress(monstersObj.challenge, 'challenge', 'voice-only', NORMAL_TARGET_COUNT);
    const hardStatus = getModeProgress(monstersObj.challenge, 'challenge', 'text-only', HARD_TARGET_COUNT);

    return (
      <ScreenContainer className="bg-slate-900 flex items-center justify-center">
        <Box className="max-w-5xl w-full" title="モードをえらぶ">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-slate-800/50 rounded-xl p-4 border-2 border-blue-900/50 flex flex-col">
                <div className="flex items-center gap-3 mb-6 border-b border-blue-800/50 pb-4"><div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center"><Brain className="text-blue-300" /></div><div><h3 className="text-xl font-bold text-blue-200">TRAINING ZONE</h3><p className="text-xs text-blue-400">まずはここで練習しよう！(3体)</p></div></div>
                <div className="space-y-4 flex-1">
                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'guide', 'voice-text')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${guideStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-blue-900/20 border border-blue-700/30 hover:bg-blue-800/40 hover:border-blue-500'}`}>
                        {guideStatus.isComplete && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${guideStatus.isComplete ? 'text-yellow-200' : 'text-blue-100 group-hover:text-white'}`}>🛡️ Basic Training</span>
                            {!guideStatus.isComplete && <span className="text-[10px] bg-blue-900 text-blue-300 px-2 py-0.5 rounded">基礎</span>}
                        </div>
                        <p className={`text-xs mb-2 ${guideStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>スペルを見て入力。指の運動に最適！</p>
                        {guideStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">免許皆伝！次のレベルへ！</span></div> 
                            : <span className="text-xs text-blue-300 flex items-center gap-1"><Target size={12}/> NEXT: {guideStatus.nextTargetName}</span>}
                    </button>

                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'challenge', 'voice-text')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${easyStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-indigo-900/20 border border-indigo-700/30 hover:bg-indigo-800/40 hover:border-indigo-500'}`}>
                        {easyStatus.isComplete && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>}
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${easyStatus.isComplete ? 'text-yellow-200' : 'text-indigo-100 group-hover:text-white'}`}>🔊 Listening Training</span>
                            {!easyStatus.isComplete && <span className="text-[10px] bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">初級</span>}
                        </div>
                        <p className={`text-xs mb-2 ${easyStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>音声＋日本語。スペルは隠れます。</p>
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
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${normalStatus.isComplete ? 'text-yellow-200' : 'text-orange-100 group-hover:text-white'}`}>👂 Battle Quest (Normal)</span>
                            {!normalStatus.isComplete && <span className="text-[10px] bg-orange-900 text-orange-300 px-2 py-0.5 rounded">5体</span>}
                        </div>
                        <p className={`text-xs mb-2 ${normalStatus.isComplete ? 'text-yellow-100' : 'text-slate-400'}`}>音声のみで入力。耳を頼りに戦え！</p>
                        {normalStatus.isComplete ? 
                            <div className="flex items-center gap-2 mt-2 font-bold text-yellow-300"><Crown size={16}/> <span className="text-sm">見事！次はHardモードだ！</span></div> 
                            : <span className="text-xs text-orange-300 flex items-center gap-1"><Target size={12}/> NEXT: {normalStatus.nextTargetName}</span>}
                    </button>

                    <button onClick={() => startGame(gameState.selectedDifficulty, gameState.selectedLevel, 'challenge', 'text-only')} className={`w-full text-left p-4 rounded-lg transition-all group relative overflow-hidden ${hardStatus.isComplete ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gradient-to-r from-red-900/40 to-slate-900/40 border border-red-500/50 hover:border-red-400 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]'}`}>
                         {hardStatus.isComplete ? 
                            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-bl">MASTERED</div>
                            : <div className="absolute -top-2 -right-2 text-2xl animate-bounce">👑</div>
                         }
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold text-lg ${hardStatus.isComplete ? 'text-yellow-200' : 'text-red-100 group-hover:text-white'}`}>🦸 Hero Quest (Hard)</span>
                            {!hardStatus.isComplete && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">7体</span>}
                        </div>
                        <p className={`text-xs mb-2 ${hardStatus.isComplete ? 'text-yellow-100' : 'text-red-200'}`}>日本語のみで入力。これができれば免許皆伝！</p>
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
    const actualMonsterId = gameState.challengeModeIndices[gameState.currentMonsterIndex];
    const currentMonster = gameState.currentMonsterList[actualMonsterId];
    const hpPercent = (gameState.monsterHp / gameState.maxMonsterHp) * 100;
    const isBoss = currentMonster.type === 'boss';
    const showJapanese = gameState.inputMode !== 'voice-only';
    const showGuide = gameState.mode === 'guide'; 
    const questionsLeft = gameState.maxQuestions - gameState.questionCount + 1;
    const monsterEmotion = gameState.monsterHp <= 0 ? 'win' : flash ? 'damage' : 'normal';

    return (
      <ScreenContainer className={isBoss ? "bg-red-950" : "bg-slate-900"}>
        <div className="w-full bg-slate-900/80 border-b border-slate-700 p-2 z-20 flex justify-between items-center shadow-md">
             <GameButton size="sm" variant="ghost" onClick={() => setGameState(prev => ({ ...prev, screen: 'title' }))} className="text-slate-400 text-xs py-1"><Home size={16} /> EXIT</GameButton>
             <div className="flex gap-4"><div className="bg-black/50 border border-slate-600 px-3 py-1 rounded-full text-slate-300 text-xs font-mono flex items-center gap-2"><Trophy size={14} className="text-yellow-500"/> SCORE: {gameState.score}</div><div className="bg-red-900/50 border border-red-500/50 px-3 py-1 rounded-full text-red-200 text-xs font-bold">あと {questionsLeft}問</div></div>
        </div>
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-start mt-4 px-4 pb-20">
            <div className="relative w-full flex flex-col items-center z-10 mb-4">
                <div className={`transition-all duration-300 ${flash ? 'scale-110' : ''} mb-2`}><div className="inline-block bg-white text-slate-900 px-4 py-1.5 rounded-xl shadow-lg border-2 border-slate-200 font-bold relative text-xs">{gameState.monsterHp <= 0 ? currentMonster.dialogueDefeat : currentMonster.dialogueStart}<div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-b-2 border-r-2 border-slate-200"></div></div></div>
                <div className={`transition-transform duration-100 relative ${flash ? 'translate-x-2 -translate-y-2 brightness-150 saturate-150' : monsterShake ? 'animate-shake brightness-110' : 'animate-bounce-slow'}`}><MonsterAvatar type={currentMonster.type} color={currentMonster.color} emotion={monsterEmotion} size={140} />{isBoss && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded animate-pulse">BOSS</div>}</div>
                <div className="w-64 mt-2 bg-slate-800/80 p-2 rounded-lg border border-slate-600"><div className="flex justify-between text-slate-300 text-[10px] font-bold mb-1 px-1"><span className="flex items-center gap-2">{currentMonster.name} <span className="bg-slate-700 px-1 rounded text-slate-400">Lv.{gameState.currentMonsterIndex + 1}</span></span><span>{gameState.monsterHp} / {gameState.maxMonsterHp}</span></div><div className="h-3 bg-slate-900 rounded-full overflow-hidden relative shadow-inner"><div className={`h-full transition-all duration-300 relative overflow-hidden ${hpPercent < 30 ? 'bg-red-600' : 'bg-green-500'}`} style={{ width: `${hpPercent}%` }}><div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div></div></div></div>
            </div>
            <div className="w-full bg-slate-800/95 backdrop-blur border-4 border-slate-600 rounded-2xl shadow-xl p-4 mt-4 relative">
                 <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div><div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-slate-600 shadow-inner"></div>
                 <button onClick={handleSkip} className="absolute top-2 right-6 text-slate-500 hover:text-white flex items-center gap-1 text-[10px] font-bold transition-colors border border-slate-600 px-2 py-1 rounded hover:bg-slate-700">SKIP <SkipForward size={10} /></button>
                 <div className="text-center mb-2 min-h-[24px]">{showJapanese && <p className="text-blue-300 text-lg md:text-xl font-bold drop-shadow-md">{gameState.currentQuestion.translation}</p>}</div>
                 <div className="relative py-3 bg-black/40 rounded-xl border border-slate-700 shadow-inner">
                    <div className="absolute top-1/2 left-3 -translate-y-1/2 z-20">
                         {/* Button type='button' ensures it doesn't trigger form submits and behavior */}
                         <button type="button" onClick={() => speakCurrentQuestion()} className="text-slate-500 hover:text-blue-400 transition-colors p-2 -ml-2"><Volume2 size={24} /></button>
                    </div>
                    <div className="text-3xl md:text-5xl font-mono text-center pointer-events-none select-none tracking-wide text-slate-600 relative z-10 min-h-[1.5em] flex items-center justify-center">
                        {gameState.currentQuestion.text.split('').map((char, index) => {
                            const isTyped = index < gameState.userInput.length;
                            const isCurrent = index === gameState.userInput.length;
                            const isHint = !isTyped && (index < gameState.userInput.length + gameState.hintLength);
                            const isAlwaysVisible = showGuide;
                            let className = "inline-block min-w-[0.6em] transition-colors duration-100 ";
                            if (isTyped) { className += "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]"; } else if (isCurrent) { className += "text-white border-b-4 border-yellow-400 animate-pulse pb-1"; if (char === ' ') className += " bg-yellow-500/30"; } else if (isHint) { className += "text-slate-400/80"; } else if (isAlwaysVisible) { className += "text-slate-300"; } else { className += "opacity-0"; }
                            return <span key={index} className={className}>{(!isTyped && !isHint && !isAlwaysVisible && isCurrent) ? '_' : (char === ' ' ? '\u00A0' : char)}</span>;
                        })}
                    </div>
                    <input ref={inputRef} type="text" value={gameState.userInput} onChange={handleInput} className="w-full h-full opacity-0 absolute inset-0 cursor-default z-20" autoComplete="off" autoFocus />
                 </div>
            </div>
             <div className="mt-2 text-center"><span className="text-slate-500 text-[10px] uppercase tracking-widest border border-slate-700 px-2 py-0.5 rounded bg-slate-900">Type the spell to attack</span></div>
        </div>
        <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } .animate-shake { animation: shake 0.3s ease-in-out; } .animate-bounce-slow { animation: bounce 2s infinite; }`}</style>
      </ScreenContainer>
    );
  }

  if (gameState.screen === 'result') {
    const isWin = gameState.battleResult === 'win';
    // Determine if next monster is available based on totalMonstersInStage
    // Guide/Easy have 3, Normal 5, Hard 7.
    // If current index < total - 1, we can go next.
    const isNextAvailable = gameState.currentMonsterIndex < gameState.totalMonstersInStage - 1;
    
    const handleNextMonster = () => initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex + 1, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, gameState.totalKeystrokes);
    const handleRetry = () => initBattle(gameState.selectedDifficulty, gameState.selectedLevel, gameState.mode, gameState.inputMode, gameState.currentMonsterIndex, gameState.challengeModeIndices, gameState.currentMonsterList, gameState.totalMonstersInStage, gameState.score, 0);
    const handleBackToMode = () => setGameState(prev => ({ ...prev, screen: 'mode-select' }));
    const handleBackToLevel = () => setGameState(prev => ({ ...prev, screen: 'level-select' }));
    const handleBackToTitle = () => setGameState(prev => ({ ...prev, screen: 'title' }));

    return (
      <ScreenContainer className="items-center justify-center p-4">
        {/* Main Result Box - Scrollable if content is long, but constrained to viewport */}
        <Box className="max-w-xl w-full text-center border-4 border-yellow-600/50 bg-slate-800 relative flex flex-col max-h-full">
          {gameState.isNewRecord && (<div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-black text-xl shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-bounce z-50 whitespace-nowrap">👑 NEW RECORD! 👑</div>)}
          
          <div className="mb-4 flex-shrink-0">
              {isWin ? (
                <>
                  <div className="mb-2 animate-bounce"><Trophy size={60} className="text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" /></div>
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-1">CLEAR!</h2>
                  <p className="text-slate-400 text-sm">モンスターをやっつけた！</p>
                </>
              ) : (
                 <>
                  <div className="mb-2"><Zap size={60} className="text-slate-600 mx-auto" /></div>
                  <h2 className="text-3xl font-black text-slate-400 mb-1">ざんねん...</h2>
                  <p className="text-slate-500 text-sm">にげられてしまった！</p>
                </>
              )}
          </div>

          {/* Battle Review Log - Flexible height */}
          <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-left min-h-[150px]">
             <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 sticky top-0 bg-slate-900/90 p-1 border-b border-slate-700">Battle Review</h3>
             <div className="space-y-1">
                 {gameState.battleLog.map((log, idx) => (
                     <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-800 border border-slate-700 text-xs">
                         <div className="flex flex-col">
                             <span className="font-mono text-blue-200 font-bold">{log.question.text}</span>
                             <span className="text-slate-500">{log.question.translation}</span>
                         </div>
                         <div className="flex items-center">
                             {log.skipped ? 
                                <span className="text-slate-500 flex items-center gap-1"><FastForward size={14}/> Skip</span> :
                                log.missCount === 0 ? 
                                <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={14}/> Perfect</span> :
                                <span className="text-yellow-500 flex items-center gap-1"><AlertCircle size={14}/> Cleared</span>
                             }
                         </div>
                     </div>
                 ))}
             </div>
          </div>

          <div className="space-y-3 mt-auto flex-shrink-0">
              {isWin ? (
                  isNextAvailable ? (
                    <GameButton onClick={handleNextMonster} className="w-full text-lg py-3" variant="success" autoFocus>つぎのモンスターへ <ArrowRight className="ml-2" size={20}/></GameButton>
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
        </Box>
        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }`}</style>
      </ScreenContainer>
    );
  }
  return <div>Loading...</div>;
}