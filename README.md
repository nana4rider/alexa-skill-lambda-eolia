# alexa-skill-lambda-eolia

Alexa Smart Home Skill Eolia

## 命令可能なコマンド
* Alexa、(冷房|暖房)をつけて
* Alexa、(冷房|暖房)を消して
* Alexa、(エアコン名)を(冷房|暖房|除湿|送風)にして
* Alexa、(エアコン名)を(ON|OFF)にして  
* Alexa、(エアコン名)を(16-30)度に設定して
* Alexa、(エアコン名)の掃除をONにして(シーン実行)

## 必要なテーブル
パーティションキーは全て `id`

`tokens`, `eolia_report_status`, `eolia_cleaning`
