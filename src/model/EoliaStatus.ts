interface EoliaStatus extends EoliaBase {
  /** 室内湿度 */
  inside_humidity: number;

  /** 室内温度 */
  inside_temp: number;

  /** 室外温度 */
  outside_temp: number;

  /** 不明 */
  operation_priority: boolean;

  /** 不明 */
  device_errstatus: boolean;

  /** 不明 */
  aq_value: number;

  /** 不明 */
  aq_name: string;

  /** 不明 */
  wind_shield_hit: string;
}
