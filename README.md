# alexa-skill-lambda-eolia

Alexa Smart Home Skill Eolia

## 初期設定
### AWS CLIのインストール
https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/install-cliv2.html

### コマンドの実行
```
npm install
npm run set-handler
```

### DynamoDBテーブルを作成
パーティションキーは全て `id`

`tokens`, `eolia_report_status`, `eolia_cleaning`

### Lambda環境変数の設定
`USER_ID`, `PASSWORD`

## AWSにデプロイ
```
npm run deploy
```

## 命令可能なコマンド
### サーモスタット
* Alexa、(冷房|暖房)を(ON|OFF)にして  
  端末とサーモスタットを、同じグループに紐付ける必要があります。
* Alexa、(エアコン名)を(自動|冷房|暖房|除湿|送風)にして  
  除湿は冷房除湿扱いになります。その他のモードには未対応です。
* Alexa、(エアコン名)を(ON|OFF)にして  
  ONの場合、閾値を元に冷房/暖房を決定します。
* Alexa、(エアコン名)を(N)度に設定して  
  16～30度まで設定可能です。
* Alexa、(エアコン名)を(N)度(上げて|下げて)  
  0.5度刻みで設定可能です。

### その他
サーモスタットとは別に仮想デバイスが検出されるので、グループに紐付けて操作します。

* Alexa、(グループ名)の風量を(自動|1|2|3|4|パワフル|ロング|静か)にして
* Alexa、(グループ名)の風向きを(自動|1|2|3|4|5)にして
* 発話対象としては推奨しませんが、風向(左右)、ナノイーX、AIコントロールにも対応しています。  
  アプリの画面から設定可能です。

### シーン
発話の反応が悪いので、定型アクションで実行するか名称を変更することを推奨します。  
掃除は1日1回以上実行できないように制限をかけています。

* Alexa、(エアコン名)クリーンを(ON|OFF)にして(シーン実行)
* Alexa、(エアコン名)お出かけクリーンを(ON|OFF)にして(シーン実行)
