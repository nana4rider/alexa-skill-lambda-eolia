import { DateTime } from 'luxon';
import { getDynamoDB } from '../util';
import { getClient, getStatus, updateStatus } from './common';

/**
 * おそうじ/おでかけクリーン有効
 *
 * @param applianceId
 * @param operationMode
 */
export async function handleCleaningActivate(applianceId: string, operationMode: 'Cleaning' | 'NanoexCleaning') {
  const db = getDynamoDB();
  const nowDate = DateTime.local();
  const now = nowDate.toISO();

  const client = await getClient();
  const status = await getStatus(client, applianceId);

  if (status.operation_mode !== 'NanoexCleaning' && status.operation_mode !== 'Cleaning') {
    const prevCleaning = await db.get({
      TableName: 'eolia_cleaning',
      Key: { id: status.appliance_id }
    }).promise();

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
      status.operation_mode = operationMode;

      await updateStatus(client, status);

      await db.put({
        TableName: 'eolia_cleaning',
        Item: { id: status.appliance_id, lastCleaning: now }
      }).promise();
    }
  }
}

/**
 * おそうじ/おでかけクリーン無効
 *
 * @param applianceId
 */
export async function handleCleaningDeactivate(applianceId: string) {
  const client = await getClient();
  const status = await getStatus(client, applianceId);

  if (status.operation_mode === 'NanoexCleaning' || status.operation_mode === 'Cleaning') {
    // operation_modeを変更しないと掃除が止まらない
    status.operation_mode = 'Auto';
    status.operation_status = false;

    await updateStatus(client, status);
  }
}
