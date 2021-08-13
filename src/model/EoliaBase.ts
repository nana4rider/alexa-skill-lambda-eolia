interface EoliaBase {
  /** 機器ID */
  appliance_id: string;

  /** 操作トークン */
  operation_token: string | null;

  /** 状態 true:運転 false:停止 */
  operation_status: boolean;

  /** ナノイーX */
  nanoex: boolean;

  /** 風量 0:auto */
  wind_volume: 0 | 2 | 3 | 4 | 5;

  /**  風量オプション 通常 | パワフル | ロング | 静か */
  air_flow: 'not_set' | 'powerful' | 'long' | 'quiet';

  /** 風向上下 0:自動 */
  wind_direction: 0 | 1 | 2 | 3 | 4 | 5

  /** 風向き左右 */
  wind_direction_horizon: 'auto' | 'nearby_left' | 'to_left' | 'to_right' | 'nearby_right' | 'front'

  /** 切タイマー */
  timer_value: 0 | 30 | 60 | 90 | 120;

  /** モード
    * 停止 | 自動 | 冷房 | 暖房 | 除湿
    * 冷房除湿 | 衣類乾燥 | 送風 | おそうじ | おでかけクリーン
    */
  operation_mode: EoliaOperationMode;

  /** 温度 min:16 max:30 step:0.5 */
  temperature: number;

  /** AIオフ | AI 快適 | AI エコナビ */
  ai_control: 'off' | 'comfortable' | 'comfortable_econavi';

  /** 不明 */
  airquality: false;
}
