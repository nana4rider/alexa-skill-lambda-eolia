import * as AWS from 'aws-sdk';
import { EoliaOperationMode } from 'panasonic-eolia-ts';
import { AlexaThermostatMode } from './model/AlexaThermostatMode';

/**
 * DynamoDBインスタンスを取得します。
 *
 * @returns DynamoDB
 */
export function getDynamoDB() {
  return new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
}

/**
 * Alexa操作モードを取得します。
 *
 * @param mode Eolia操作モード
 * @returns
 */
export function getAlexaThermostatMode(mode: EoliaOperationMode): AlexaThermostatMode {
  switch (mode) {
  case 'Auto':
    return 'AUTO';
  case 'Cooling':
  case 'CoolDehumidifying':
    return 'COOL';
  case 'Heating':
    return 'HEAT';
  case 'Stop':
    return 'OFF';
  }
  return 'CUSTOM';
}

/**
 * Eolia操作モードを取得します。
 *
 * @param mode Alexa操作モード
 * @param customName カスタム名
 * @returns
 */
export function getEoliaOperationMode(mode: AlexaThermostatMode, customName: string): EoliaOperationMode | undefined {
  switch (mode) {
  case 'AUTO':
    return 'Auto';
  case 'COOL':
    return 'Cooling';
  case 'HEAT':
    return 'Heating';
  case 'CUSTOM':
    switch (customName) {
    case 'DEHUMIDIFY':
      return 'CoolDehumidifying';
    case 'FAN':
      return 'Blast';
    }
    break;
  case 'OFF':
    return 'Stop';
  }
  return undefined;
}
