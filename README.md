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
* Alexa、(エアコン名)を(自動|冷房|暖房|除湿|送風)にして  
  除湿は冷房除湿扱いになります。
* Alexa、(エアコン名)を(ON|OFF)にして  
  ONの場合、閾値を元に冷房/暖房を決定します。
* Alexa、(エアコン名)を(16-30)度に設定して
* Alexa、(エアコン名)を(N)度(上げて|下げて)
### その他(仮想ファンデバイス)
* Alexa、(グループ名)の風量を(自動|1|2|3|4|パワフル|ロング|静か)にして
* Alexa、(グループ名)の風向きを(自動|1|2|3|4|5)にして
### シーン
* Alexa、(エアコン名)お出かけクリーンを(ON|OFF)にして(シーン実行)
