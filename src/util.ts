import * as AWS from 'aws-sdk';

let db: AWS.DynamoDB.DocumentClient | undefined = undefined;

/**
 * DynamoDBインスタンスを取得します。
 *
 * @returns DynamoDB
 */
export function getDynamoDB() {
  if (!db) {
    db = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
  }
  return db;
}
