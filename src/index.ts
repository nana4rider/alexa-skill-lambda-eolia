import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { EoliaClient } from './client/EoliaClient';

const env = process.env;

exports.handler = async (request: any, context: any) => {
  const header = request.directive.header;
  const directiveNamespace = header.namespace;
  const directiveName = header.name;

  try {
    let response;
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
  let client = getClient();
  let devices = await client.getDevices();

  for (let device of devices) {
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
  const endpointId = request.directive.endpoint.endpointId;

  const uncertainty = 60000; // TODO

  // TODO
  const data: EoliaStatus = {
    'operation_token': 'fxghxn0sC0uoytXZ',
    'appliance_id': endpointId,
    'operation_status': true,
    'operation_mode': 'Cooling',
    'temperature': 26.0,
    'wind_volume': 2,
    'wind_direction': 3,
    'inside_humidity': 45,
    'inside_temp': 25.0,
    'outside_temp': 23.0,
    'operation_priority': false,
    'timer_value': 0,
    'device_errstatus': false,
    'airquality': false,
    'nanoex': false,
    'aq_value': -1,
    'aq_name': 'off',
    'ai_control': 'off',
    'air_flow': 'not_set',
    'wind_shield_hit': 'not_set',
    'wind_direction_horizon': 'to_left'
  };

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
      'properties': createReports(data, uncertainty)
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
  const endpointId = request.directive.endpoint.endpointId;

  const client = getClient();
  let status = await client.getDeviceStatus(endpointId);

  let targetSetpoint: number = request.directive.payload.targetSetpoint.value;
  status.temperature = targetSetpoint;

  // TODO do operation
  client.createOperation(status);

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
  const endpointId = request.directive.endpoint.endpointId;

  const client = getClient();
  let status = await client.getDeviceStatus(endpointId);

  let targetSetpointDelta: number = request.directive.payload.targetSetpointDelta.value;
  status.temperature += targetSetpointDelta;

  // TODO do operation
  client.createOperation(status);

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
  const endpointId = request.directive.endpoint.endpointId;

  const client = getClient();
  let status = await client.getDeviceStatus(endpointId);

  let thermostatMode: AlexaThermostatMode = request.directive.payload.thermostatMode.value;
  let operationMode = getEoliaOperationMode(thermostatMode);
  if (operationMode) {
    // 解釈できた場合のみモードを切り替える
    status.operation_mode = operationMode;
  }

  // TODO do operation
  client.createOperation(status);

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
 * 変更レポートを作成します。
 *
 * @param status Eolia状態データ
 * @param uncertainty
 * @returns 変更レポート
 */
function createReports(status: EoliaStatus, uncertainty: number) {
  const now = DateTime.local().toISO();

  return [
    // モード指定
    {
      'namespace': 'Alexa.ThermostatController',
      'name': 'thermostatMode',
      'value': getAlexaThermostatMode(status.operation_mode),
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

/**
 * Alexa操作モードを取得します。
 *
 * @param mode Eolia操作モード
 * @returns
 */
function getAlexaThermostatMode(mode: EoliaOperationMode): AlexaThermostatMode {
  switch (mode) {
  case 'Auto':
    return 'AUTO';
  case 'Cooling':
    return 'COOL';
  case 'Heating':
    return 'HEAT';
  case 'Nanoe':
    return 'ECO';
  case 'Stop':
    return 'OFF';
  }
  return 'CUSTOM';
}

/**
 * Eolia操作モードを取得します。
 *
 * @param mode Alexa操作モード
 * @returns
 */
function getEoliaOperationMode(mode: AlexaThermostatMode): EoliaOperationMode | undefined {
  switch (mode) {
  case 'AUTO':
    return 'Auto';
  case 'COOL':
    return 'Cooling';
  case 'HEAT':
    return 'Heating';
  case 'ECO':
    return 'Nanoe';
  case 'OFF':
    return 'Stop';
  }
  return undefined;
}

/**
 * Eoliaクライアントを取得します。
 *
 * @returns Eoliaクライアント
 */
function getClient() {
  if (!env.USER_ID || !env.PASSWORD) {
    throw new Error('User ID or Password is empty.');
  }

  // TODO
  const accessToken = '2191bd32e5c1ff11dde9dade87fb0e1be70bd949452863626ac6b1f557763413';

  return new EoliaClient(env.USER_ID, env.PASSWORD, accessToken);
}
