interface  EoliaDevice {
  /** 機器ID */
  appliance_id: string;

  /** 機器名 */
  nickname: string;

  /** 購入日 */
  purchase_date: string;

  /** 不明 */
  shop_category_id: string;

  /** 不明 */
  shop_area_id: string;

  /** 購入店 */
  shop_name: string;

  /** 不明 */
  inst_place_id: string;

  /** 備考 */
  memo: string;

  /** 不明 */
  appliance_type: number;

  /** 品番 */
  product_code: string;

  /** 品名 */
  product_name: string;

  /** 不明 */
  hashed_guid: string;

  /** 不明 */
  device_register_num: number;

  /** 不明 */
  initialize_flg: boolean;

  /** 不明 */
  repair_status: string;

  /** 不明 */
  point_code: string;

  /** 不明 */
  vpa_enable: boolean;

  /** 設置場所タイプ */
  vpa_room_type: string;

  /** 設置場所名 */
  vpa_room_name: string;
}
