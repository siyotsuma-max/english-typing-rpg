import { BookOpen, Brain, LayoutGrid, Sword, Target } from 'lucide-react';

type HelpScreenProps = {
  onBack: () => void;
};

export default function HelpScreen({ onBack }: HelpScreenProps) {
  return (
    <div className="min-h-screen bg-slate-900 px-4 py-6 text-white">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 rounded-full border border-slate-600 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-slate-400 hover:text-white"
        >
          &larr; タイトルへ
        </button>

        <div className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 shadow-2xl md:p-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_58%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(12,18,32,0.92))] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">How To Play</p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">英語を覚えて、そのまま戦えるようになるゲームです。</h1>
              <p className="mt-3 text-sm leading-7 text-slate-200 md:text-base">
                単語や表現を見て、聞いて、正しく打つことをくり返しながら覚えていきます。
                1回で完璧を目指さなくて大丈夫です。少しずつ倒せる敵が増えていく感覚を楽しんでください。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-blue-200">
                  <Sword size={18} />
                  <h2 className="text-lg font-black text-white">まずはこう進めます</h2>
                </div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                  <p>1. 難易度を選ぶ</p>
                  <p>2. Level を選ぶ</p>
                  <p>3. まずは Basic Training から始める</p>
                  <p>4. 慣れてきたら Listening Battle や Translation Battle に進む</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Target size={18} />
                  <h2 className="text-lg font-black text-white">戦い方の基本</h2>
                </div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                  <p>英語を正しく打てると敵にダメージを与えます。</p>
                  <p>ミスが少ないほど有利です。</p>
                  <p>ボス戦では決められた問題数の中で倒し切れば勝利です。</p>
                  <p>Challenge Mode の最後には、さらに強い裏ボスも待っています。</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 text-violet-200">
                <LayoutGrid size={18} />
                <h2 className="text-lg font-black text-white">モードの使い分け</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <p className="font-bold text-white">Basic Training</p>
                  <p className="mt-1">まず覚えるための基本モードです。</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <p className="font-bold text-white">Listening Training</p>
                  <p className="mt-1">音を聞いて覚える練習です。</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <p className="font-bold text-white">Listening Battle</p>
                  <p className="mt-1">音声だけを頼りに戦うチャレンジです。</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <p className="font-bold text-white">Translation Battle</p>
                  <p className="mt-1">日本語を見て英語を思い出す練習です。</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
                <div className="flex items-center gap-2 text-amber-200">
                  <Brain size={18} />
                  <h2 className="text-lg font-black text-white">上達のコツ</h2>
                </div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-slate-100">
                  <p>勝てなかった問題は、あとで復習すれば大丈夫です。</p>
                  <p>Word List で見直して、苦手なものは Weakness で集中的に練習できます。</p>
                  <p>Learning Progress を見ながら、覚えた数を少しずつ増やしていきましょう。</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 text-cyan-200">
                  <BookOpen size={18} />
                  <h2 className="text-lg font-black text-white">よく使う画面</h2>
                </div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                  <p>図鑑: 倒したモンスターを確認できます。</p>
                  <p>Word List: 単語や表現をまとめて見直せます。</p>
                  <p>ゲーム設定: 音声や表示を調整できます。</p>
                  <p>Player Profiles: プレイヤーごとに進み具合を分けられます。</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
              <p className="text-lg font-black text-white">少しずつ覚えて、昨日より先へ進めば十分です。</p>
              <p className="mt-2 text-sm leading-7 text-emerald-50">
                まずは倒せる敵を1体ずつ増やしていきましょう。気づいたときには、前よりずっと自然に英語が出てくるようになっています。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
