# occhan VTuber Web

iPhoneのSafariだけで使うことを目標にした、ブラウザ注入型VTuberプロトタイプです。

## できること
- 画面右下へ透過キャラクター表示
- 前面カメラを使った顔追跡
- 左右の瞬き
- 口の開閉 / 笑顔 / O口
- 顔の傾き・左右移動への追従
- アバターのドラッグ移動 / ピンチ拡大縮小
- 録画時に操作UIを隠す
- Safariのブックマークレットから現在のWebページへ注入

## 使い方
1. このフォルダをHTTPSで公開する（GitHub Pages推奨）。
2. 公開された `index.html` をiPhone Safariで開き、「顔追跡」で動作確認。
3. `setup.html` を開き、表示されるブックマークレットをSafariのブックマークURLへ登録。
4. AtCoder等のWebページを開いてそのブックマークを実行。
5. 「顔追跡」を押してカメラを許可。
6. iPhone標準の画面収録を開始。

## 重要な制約
Safari上で別サイトへJavaScriptを注入する方式なので、サイト側のContent Security Policy (CSP) によって `overlay.js` やMediaPipeの読み込みが拒否される場合があります。その場合、そのサイトでは顔追跡版は動きません。

ページ遷移すると注入したDOMは消えるため、遷移後に再度ブックマークを実行してください。

## プライバシー
カメラ映像自体はページ上に表示しません。MediaPipe Face Landmarkerを利用して端末上で顔ランドマークを処理します。

## ファイル
- `index.html`: 単体動作確認ページ
- `setup.html`: iPhone Safariのブックマークレット生成
- `overlay.js`: VTuber表示 + 顔追跡本体
- `assets/`: キャラクターの分離パーツ

## 次の改善候補
- 黒目の独立移動
- 口形状の補間をより滑らかにする
- 顔の上下左右回転をよりLive2Dらしく変形する
- サイトごとのCSP互換性テスト
- 設定値をURL/IndexedDBで保存
