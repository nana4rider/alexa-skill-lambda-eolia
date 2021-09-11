# alexa-skill-lambda-eolia

Alexa Smart Home Skill Eolia

## 初期設定
```
npm install
npm run set-handler
```

## AWSにデプロイ
```
npm run deploy
```

## 必要なテーブル
パーティションキーは全て `id`

`tokens`, `eolia_report_status`, `eolia_cleaning`

## 環境変数の設定
`USER_ID`, `PASSWORD`

## 命令可能なコマンド
* Alexa、(冷房|暖房)を(ON|OFF)にして
* Alexa、(エアコン名)を(自動|冷房|暖房|除湿|送風)にして  
  除湿は冷房除湿扱いになります。
* Alexa、(エアコン名)を(ON|OFF)にして  
  ONの場合、閾値を元に冷房/暖房を決定します。
* Alexa、(エアコン名)を(16-30)度に設定して
* Alexa、(エアコン名)を(N)度(上げて|下げて)
* Alexa、(エアコン名)の掃除を(ON|OFF)にして(シーン実行)
* Alexa、(エアコン名)のパワフルを(ON|OFF)にして(シーン実行)
