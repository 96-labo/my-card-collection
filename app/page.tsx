"use client";

import React, { useState, useEffect,useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ImageIcon, ChevronLeft, Bell, MoreHorizontal, Link, ChevronDown, Plus, Grid, Play, PlusSquare, UserSquare2, PlusCircle, Trash2, Heart, Skull } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from '@supabase/ssr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// これが「Card型」の定義です
interface Card {
  slot_number: number;
  image_url: string;
  is_favorite: boolean;
}

// もし既存のコンポーネント名とぶつかってエラーが出るなら、
// 型の名前を「CardData」などに変えると安全です

export default function GaristagramUI() {
  const [cards, setCards] = useState<Card[]>([]);
  
  // 300個のカード状態を管理（key: 番号, value: 画像URL）
  // 初期状態はすべて null（未登録 = 裏表紙）
  const [collection, setCollection] = useState<{ [key: number]: string | null }>({});
  // 1から300までの配列を作成
  const slots = Array.from({ length: 300 }, (_, i) => i + 1);

  // 指定の画像（裏表紙）
  const CARD_BACK_IMAGE = "https://scjdlixiqqtblstemhel.supabase.co/storage/v1/object/public/images/back-cover.jpg"

  const [selectedImages, setSelectedImages] = useState<{file: File, preview: string, slot: number}[]>([]);
  const removeImage = (indexToRemove: number) => {
    setSelectedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        slot: selectedImages.length + 1 
      }));
      setSelectedImages((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  };

  // 1. 番号変更ハンドラー（コンポーネント内に記述）
  const handleSlotChange = (index: number, value: string) => {
    const newImages = [...selectedImages];
    let num = parseInt(value);

    // 300を超えたら強制的に300にする
    if (num > 300) num = 300;
    // 1未満、または空文字なら1（または最小値）にする
    if (num < 1 || isNaN(num)) num = 1;

    newImages[index].slot = num;
    setSelectedImages(newImages);
  };

  // ダイアログの開閉状態（初期値は false = 閉じている）
const [isConfirmOpen, setIsConfirmOpen] = useState(false);

// 重複しているスロット番号を保存する配列
const [conflictingSlots, setConflictingSlots] = useState<number[]>([]);


  // セットで管理するイメージ
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});

  // フォーチュンで選ばれた3枚のカードを保存する箱
const [fortuneCards, setFortuneCards] = useState<Card[]>([]);

// フォーチュンの画面（モーダル）を開いているかどうかの旗
const [isFortuneOpen, setIsFortuneOpen] = useState(false);

// どのカードを選択したかを記録する（最初は null）
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // お気に入り切り替え関数
  const toggleFavorite = (num: number) => {
    setFavorites(prev => ({
      ...prev,
      [num]: !prev[num]
    }));
  };

  const [activeTab, setActiveTab] = useState<'all' | 'fav'>('all');
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('card_collection')
      .select('*');

    if (data) {
      const newCol: Record<number, string> = {};
      const newFav: Record<number, boolean> = {};
      data.forEach(item => {
        newCol[item.slot_number] = item.image_url;
        newFav[item.slot_number] = item.is_favorite;
      });
      setCollection(newCol);
      setFavorites(newFav);
    }
  };
  fetchData();
}, []);

// 1. 実際に保存を実行する関数（Supabase連携）
const executeArchive = async () => {
  try {
    const uploadPromises = selectedImages.map(async (img) => {
      // a. 画像をストレージにアップロード
      const fileName = `${img.slot}_${Date.now()}.png`;
      const { error: storageError } = await supabase.storage
        .from('cards')
        .upload(fileName, img.file);

      if (storageError) throw storageError;

      // b. 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('cards')
        .getPublicUrl(fileName);

      // c. データベースに情報を保存 (upsert)
      const { error: dbError } = await supabase
  .from('card_collection')
  .upsert({
    slot_number: img.slot,
    image_url: publicUrl,
    // img.isFavorite ではなく、現在の favorites State から取得する
    is_favorite: !!favorites[img.slot] 
  });

      if (dbError) throw dbError;

      return { slot: img.slot, url: publicUrl, isFav: !!favorites[img.slot] };
    });

    // すべてのアップロードが完了するのを待つ
    const results = await Promise.all(uploadPromises);

    // フロントエンドの表示（State）を更新
    setCollection(prev => {
      const next = { ...prev };
      results.forEach(r => next[r.slot] = r.url);
      return next;
    });
    setFavorites(prev => {
      const next = { ...prev };
      results.forEach(r => next[r.slot] = r.isFav);
      return next;
    });

    alert(`${selectedImages.length}枚のカードをアーカイブしました！`);
    setSelectedImages([]); // プレビューリストを空にする
    setIsConfirmOpen(false); // ダイアログが開いていれば閉じる

  } catch (error) {
    console.error("保存失敗:", error);
    alert("エラーが発生しました。");
  }
};

// 2. 保存ボタンが押された時の入り口
const handleCommit = () => {
  // すでに登録済みのスロット（nullやundefinedでないもの）があるかチェック
  const conflicts = selectedImages
    .map(img => img.slot)
    .filter(slot => collection[slot]);

  if (conflicts.length > 0) {
    setConflictingSlots(conflicts);
    setIsConfirmOpen(true); // 重複があれば確認ダイアログへ
  } else {
    executeArchive(); // 重複がなければ即実行
  }
};

const handleDelete = async (num: number) => {
  if (!confirm(`No.${num} を異世界転生しますか？`)) return;

  try {
    // 1. まず現在の画像URLを取得（ストレージから消すために必要）
    const imageUrl = collection[num];
    
    // 2. DBからレコードを削除
    const { error: dbError } = await supabase
      .from('card_collection')
      .delete()
      .eq('slot_number', num);

    if (dbError) throw dbError;

    // 3. ストレージからも画像を削除（URLからファイル名を抽出）
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop(); // URLの最後がファイル名
      if (fileName) {
        await supabase.storage.from('cards').remove([fileName]);
      }
    }

    // 4. Stateを更新
    setCollection(prev => {
      const next = { ...prev };
      delete next[num];
      return next;
    });
    // ... お気に入りStateも同様に削除
    
    alert("完全に削除しました");
  } catch (error) {
    console.error(error);
  }
};

const startFortune = () => {
  if (cards.length < 3) {
    alert("カードが3枚以上必要です！");
    return;
  }

  // 1. シャッフルして3枚選出
  const selected = [...cards]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  setFortuneCards(selected);
  setSelectedIndex(null); // 選択状態をリセット
  setIsFortuneOpen(true); // モーダルを表示
};

return (
  <div className="p-1 md:p-1 bg-[#29082b] min-h-screen text-white">
    {/* 1. アカウント名バーのみを最上部に固定 (fixed) */}
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0d0415] px-4 h-12 flex items-center justify-between">
      <div className="flex items-center gap-">
        <ChevronLeft size={28} />
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-extrabold tracking-tight">garistagram03</h1>
          <div className="bg-[#0095f6] rounded-full p-0.5">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current"><path d="M10.5 21.3L2.2 13l1.4-1.4 6.9 6.9 11.3-11.3 1.4 1.4z" stroke="white" strokeWidth="2"/></svg>
          </div>  
        </div>
      </div>
      <div className="flex items-center gap-5">
        <Bell size={24} />
        <MoreHorizontal size={24} />
      </div>
    </header>

    {/* スクロールするエリアの開始（ヘッダー分だけ上に余白） */}
    <div className="pt-10"></div>

    {/* 2. プロフィール詳細（ここは上にスクロールして消える） */}
    <div className="px-1 pt-4 pb-2">
      <div className="flex items-center gap-8">
        <div className="relative p-[3px] bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-full shrink-0">
          <div className="bg-black p-0.5 rounded-full">
            <button>
            <img src="https://scjdlixiqqtblstemhel.supabase.co/storage/v1/object/public/images/icon.png" className="w-20 h-20 rounded-full object-cover" alt="Avatar"
            onClick={startFortune}/>
            </button>
          </div>  
        </div>
        <div className="flex-1 flex justify-around text-center">
          <div><p className="font-extrabold text-lg">{cards.length}</p><p className="text-[11px] text-gray-400">投稿</p></div>
          <div><p className="font-extrabold text-lg">16.8万</p><p className="text-[11px] text-gray-400">フォロワー</p></div>
          <div><p className="font-extrabold text-lg">300</p><p className="text-[11px] text-gray-400">フォロー中</p></div>
        </div>
      </div>

      <div className="mt-3">
        <p className="font-bold text-sm">ライトニングドラゴン船津</p>
        <p className="text-gray-400 text-xs mt-0.5">遊び</p>
        <p className="text-sm mt-0.5 leading-snug">リョウガです(^o^)</p>
        {/* リンクエリア */}
        <a 
          href="https://www.youtube.com/@GariGameChannel" // 飛ばしたいURLをここに入れる
          target="_blank" // 新しいタブで開く
          rel="noopener noreferrer" // セキュリティ対策
          className="text-[#4169e1] text-sm flex items-center gap-1 mt-0.5 font-medium active:opacity-50 transition-opacity"
        >
          {/* リンクアイコン（斜め向き） */}
          <Link size={15} />
          <span className="truncate">www.youtube.com/channel/UCc9GiFq6cCFEr...</span>
        </a>
      </div>

      {/* アクションボタン（ダミー） */}
      <div className="flex gap-2 mt-4">
        <button 
          className="flex-1 bg-[#262626] h-8 rounded-lg text-sm font-bold active:opacity-50 transition-opacity flex items-center justify-center gap-1"
        >
          <span>フォロー中</span>
          <ChevronDown size={20} />
        </button>
        <button className="flex-1 bg-[#262626] h-8 rounded-lg text-sm font-bold active:opacity-50 transition-opacity">メッセージ</button>
        <label className="bg-[#262626] w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:opacity-50 transition-opacity">
          <Plus size={18} />
        </label>
      </div>
    </div>

    {/* 3. タブバー（Sticky） */}
    <div className="sticky top-12 z-30 bg-[#29082b] flex mt-2 h-11">
      <button 
        onClick={() => setActiveTab('all')}
        className={`flex-1 flex justify-center items-center transition-colors ${activeTab === 'all' ? 'border-b border-white text-white' : 'text-gray-500'}`}
      >
        <Grid size={22} />
      </button>

      {/* 一括登録用ボタンとダイアログ --- */}
      <Dialog>
        <DialogTrigger asChild>
          <button className="flex-1 flex justify-center items-center text-gray-500 transition-colors">
            <Play size={22} />
          </button>
        </DialogTrigger>
        
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              カードを登録
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* ファイル選択エリア */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleFileChange} 
              />
              <PlusSquare className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-muted-foreground">クリックして写真を選択、またはドラッグ＆ドロップ</p>
            </div>

            {/* 画像のプレビュー */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedImages.map((img, i) => (
                  <div key={i} className="relative border rounded-md p-2 bg-slate-50">
                    <AspectRatio ratio={2.5/3.5}>
                      <img src={img.preview} className="object-cover rounded w-full h-full" />
                    </AspectRatio>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">No.</span>
                      <Input 
                        type="number" 
                        min={1} 
                        max={300} 
                        value={selectedImages[i].slot} 
                        className="h-8 w-full text-center font-bold"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleSlotChange(i, e.target.value)}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          const newImages = selectedImages.filter((_, index) => index !== i);
                          setSelectedImages(newImages);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* 1. アーカイブ実行ボタン */}
            <Button 
              className="w-full h-12 text-lg font-bold" 
              disabled={selectedImages.length === 0}
              onClick={handleCommit}
            >
              {selectedImages.length}枚をアーカイブする
            </Button>

            {/* 2. 上書き確認用ダイアログ */}
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>カードの上書き確認</AlertDialogTitle>
      <AlertDialogDescription>
        {/* 重複している番号だけを表示 */}
        No. {conflictingSlots.join(", ")} は既に登録済みです。
        新しい写真で上書きしますか？
        <br />
        <span className="text-xs text-muted-foreground mt-2 block">
          ※重複していないカードは、この操作で一緒に保存されます。
        </span>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>キャンセル</AlertDialogCancel>
      {/* executeArchive は「選択中の全画像を保存する関数」のままでOKです */}
      <AlertDialogAction onClick={executeArchive} className="bg-blue-600">
        上書きを承諾して保存
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
      <button 
  onClick={() => setActiveTab('fav')}
  className={`flex-1 flex flex-col justify-center items-center transition-all ${
    activeTab === 'fav' 
      ? 'border-b border-white text-purple-500' 
      : 'text-gray-400'
  }`}
>
  {activeTab === 'fav' ? (
    // アクティブ時：Skullアイコン（塗りつぶし）
    <Skull size={22} className="animate-in zoom-in duration-200" />
  ) : (
    // 通常時：Heartアイコン
    <Heart size={22} />
  )}
</button>
    </div>

    {/* 300個のグリッドレイアウト */}
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-0.5">
      {slots
      .filter((num) => {
      if (activeTab === 'fav') {
        // お気に入りタブの時は「所持」かつ「お気に入り登録済み」のみ表示
        return collection[num] && favorites[num];
      }
      return true; // 通常時は300個すべて表示
    })
      
      .map((num) => {
        const cardImage = collection[num]; // その番号の画像があるか確認

        if (cardImage) {
          return (
            <Dialog key={num}>
              <DialogTrigger asChild>
                <Card className={`p-0 rounded-none overflow-hidden transition-all cursor-pointer border-none shadow-md ${cardImage ? 'hover:ring-4 ring-yellow-400' : 'hover:scale-105'}`}>
                  <AspectRatio ratio={2.5 / 3.5} className="relative group">
                      <img
                        src={cardImage}
                        alt={`Card ${num}`}
                        className="object-cover w-full h-full animate-in fade-in duration-500"
                      />
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // ダイアログが開かないように制御
                          toggleFavorite(num);
                        }}
                        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors"
                      >
                        <Heart 
                          size={16} 
                          className={favorites[num] ? "fill-red-500 text-red-500" : "text-white"} 
                        />
                      </button>
                  </AspectRatio>
                </Card>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    No.{num}
                  </DialogTitle>
                </DialogHeader>
    
                <div className="flex flex-col items-center gap-6 py-4">
                  {/* カードプレビュー */}
                  <div className={`w-52 transition-all duration-300 ${cardImage ? "shadow-[0_0_20px_rgba(59,130,246,0.5)]" : "shadow-sm opacity-50"}`}>
                    <AspectRatio ratio={2.5 / 3.5} className="rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                      <img 
                        src={cardImage || CARD_BACK_IMAGE} 
                        alt="Preview" 
                        className={`object-cover w-full h-full ${!cardImage && "grayscale opacity-20"}`} 
                      />
                    </AspectRatio>
                  </div>

                  <div className="flex items-center gap-2 w-full">
                    <Button 
                      variant={favorites[num] ? "default" : "outline"} 
                      className={`flex-1 gap-2 ${favorites[num] ? "bg-purple-500 hover:bg-purple-600" : ""}`}
                      onClick={() => toggleFavorite(num)}
                    >
                      <Heart className={favorites[num] ? "fill-current" : ""} />
                      {favorites[num] ? "お気に入り解除" : "お気に入りに追加"}
                    </Button>
                  </div>
                  {/* 削除セクション（セパレーター代わりの余白） */}
                  <div className="pt-4 mt-2 border-t">
                    <Button 
  variant="outline" 
  onClick={() => handleDelete(num)} // 作成した関数を呼ぶ
  className="w-full h-11 text-muted-foreground hover:text-destructive hover:bg-red-50 gap-2"
>
  <Trash2 size={10} />
</Button>
                  </div>

                </div>
              </DialogContent>
            </Dialog>
          );
        }

        // 2. 未所持の場合の表示（ただのCard、Dialogなし）
        return (
          <Card key={num} className="p-0 rounded-none overflow-hidden border-none shadow-none cursor-default">
            <AspectRatio ratio={2.5 / 3.5} className="relative">
              <img
                src={CARD_BACK_IMAGE}
                alt="Empty Slot"
                className="object-cover w-full h-full opacity-20 --chart-4 bg-slate-100"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-slate-400 font-bold text-xl">{num}</span>
              </div>
            </AspectRatio>
          </Card>
        );
      })}
    </div>

    {/* お気に入りタブで1枚もない時のフォローメッセージ */}
{activeTab === 'fav' && Object.values(favorites).filter(Boolean).length === 0 && (
  <div className="text-center py-20 text-muted-foreground">
    <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
    <p>お気に入りのカードがまだありません</p>
  </div>
)}

{/* おみくじモーダル */}
{isFortuneOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
    <div className="max-w-md w-full text-center">
      <h2 className="text-white text-2xl font-bold mb-8 animate-bounce">運命の1枚！</h2>
      
      <div className="flex justify-center gap-4 mb-12">
        {fortuneCards.map((card, index) => (
          <div 
            key={index}
            onClick={() => setSelectedIndex(index)}
            className={`relative w-24 h-32 transition-all duration-500 transform ${
              selectedIndex === index ? 'scale-125 z-10' : 'hover:-translate-y-2'
            }`}
          >
            {/* カードの見た目（選択されたら表、それ以外は裏） */}
            <div className={`w-full h-full rounded-lg border-2 border-white/50 overflow-hidden shadow-xl ${selectedIndex === index ? '' : 'bg-gradient-to-br from-blue-900 to-indigo-900'}`}>
              {selectedIndex === index ? (
                <img src={card.image_url} className="w-full h-full object-cover" alt="Selected" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold uppercase tracking-widest">
                  ?
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <button 
          onClick={() => setIsFortuneOpen(false)}
          className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-200 transition-colors"
        >
          結果を閉じる
        </button>
      )}
    </div>
  </div>
)}
  </div>
);
}