import { DateTime } from 'luxon';
import { EoliaStatus } from 'panasonic-eolia-ts';
import { v4 as uuid } from 'uuid';
import { getDynamoDB } from '../util';
import { createReports, getClient, REFRESH_STATUS_MILLISECONDS, updateStatus } from './common';

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
 * https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html#state-report
 *
 * @param request
 * @returns
 */
export async function handleReportState(request: any) {
  const db = getDynamoDB();
  const applianceId = request.directive.endpoint.endpointId as string;

  const currentStatusResult = await db.get({
    TableName: 'eolia_report_status',
    Key: { id: applianceId }
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
    reportStatus = await client.getDeviceStatus(applianceId);
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
        'endpointId': applianceId
      },
      'payload': {}
    },
    'context': {
      'properties': createReports(reportStatus, uncertainty)
    }
  };
}
