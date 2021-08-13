// TODO gzip とか
import { DateTime } from 'luxon';
import { env } from 'process';
import { v4 as uuid } from 'uuid';
import { EoliaClient } from './client/EoliaClient';
import { getAlexaThermostatMode, getDynamoDB, getEoliaOperationMode } from './function';

/** Turn ON時、指定した温度以上で冷房、それ以外は暖房とする */
const TEMPERATURE_COOL_THRESHOLD = 24;

require('./config');

exports.handler = async (request: any, context: any) => {
  const header = request.directive.header;
  const directiveNamespace = header.namespace;
  const directiveName = header.name;

  try {
    let response;
    console.log(`[Directive] namespace: ${directiveNamespace}, name: ${directiveName}`);

    if (directiveNamespace === 'Alexa.Discovery' && directiveName === 'Discover') {
      // 登録
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

    console.log(response);
    context.succeed(response);
  } catch (error) {
    console.log(error);
    context.fail(error);
  }
};

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
  const db = getDynamoDB();

  let currentStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: endpointId }
  }).promise();

  let reportStatus: EoliaStatus;
  let uncertainty: number;
  if (currentStatusResult.Item) {
    reportStatus = currentStatusResult.Item.status;
    uncertainty = DateTime.fromISO(currentStatusResult.Item.timestamp).diffNow().milliseconds * -1;
  } else {
    // TODO: 古い場合もここで更新
    const client = await getClient();
    reportStatus = await client.getDeviceStatus(endpointId);
    uncertainty = 0;
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

  let targetSetpoint: number = request.directive.payload.targetSetpoint.value;
  status.temperature = targetSetpoint;

  await updateStatus(client, status);

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

  let targetSetpointDelta: number = request.directive.payload.targetSetpointDelta.value;
  status.temperature += targetSetpointDelta;

  await updateStatus(client, status);

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

  status.operation_status = true;
  status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';

  await updateStatus(client, status);

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

  status.operation_status = false;

  await updateStatus(client, status);

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
  let operationMode = getEoliaOperationMode(thermostatMode);
  if (operationMode) {
    // 解釈できた場合のみモードを切り替える
    status.operation_mode = operationMode;
    status.operation_status = thermostatMode !== 'OFF';
  }

  await updateStatus(client, status);

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

  const db = getDynamoDB();

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
 */
async function updateStatus(client: EoliaClient, status: EoliaStatus) {
  const db = getDynamoDB();

  let prevStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: status.appliance_id }
  }).promise();
  let operation = client.createOperation(status);
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
  let thermostatMode: AlexaThermostatMode = !status.operation_status ?
    'OFF' : getAlexaThermostatMode(status.operation_mode);

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
        'value': status.temperature,
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
