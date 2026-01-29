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
  const toggleFavorite = async (slotNumber: number) => {
  // 1. 現在の状態を反転させる
  const isNowFavorite = !favorites[slotNumber];

  // 2. 画面上の表示（State）を即座に更新
  setFavorites(prev => ({
    ...prev,
    [slotNumber]: isNowFavorite
  }));

  // 3. Supabaseのデータベースを更新（ここが重要！）
  const { error } = await supabase
    .from('card_collection')
    .update({ is_favorite: isNowFavorite })
    .eq('slot_number', slotNumber);

  if (error) {
    console.error('お気に入りの保存に失敗しました:', error);
    // 失敗した場合はStateを元に戻す処理を入れるとより親切です
  }
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
  // collection(画像)とfavorites(お気に入り)を合体させて、その場で「持ち札リスト」を作る
  const heldCards = Object.entries(collection)
    .filter(([_, url]) => url !== null) // 画像があるものだけ
    .map(([slot, url]) => ({
      slot_number: parseInt(slot),
      image_url: url as string,
      is_favorite: !!favorites[parseInt(slot)]
    }));

  console.log("現在認識している枚数:", heldCards.length);

  if (heldCards.length < 3) {
    alert(`カードが3枚以上必要です！(現在: ${heldCards.length}枚)`);
    return;
  }

  // 3枚選出
  const selected = heldCards
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  setFortuneCards(selected);
  setSelectedIndex(null);
  setIsFortuneOpen(true);
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
        <div className="relative w-[90px] h-[93px] p-[3px] bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-full shrink-0 flex items-center justify-center">
          <div className="bg-black p-0.5 rounded-full">
            <button className="w-full h-full rounded-full overflow-hidden block">
            <img src="https://scjdlixiqqtblstemhel.supabase.co/storage/v1/object/public/images/icon.png" className="w-20 h-20 rounded-full object-cover" alt="Avatar"
            onClick={startFortune}/>
            </button>
          </div>  
        </div>
        <div className="flex-1 flex justify-around text-center">
          <div><p className="font-extrabold text-lg">{Object.keys(collection).length}</p><p className="text-[11px] text-gray-400">投稿</p></div>
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-0.5 bg-black/95 backdrop-blur-md p-4 overflow-hidden">
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
                <Card className={`p-0 rounded-none overflow-hidden transition-all cursor-pointer border-none shadow-md ${cardImage ? 'hover:ring-4 ring-purple-400' : 'hover:scale-105'}`}>
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

              <DialogContent className="border-none bg-transparent shadow-none p-0 flex flex-col items-center justify-center max-w-[95vw] bg-black/95 backdrop-blur-md p-4 overflow-hidden">
  {/* タイトル部分はカードの主役感を邪魔しないように最小限に */}
  <DialogHeader className="mb-4">
    <DialogTitle className="text-white/60 font-mono text-center tracking-[0.2em] text-sm uppercase">
      No.{num}
    </DialogTitle>
  </DialogHeader>

  <div className="relative flex flex-col items-center gap-12 bg-black/95 backdrop-blur-md p-4 overflow-hidden">
    {/* カードプレビュー：おみくじ風の巨大化＆光彩エフェクト */}
    <div className={`
      relative w-64 transition-all duration-700 ease-out
      ${cardImage 
        ? "scale-110 shadow-[0_0_60px_rgba(139,92,246,0.4)] rounded-2xl" 
        : "opacity-50"
      }
    `}>
      <AspectRatio ratio={2.5 / 3.5} className="rounded-2xl overflow-hidden border-2 border-white/20 bg-black/95 backdrop-blur-md">
        <img 
          src={cardImage || CARD_BACK_IMAGE} 
          alt="Preview" 
          className={`object-cover w-full h-full ${!cardImage && "grayscale opacity-20"}`} 
        />
      </AspectRatio>
      
      {/* 選ばれた時のような後光エフェクト */}
      {cardImage && (
        <div className="absolute -inset-4 bg-purple-500/20 blur-3xl -z-10 animate-pulse" />
      )}
    </div>

    {/* 操作ボタン：おみくじの下部ボタンのように配置 */}
    <div className="flex flex-col gap-4 w-72 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Button 
        variant="ghost" 
        className={`w-full h-14 rounded-full text-lg font-black tracking-widest transition-all duration-300 ${
          favorites[num] 
            ? "bg-gradient-to-r from-red-500 to-purple-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
            : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
        }`}
        onClick={() => toggleFavorite(num)}
      >
        <Heart className={`mr-2 ${favorites[num] ? "fill-current" : ""}`} />
        {favorites[num] ? "FAVORITED" : "ADD FAVORITE"}
      </Button>

      {/* 閉じるヒント */}
      <p className="text-center text-white/30 text-xs tracking-tighter animate-pulse">
        TAP ANYWHERE TO BACK
      </p>

      {/* 削除ボタンは誤操作防止のため、さらに下に小さく配置 */}
      <Button 
        variant="ghost" 
        onClick={() => handleDelete(num)}
        className="mt-4 text-white/10 hover:text-red-500 hover:bg-transparent transition-colors text-[10px]"
      >
        <Trash2 size={12} className="mr-1" />
        DELETE FROM COLLECTION
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
  <div 
  onClick={() => setIsFortuneOpen(false)}
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-hidden">
    <div className="w-full h-full flex flex-col items-center justify-center">
      
      {/* タイトル：カード選択後は非表示にしてカードを主役にする */}
      {selectedIndex === null && (
        <h2 className="text-white text-2xl font-bold mb-12 animate-pulse">さいしょはスター...☆彡</h2>
      )}
      
      <div className="relative flex justify-center items-center gap-6 w-full h-[400px]">
        {fortuneCards.map((card, index) => {
          const isSelected = selectedIndex === index;
          const isAnySelected = selectedIndex !== null;

          return (
            <div 
              key={index}
              onClick={(e) => {
                e.stopPropagation();
              if (selectedIndex === null) setSelectedIndex(index);
              }}
              className={`
                absolute transition-all duration-700 ease-out
                ${isSelected 
                  ? 'z-50 scale-[2.5] rotate-0 translate-x-0 translate-y-0' // 選択：中央で巨大化
                  : isAnySelected
                    ? 'opacity-0 scale-50 pointer-events-none' // 他：消える
                    : `relative scale-100 hover:-translate-y-4` // 未選択：並んで待機
                }
              `}
            >
              {/* カードの見た目 */}
              <div className={`
                w-24 h-34 rounded-xl border-2 shadow-2xl overflow-hidden transition-all duration-500
                ${isSelected ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : 'border-white/20'}
              `}>
                {isSelected ? (
                  <img src={card.image_url} className="w-full h-full object-cover" alt="Result" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center">
                    <Skull className="text-white/20 w-8 h-8" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 結果発表後のボタン */}
      {selectedIndex !== null && (
        <div className="mt-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <button 
            onClick={() => setIsFortuneOpen(false)}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-10 py-3 rounded-full font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
          >
            Anywhare Tap
          </button>
        </div>
      )}
    </div>
  </div>
)}
  </div>
);
}