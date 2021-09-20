import { DateTime } from 'luxon';
import { EoliaStatus } from 'panasonic-eolia-ts';
import { AlexaError } from '../util';
import { getClient, updateStatus } from './common';

/**
 * モード指定
 *
 * @param applianceId
 * @param request
 */
export async function handleSettingSetMode(applianceId: string, request: any) {
  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

  if (!status.operation_status) {
    throw new AlexaError('NOT_IN_OPERATION');
  }

  let updated = false;
  const instanceName: string = request.directive.header.instance;
  const [modeKey, modeValue] = (request.directive.payload.mode as string).split('.');

  if (instanceName === 'Eolia.WindVolume') {
    // 風量
    if (modeKey === 'AirFlow') {
      if (status.air_flow !== modeValue) {
        status.wind_volume = 0;
        status.air_flow = modeValue as any;
        updated = true;
      }
    } else if (modeKey === 'WindVolume') {
      const windVolume = Number(modeValue);
      if (status.wind_volume !== windVolume || status.air_flow !== 'not_set') {
        status.wind_volume = windVolume as any;
        status.air_flow = 'not_set';
        updated = true;
      }
    }
  } else if (instanceName === 'Eolia.WindDirection') {
    // 風向(上下)
    const windDirection = Number(modeValue);
    if (status.wind_direction !== windDirection) {
      status.wind_direction = windDirection as any;
      updated = true;
    }
  } else if (instanceName === 'Eolia.WindDirectionHorizon') {
    // 風向(左右)
    if (status.wind_direction_horizon !== modeValue) {
      status.wind_direction_horizon = modeValue as any;
      updated = true;
    }
  } else if (instanceName === 'Eolia.AiControl') {
    // AIコントロール
    if (status.ai_control !== modeValue) {
      status.ai_control = modeValue as any;
      updated = true;
    }
  }

  if (updated) {
    status = await updateStatus(client, status);
  }

  return createSettingReports(status, 0);
}

/**
 * Turn ON
 *
 * @param applianceId
 * @param request
 */
export async function handleSettingTurnOn(applianceId: string, request: any) {
  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

  if (!status.operation_status) {
    throw new AlexaError('NOT_IN_OPERATION');
  }

  let updated = false;
  const instanceName: string = request.directive.header.instance;

  if (instanceName === 'Eolia.Nanoex') {
    // ナノイーX
    if (!status.nanoex) {
      status.nanoex = true;
      updated = true;
    }
  }

  if (updated) {
    status = await updateStatus(client, status);
  }

  return createSettingReports(status, 0);
}

/**
 * Turn OFF
 *
 * @param applianceId
 * @param request
 */
export async function handleSettingTurnOff(applianceId: string, request: any) {
  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

  if (!status.operation_status) {
    throw new AlexaError('NOT_IN_OPERATION');
  }

  let updated = false;
  const instanceName: string = request.directive.header.instance;

  if (instanceName === 'Eolia.Nanoex') {
    // ナノイーX
    if (status.nanoex) {
      status.nanoex = false;
      updated = true;
    }
  }

  if (updated) {
    status = await updateStatus(client, status);
  }

  return createSettingReports(status, 0);
}

/**
 * 変更レポートを作成します。
 *
 * @param status Eolia状態データ
 * @param uncertainty
 * @returns 変更レポート
 */
export function createSettingReports(status: EoliaStatus, uncertainty: number) {
  const now = DateTime.local().toISO();

  return [
    // 風量
    {
      'namespace': 'Alexa.ModeController',
      'instance': 'Eolia.WindVolume',
      'name': 'mode',
      'value': status.air_flow !== 'not_set' ?
        'AirFlow.' + status.air_flow : 'WindVolume.' + status.wind_volume,
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // 風向(上下)
    {
      'namespace': 'Alexa.ModeController',
      'instance': 'Eolia.WindDirection',
      'name': 'mode',
      'value': 'WindDirection.' + status.wind_direction,
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // 風向(左右)
    {
      'namespace': 'Alexa.ModeController',
      'instance': 'Eolia.WindDirectionHorizon',
      'name': 'mode',
      'value': 'WindDirectionHorizon.' + status.wind_direction_horizon,
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // ナノイーX
    {
      'namespace': 'Alexa.ToggleController',
      'instance': 'Eolia.Nanoex',
      'name': 'toggleState',
      'value': status.nanoex ? 'ON' : 'OFF',
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
    // AIコントロール
    {
      'namespace': 'Alexa.ModeController',
      'instance': 'Eolia.AiControl',
      'name': 'mode',
      'value': 'AiControl.' + status.ai_control,
      'timeOfSample': now,
      'uncertaintyInMilliseconds': uncertainty
    },
  ];
}
