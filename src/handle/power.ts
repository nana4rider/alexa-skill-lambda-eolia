import { v4 as uuid } from 'uuid';
import { createReports, getClient, TEMPERATURE_COOL_THRESHOLD, updateStatus } from './common';

/**
 * Turn ON
 *
 * @param request
 * @returns
 */
export async function handleTurnOn(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

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
 * Turn OFF
 *
 * @param request
 * @returns
 */
export async function handleTurnOff(request: any) {
  const applianceId = request.directive.endpoint.endpointId as string;

  const client = await getClient();
  let status = await client.getDeviceStatus(applianceId);

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
      'properties': createReports(status, 0)
    }
  };
}
