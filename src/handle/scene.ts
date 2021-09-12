import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { getDynamoDB } from '../util';
import { getClient, updateStatus } from './common';

/**
 * シーン有効
 *
 * @param request
 * @returns
 */
export async function handleSceneActivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, sceneId] = endpointId.split('@');

  if (sceneId === 'NanoexCleaning') {
    await handleCleaningActivate(applianceId);
  } else {
    throw new Error(`Undefined scene: ${sceneId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa.SceneController',
        'name': 'ActivationStarted',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {
        'cause': {
          'type': 'APP_INTERACTION'
        },
        'timestamp': DateTime.local().toISO()
      }
    },
    'context': {}
  };
}

/**
 * おでかけクリーン有効
 *
 * @param applianceId
 */
async function handleCleaningActivate(applianceId: string) {
  const db = getDynamoDB();
  const nowDate = DateTime.local();
  const now = nowDate.toISO();

  const client = await getClient();
  const status = await client.getDeviceStatus(applianceId);

  if (status.operation_mode !== 'NanoexCleaning' && status.operation_mode !== 'Cleaning') {
    const prevCleaning = await db.get({
      TableName: 'eolia_cleaning',
      Key: { id: status.appliance_id }
    }).promise();
    // 前回のトークンがある場合は使用する

    let doCleaning: boolean;
    if (prevCleaning.Item) {
      const lastDate = DateTime.fromISO(prevCleaning.Item.lastCleaning);
      // 実行を日毎に制限する
      doCleaning = lastDate.year !== nowDate.year
        || lastDate.month !== nowDate.month
        || lastDate.day !== nowDate.day;
    } else {
      doCleaning = true;
    }

    if (doCleaning) {
      status.operation_status = false;
      status.operation_mode = 'NanoexCleaning';

      await updateStatus(client, status);

      await db.put({
        TableName: 'eolia_cleaning',
        Item: { id: status.appliance_id, lastCleaning: now }
      }).promise();
    }
  }
}

/**
 * シーン無効
 *
 * @param request
 * @returns
 */
export async function handleSceneDeactivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, sceneId] = endpointId.split('@');

  if (sceneId === 'NanoexCleaning') {
    await handleCleaningDeactivate(applianceId);
  } else {
    throw new Error(`Undefined scene: ${sceneId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa.SceneController',
        'name': 'DeactivationStarted',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': endpointId,
      },
      'payload': {
        'cause': {
          'type': 'APP_INTERACTION'
        },
        'timestamp': DateTime.local().toISO()
      }
    },
    'context': {}
  };
}

/**
 * おでかけクリーン無効
 *
 * @param applianceId
 */
async function handleCleaningDeactivate(applianceId: string) {
  const client = await getClient();
  const status = await client.getDeviceStatus(applianceId);

  if (status.operation_mode === 'NanoexCleaning' || status.operation_mode === 'Cleaning') {
    // operation_modeを変更しないと掃除が止まらない
    status.operation_mode = 'Auto';
    status.operation_status = false;

    await updateStatus(client, status);
  }
}
