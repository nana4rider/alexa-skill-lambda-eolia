import { EoliaClient } from 'panasonic-eolia-ts';
import { v4 as uuid } from 'uuid';
import { AlexaThermostatMode } from '../model/AlexaThermostatMode';
import { createReports, DEFAULT_TEMPERATURE, getClient, getEoliaOperationMode, TEMPERATURE_COOL_THRESHOLD, updateStatus } from './common';

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
  let status = await client.getDeviceStatus(applianceId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';
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
export async function handleAdjustTargetTemperature(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

  // 強制的にONにする
  if (!status.operation_status) {
    status.operation_status = true;
    status.operation_mode = status.temperature >= TEMPERATURE_COOL_THRESHOLD ? 'Cooling' : 'Heating';
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
export async function handleSetThermostatMode(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

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
        status.ai_control = 'comfortable';
      }
      // ナノイーXもデフォルトにしておく
      status.nanoex = true;
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
      'properties': createReports(status, 0)
    }
  };
}
