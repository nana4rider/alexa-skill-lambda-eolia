import { DateTime } from 'luxon';
import { EoliaClient, EoliaOperationMode, EoliaStatus } from 'panasonic-eolia-ts';
import { env } from 'process';
import { AlexaThermostatMode } from '../model/AlexaThermostatMode';
import { getDynamoDB } from '../util';

/** Turn ON時、指定した温度以上で冷房、それ以外は暖房とする */
export const TEMPERATURE_COOL_THRESHOLD = 24;
/** 指定時間を超えると、ReportState時にデータを再取得する */
export const REFRESH_STATUS_MILLISECONDS = 60000;
/** デフォルトの設定温度  */
export const DEFAULT_TEMPERATURE: { [s in EoliaOperationMode]?: number } = {
  Auto: 24,
  Cooling: 26,
  CoolDehumidifying: 26,
  Heating: 20
};

/**
 * Eoliaクライアントを取得します。
 *
 * @returns Eoliaクライアント
 */
export async function getClient() {
  if (!env.USER_ID || !env.PASSWORD) {
    throw new Error('User ID or Password is empty.');
  }

  const tokenResult = await getDynamoDB().get({
    TableName: 'tokens',
    Key: { id: 'eolia_access_token' }
  }).promise();

  const accessToken = tokenResult.Item?.access_token;

  return new EoliaClient(env.USER_ID, env.PASSWORD, accessToken);
}

/**
 * Alexa操作モードを取得します。
 *
 * @param mode Eolia操作モード
 * @returns
 */
export function getAlexaThermostatMode(mode: EoliaOperationMode): AlexaThermostatMode {
  switch (mode) {
  case 'Auto':
    return 'AUTO';
  case 'Cooling':
  case 'CoolDehumidifying':
    return 'COOL';
  case 'Heating':
    return 'HEAT';
  case 'Stop':
    return 'OFF';
  }
  return 'CUSTOM';
}

/**
 * Eolia操作モードを取得します。
 *
 * @param mode Alexa操作モード
 * @param customName カスタム名
 * @returns
 */
export function getEoliaOperationMode(mode: AlexaThermostatMode, customName: string): EoliaOperationMode | undefined {
  switch (mode) {
  case 'AUTO':
    return 'Auto';
  case 'COOL':
    return 'Cooling';
  case 'HEAT':
    return 'Heating';
  case 'CUSTOM':
    switch (customName) {
    case 'DEHUMIDIFY':
      return 'CoolDehumidifying';
    case 'FAN':
      return 'Blast';
    }
    break;
  case 'OFF':
    return 'Stop';
  }
  return undefined;
}

/**
 * エアコンの状態を更新します。
 *
 * @param client Eoliaクライアント
 * @param status Eolia状態データ
 * @returns 更新後のEolia状態データ
 */
export async function updateStatus(client: EoliaClient, status: EoliaStatus) {
  const db = getDynamoDB();
  const operation = client.createOperation(status);
  const prevStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: status.appliance_id }
  }).promise();
  // 前回のトークンがある場合は使用する
  if (prevStatusResult.Item) {
    operation.operation_token = prevStatusResult.Item?.status.operation_token;
  }

  const updatedStatus = await client.setDeviceStatus(operation);

  await db.put({
    TableName: 'tokens',
    Item: {
      id: 'eolia_access_token',
      access_token: client.accessToken
    }
  }).promise();

  await db.put({
    TableName: 'eolia_report_status',
    Item: {
      id: status.appliance_id,
      timestamp: DateTime.local().toISO(),
      status: updatedStatus
    }
  }).promise();

  return updatedStatus;
}

/**
 * 変更レポートを作成します。
 *
 * @param status Eolia状態データ
 * @param uncertainty
 * @returns 変更レポート
 */
export function createReports(status: EoliaStatus, uncertainty: number) {
  const now = DateTime.local().toISO();
  // operation_mode: Stopでputするとエラーを起こすので、operation_statusでOFF判断する
  const thermostatMode: AlexaThermostatMode = !status.operation_status ?
    'OFF' : getAlexaThermostatMode(status.operation_mode);
  // 0度に設定すると、Alexaアプリで操作できなくなる
  const targetSetpoint = EoliaClient.isTemperatureSupport(status.operation_mode) ? status.temperature : 0;

  return [
    // モード指定
    {
      'namespace': 'Alexa.ThermostatController',
      'name': 'thermostatMode',
      'value': thermostatMode,
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // 温度指定
    {
      'namespace': 'Alexa.ThermostatController',
      'name': 'targetSetpoint',
      'value': {
        'value': targetSetpoint,
        'scale': 'CELSIUS'
      },
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // 温度計
    {
      'namespace': 'Alexa.TemperatureSensor',
      'name': 'temperature',
      'value': {
        'value': status.inside_temp,
        'scale': 'CELSIUS'
      },
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // ON/OFF
    {
      'namespace': 'Alexa.PowerController',
      'name': 'powerState',
      'value': status.operation_status ? 'ON' : 'OFF',
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    }
  ];
}
