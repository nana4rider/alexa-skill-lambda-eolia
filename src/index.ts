import { DateTime } from 'luxon';
import { env } from 'process';
import { v4 as uuid } from 'uuid';
import { EoliaClient, EoliaHttpError, EoliaTemperatureError } from './client/EoliaClient';
import { getAlexaThermostatMode, getDynamoDB, getEoliaOperationMode } from './function';

/** Turn ON時、指定した温度以上で冷房、それ以外は暖房とする */
const TEMPERATURE_COOL_THRESHOLD = 24;
/** 指定時間を超えると、ReportState時にデータを再取得する */
const REFRESH_STATUS_MILLISECONDS = 60000;
/** デフォルトの設定温度  */
const DEFAULT_TEMPERATURE: { [s in EoliaOperationMode]?: number } = {
  Auto: 24,
  Cooling: 26,
  Heating: 20
};

const db = getDynamoDB();

require('./config');

exports.handler = async (request: any) => {
  const directiveNamespace = request.directive.header.namespace;
  const directiveName = request.directive.header.name;

  let response: any;
  console.log('[request]', directiveNamespace, directiveName);

  try {
    if (directiveNamespace === 'Alexa.Discovery' && directiveName === 'Discover') {
      // 機器登録
      response = await handleDiscover(request);
    } else if (directiveNamespace === 'Alexa.Authorization' && directiveName === 'AcceptGrant') {
      // 認証
      response = await handleAcceptGrant(request);
    } else if (directiveNamespace == 'Alexa' && directiveName == 'ReportState') {
      // 状態レポート
      response = await handleReportState(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'SetTargetTemperature') {
      // 温度指定(絶対値)
      response = await handleSetTargetTemperature(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'AdjustTargetTemperature') {
      // 温度指定(相対値)
      response = await handleAdjustTargetTemperature(request);
    } else if (directiveNamespace === 'Alexa.PowerController' && directiveName === 'TurnOn') {
      // ON
      response = await handleTurnOn(request);
    } else if (directiveNamespace === 'Alexa.PowerController' && directiveName === 'TurnOff') {
      // OFF
      response = await handleTurnOff(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'SetThermostatMode') {
      // モード指定
      response = await handleSetThermostatMode(request);
    } else {
      throw new Error(`namespace: ${directiveNamespace}, name: ${directiveName}`);
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    response = handleError(request, error);
  }

  // console.log(response);
  console.log('[response]', response.event.header.namespace, response.event.header.name);
  return response;
};

/**
 * エラー処理
 *
 * @param request
 * @param error
 * @returns
 */
function handleError(request: any, error: Error) {
  const endpointId = request.directive.endpoint.endpointId as string;

  let payload = undefined;
  if (error instanceof EoliaHttpError) {
    if (error.httpStatus === 409) {
      // Alexa: うまくいきませんでした
      // 他に適切なエラーがあれば。
      payload = { type: 'ALREADY_IN_OPERATION', message: `${error.code}: ${error.message}` };
    }
  } else if (error instanceof EoliaTemperatureError) {
    payload = {
      type: 'TEMPERATURE_VALUE_OUT_OF_RANGE',
      message: error.message,
      validRange: {
        minimumValue: {
          value: EoliaClient.MIN_TEMPERATURE,
          scale: 'CELSIUS'
        },
        maximumValue: {
          value: EoliaClient.MAX_TEMPERATURE,
          scale: 'CELSIUS'
        }
      }
    };
  }

  if (!payload) {
    payload = { type: 'INTERNAL_ERROR', message: error.message };
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'ErrorResponse',
        'messageId': uuid(),
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId
      },
      'payload': payload
    }
  };
}

/**
 * 機器登録
 *
 * @param request
 * @returns
 */
async function handleDiscover(request: any): Promise<object> {
  let endpoints = [];
  let client = await getClient();
  let devices = await client.getDevices();

  for (let device of devices) {
    console.log('device:', device);

    endpoints.push({
      // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
      'endpointId': device.appliance_id,
      'manufacturerName': 'Eolia Client',
      'friendlyName': device.nickname,
      'description': device.product_code + ' ' + device.product_name,
      'displayCategories': ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
      'cookie': {},
      'capabilities': [
        // エアコン
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.ThermostatController',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'targetSetpoint'
              },
              {
                'name': 'thermostatMode'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          },
          'configuration': {
            'supportedModes': ['AUTO', 'COOL', 'HEAT', 'ECO'],
            'supportsScheduling': false
          }
        },
        // 温度計
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.TemperatureSensor',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'temperature'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          }
        },
        // ON/OFF
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.PowerController',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'powerState'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          }
        },
        // Alexa
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa',
          'version': '3'
        }
      ]
    });
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa.Discovery',
        'name': 'Discover.Response',
        'payloadVersion': '3',
        'messageId': uuid()
      },
      'payload': { 'endpoints': endpoints }
    }
  };
}

/**
 * 認証
 *
 * @param request
 * @returns
 */
async function handleAcceptGrant(request: any) {
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
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#state-report
 *
 * @param request
 * @returns
 */
async function handleReportState(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  let currentStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: endpointId }
  }).promise();

  let reportStatus: EoliaStatus | undefined = undefined;
  let uncertainty: number = 0;
  if (currentStatusResult.Item) {
    reportStatus = currentStatusResult.Item.status;
    uncertainty = DateTime.fromISO(currentStatusResult.Item.timestamp).diffNow().milliseconds * -1;
  }

  // 機器新規登録時、もしくはデータが古い場合は更新
  if (!reportStatus || uncertainty >= REFRESH_STATUS_MILLISECONDS) {
    const client = await getClient();
    reportStatus = await client.getDeviceStatus(endpointId);
    if (currentStatusResult.Item) {
      await db.put({
        TableName: 'eolia_report_status',
        Item: {
          id: reportStatus.appliance_id,
          timestamp: DateTime.local().toISO(),
          status: reportStatus
        }
      }).promise();
    } else {
      reportStatus = await updateStatus(client, reportStatus);
    }
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
      'properties': createReports(reportStatus, uncertainty)
    }
  };
}

/**
 * 温度指定(絶対値)
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#settargettemperature-directive
 *
 * @param request
 * @returns
 */
async function handleSetTargetTemperature(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(endpointId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';
  }

  if (EoliaClient.isTemperatureSupport(status.operation_mode)) {
    let targetSetpoint: number = request.directive.payload.targetSetpoint.value;
    status.temperature = targetSetpoint;

    status = await updateStatus(client, status);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {},
    },
    'context': {
      'properties': createReports(status, 0)
    }
  };
}

/**
 * 温度指定(相対値)
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#adjusttargettemperature-directive
 *
 * @param request
 * @returns
 */
async function handleAdjustTargetTemperature(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(endpointId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';
  }

  if (EoliaClient.isTemperatureSupport(status.operation_mode)) {
    let targetSetpointDelta: number = request.directive.payload.targetSetpointDelta.value;
    status.temperature += targetSetpointDelta;

    status = await updateStatus(client, status);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {},
    },
    'context': {
      'properties': createReports(status, 0)
    }
  };
}

/**
 * Turn ON
 *
 * @param request
 * @returns
 */
async function handleTurnOn(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(endpointId);

  // 既にONになっている場合は返答のみ
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';

    status = await updateStatus(client, status);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {},
    },
    'context': {
      'properties': createReports(status, 0)
    }
  };
}

/**
 * Turn OFF
 *
 * @param request
 * @returns
 */
async function handleTurnOff(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(endpointId);

  // 既にOFFになっている場合は返答のみ
  if (status.operation_status) {
    status.operation_status = false;

    status = await updateStatus(client, status);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {},
    },
    'context': {
      'properties': createReports(status, 0)
    }
  };
}

/**
 * モード指定
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#setthermostatmode-directive
 *
 * @param request
 * @returns
 */
async function handleSetThermostatMode(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(endpointId);

  let thermostatMode: AlexaThermostatMode = request.directive.payload.thermostatMode.value;
  let nextOperationMode = getEoliaOperationMode(thermostatMode);
  if (nextOperationMode && nextOperationMode !== status.operation_mode) {
    // Alexaの指定モードを解釈できた場合もしくはモード変更がある場合のみ更新する
    status.operation_mode = nextOperationMode;
    status.operation_status = thermostatMode !== 'OFF';

    // 規定の温度を設定する
    if (status.operation_status && EoliaClient.isTemperatureSupport(nextOperationMode)
      && DEFAULT_TEMPERATURE[nextOperationMode]) {
      status.temperature = DEFAULT_TEMPERATURE[nextOperationMode]!;
      // ナノイーXもデフォルトにしておく
      status.nanoex = true;
      status.ai_control = 'comfortable';
    }

    status = await updateStatus(client, status);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {},
    },
    'context': {
      'properties': createReports(status, 0)
    }
  };
}

/**
 * Eoliaクライアントを取得します。
 *
 * @returns Eoliaクライアント
 */
export async function getClient() {
  if (!env.USER_ID || !env.PASSWORD) {
    throw new Error('User ID or Password is empty.');
  }

  let tokenResult = await db.get({
    TableName: 'tokens',
    Key: { id: 'eolia_access_token' }
  }).promise();

  const accessToken = tokenResult.Item?.access_token;

  return new EoliaClient(env.USER_ID, env.PASSWORD, accessToken);
}

/**
 * エアコンの状態を更新します。
 *
 * @param client Eoliaクライアント
 * @param status Eolia状態データ
 * @returns 更新後のEolia状態データ
 */
async function updateStatus(client: EoliaClient, status: EoliaStatus) {
  let operation = client.createOperation(status);
  let prevStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: status.appliance_id }
  }).promise();
  // 前回のトークンがある場合は使用する
  if (prevStatusResult.Item) {
    operation.operation_token = prevStatusResult.Item?.status.operation_token;
  }

  let updatedStatus = await client.setDeviceStatus(operation);

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
function createReports(status: EoliaStatus, uncertainty: number) {
  const now = DateTime.local().toISO();
  // operation_mode: Stopでputするとエラーを起こすので、operation_statusでOFF判断する
  let thermostatMode: AlexaThermostatMode = !status.operation_status ?
    'OFF' : getAlexaThermostatMode(status.operation_mode);
  let targetSetpoint = EoliaClient.isTemperatureSupport(status.operation_mode) ? status.temperature : 0;

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
