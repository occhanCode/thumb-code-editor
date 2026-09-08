# ThumbCodeEditor

スマホで競技プログラミングのコードを入力しやすくするためのブラウザエディタです。

## 主な機能

- iPhone向けの入力ボタン
  - ボタンの表示名・挿入文字列を自由に変更可能
  - `=>` や `for (...)` のような複数文字も1ボタンに設定可能
  - ボタン追加・削除・前半/後半配置
  - Undo / Redo / カーソル移動 / 補完 / Tab は固定の編集操作として別枠
- 自動インデント / TypeScript向けコード補完
- ソース先頭へワンタップで移動
- ソース内検索（大文字小文字を区別せず、前/次の一致へ移動）
- 大きなソースの全文コピー
- ソース / 標準入力 / 設定のローカル自動保存
- URL指定のテンプレートリセット
  - URL未設定時はソース全削除
  - GitHub `blob` URL は raw URL に自動変換
- 言語別シンタックスハイライト
  - TypeScript
  - C
  - C++
  - C#
  - Go
  - Java
  - JavaScript
  - Kotlin
  - PHP
  - Python
  - Ruby
  - Rust
  - Swift
  - Text
- TypeScript 5.9.2 の型チェックとブラウザ内デバッグ実行
  - TypeScript専用の「実行 / 型チェック / 入力・出力」は上部の共通操作から分離し、エディタ下部に表示

TypeScript を最優先の言語としており、実行・型チェックは TypeScript のみ対応しています。その他の言語は編集・検索・コピー用途です。 対応言語には C / C++ / C# / Go / Java / JavaScript / Kotlin / PHP / Python / Ruby / Rust / Swift / Text を含みます。

## GitHub Pages

このフォルダの `index.html` をリポジトリに置き、GitHub Pages を有効にすると、そのURLからそのまま利用できます。

TypeScript の実行は Safari 内の互換デバッグ環境であり、AtCoder 上の Node.js 22.19.0 と完全に同一ではありません。
