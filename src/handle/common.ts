import { DateTime } from 'luxon';
import { EoliaClient, EoliaOperationMode, EoliaStatus } from 'panasonic-eolia-ts';
import { env } from 'process';
import { v4 as uuid } from 'uuid';
import { AlexaThermostatMode } from '../model/AlexaThermostatMode';
import { getDynamoDB } from '../util';
import { createSettingReports } from './setting';
import { createThermostatReports } from './thermostat';

/** 自動判断が必要なとき、指定した温度以上で冷房、それ以外は暖房とする */
export const TEMPERATURE_COOL_THRESHOLD = 24;
/** デフォルトの設定温度  */
export const DEFAULT_TEMPERATURE: Partial<Record<EoliaOperationMode, number>> = {
  Auto: 24,
  Cooling: 26,
  CoolDehumidifying: 26,
  Heating: 20
};
/**
 * trueに設定すると、120秒以内であっても常にAPIから状態を取得する。
 * エアコンをAPIでのみ操作する場合、更新から120秒以内であれば
 * 他の端末で状態を変更されていないことを保証できるが、
 * 赤外線リモコンを使用する場合保証できないので、trueに設定することを推奨します。
 */
export const USE_INFRARED_REMOTE_CONTROL = false;

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
    TableName: 'eolia_tokens',
    Key: { id: 'access_token' }
  }).promise();

  const accessToken = tokenResult.Item?.token;

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
  case 'CoolDehumidifying': // 冷房除湿もAlexaの扱いは冷房とする
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
  case 'FAN':
    return 'Blast';
  case 'DEHUMIDIFY':
    return 'CoolDehumidifying';
  case 'CUSTOM':
    // 現状、衣類乾燥や除湿(冷房ではない)は未対応
    switch (customName) {
    case 'DEHUMIDIFY': // 発話: 除湿
      return 'CoolDehumidifying';
    case 'FAN': // 発話: 送風
      return 'Blast';
    }
    console.log('[Custom Operation Mode]', mode);
    break;
  case 'OFF':
    return 'Stop';
  }
  return undefined;
}

/**
 * エアコンの状態を取得します。
 * 操作トークンの有効期限が切れていない場合、状態レポートをキャッシュとして利用します。
 *
 * @param client Eoliaクライアント
 * @param applianceId Eolia機器ID
 * @returns Eolia状態データ
 */
export async function getStatus(client: EoliaClient, applianceId: string): Promise<EoliaStatus> {
  if (USE_INFRARED_REMOTE_CONTROL) {
    return client.getDeviceStatus(applianceId);
  }

  const db = getDynamoDB();
  const statusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: applianceId }
  }).promise();

  if (statusResult.Item && statusResult.Item.status.operation_token) {
    const diffNow = DateTime.fromISO(statusResult.Item.timestamp).diffNow().milliseconds * -1;
    if (diffNow < EoliaClient.OPERATION_TOKEN_LIFETIME) {
      return statusResult.Item.status;
    }
  }

  return client.getDeviceStatus(applianceId);
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

  const tokenResult = await db.get({
    TableName: 'eolia_tokens',
    Key: { id: status.appliance_id }
  }).promise();
  operation.operation_token = tokenResult.Item?.token;

  console.log('[updateStatus]', JSON.stringify(operation));

  status = await client.setDeviceStatus(operation);

  const now = DateTime.local().toISO();

  await Promise.all([
    db.put({
      TableName: 'eolia_tokens',
      Item: {
        id: 'access_token',
        timestamp: now,
        token: client.accessToken,
      }
    }).promise(),
    db.put({
      TableName: 'eolia_tokens',
      Item: {
        id: status.appliance_id,
        timestamp: now,
        token: status.operation_token,
      }
    }).promise(),
    db.put({
      TableName: 'eolia_report_status',
      Item: {
        id: status.appliance_id,
        timestamp: now,
        status: status
      }
    }).promise()
  ]);

  return status;
}

/**
 * 認証
 *
 * @param request
 * @returns
 */
export async function handleAcceptGrant(request: any) {
  return {
    'event': {
      'header': {
        'namespace': 'Alexa.Authorization',
        'name': 'AcceptGrant.Response',
        'payloadVersion': '3',
        'messageId': uuid()
      },
      'payload': {}
    }
  };
}

/**
 * 状態レポート
 *
 * @param request
 * @returns
 */
export async function handleReportState(request: any) {
  const db = getDynamoDB();
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  const currentStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: applianceId }
  }).promise();

  let reportStatus: EoliaStatus | undefined = undefined;
  let uncertainty = 0;
  if (currentStatusResult.Item) {
    const diffNow = DateTime.fromISO(currentStatusResult.Item.timestamp).diffNow().milliseconds * -1;

    if (diffNow < EoliaClient.OPERATION_TOKEN_LIFETIME) {
      reportStatus = currentStatusResult.Item.status;
      uncertainty = diffNow;
    }
  }

  if (!reportStatus) {
    const client = await getClient();
    reportStatus = await client.getDeviceStatus(applianceId);

    await db.put({
      TableName: 'eolia_report_status',
      Item: {
        id: reportStatus.appliance_id,
        timestamp: DateTime.local().toISO(),
        status: reportStatus
      }
    }).promise();
  }

  let reports;
  if (!childId) {
    reports = createThermostatReports(reportStatus, uncertainty);
  } else if (childId === 'Setting') {
    reports = createSettingReports(reportStatus, uncertainty);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'StateReport',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId
      },
      'payload': {}
    },
    'context': {
      'properties': reports
    }
  };
}
