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

/**
 * Alexaエラー
 */
export class AlexaError extends Error {
  /**
   * コンストラクタ
   *
   * @param type https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-errorresponse.html#error-types
   * @param message エラーメッセージ
   */
  constructor(public type: string, message?: string) {
    super(message);
  }
}
