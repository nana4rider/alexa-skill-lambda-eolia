import { DateTime } from 'luxon';
import { EoliaClient, EoliaOperationMode, EoliaStatus } from 'panasonic-eolia-ts';
import { v4 as uuid } from 'uuid';
import { AlexaThermostatMode } from '../model/AlexaThermostatMode';
import { DEFAULT_TEMPERATURE, getAlexaThermostatMode, getClient, getEoliaOperationMode, getStatus, updateStatus } from './common';

/**
 * 温度指定(絶対値)
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#settargettemperature-directive
 *
 * @param request
 * @returns
 */
export async function handleSetTargetTemperature(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await getStatus(client, applianceId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = getDefaultOperationMode(status);
  }

  const targetSetpoint: number = request.directive.payload.targetSetpoint.value;

  if (EoliaClient.isTemperatureSupport(status.operation_mode) && status.temperature !== targetSetpoint) {
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
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': createThermostatReports(status, 0)
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
export async function handleAdjustTargetTemperature(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await getStatus(client, applianceId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = getDefaultOperationMode(status);
  }

  if (EoliaClient.isTemperatureSupport(status.operation_mode)) {
    const targetSetpointDelta: number = request.directive.payload.targetSetpointDelta.value;
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
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': createThermostatReports(status, 0)
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
export async function handleSetThermostatMode(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await getStatus(client, applianceId);

  const thermostatMode: AlexaThermostatMode = request.directive.payload.thermostatMode.value;
  const customName: string = request.directive.payload.thermostatMode.customName;
  const nextOperationMode = getEoliaOperationMode(thermostatMode, customName);
  if (nextOperationMode && nextOperationMode !== status.operation_mode) {
    // Alexaの指定モードを解釈できた場合かつモード変更がある場合のみ更新する
    status.operation_mode = nextOperationMode;
    status.operation_status = thermostatMode !== 'OFF';

    if (status.operation_status) {
      // 規定の温度を設定する
      if (EoliaClient.isTemperatureSupport(nextOperationMode)
        && DEFAULT_TEMPERATURE[nextOperationMode]) {
        status.temperature = DEFAULT_TEMPERATURE[nextOperationMode]!;
        // AI快適をON
        status.ai_control = 'comfortable';
      }
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
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': createThermostatReports(status, 0)
    }
  };
}

/**
 * Turn ON
 *
 * @param request
 * @returns
 */
export async function handleTurnOn(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await getStatus(client, applianceId);

  // 既にONになっている場合は返答のみ
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = getDefaultOperationMode(status);

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
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': createThermostatReports(status, 0)
    }
  };
}

/**
 * Turn OFF
 *
 * @param request
 * @returns
 */
export async function handleTurnOff(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await getStatus(client, applianceId);

  // 既にOFFになっている場合は返答のみ
  // operation_status=falseでも掃除中の場合があるので、operation_mode=STOPでOFFかどうかを確認する
  if (status.operation_mode !== 'Stop') {
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
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': createThermostatReports(status, 0)
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
export function createThermostatReports(status: EoliaStatus, uncertainty: number) {
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

/**
 * デフォルトの運転モードを取得
 *
 * @param status
 * @returns 運転モード
 */
function getDefaultOperationMode(status: EoliaStatus): EoliaOperationMode {
  const month  = DateTime.local().month;

  if ([5, 6, 7, 8, 9].includes(month)) {
    return 'Cooling';
  } else {
    return 'Heating';
  }
}
