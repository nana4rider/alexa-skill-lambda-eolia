import { EoliaClient, EoliaHttpError, EoliaTemperatureError } from 'panasonic-eolia-ts';
import { v4 as uuid } from 'uuid';
import { AlexaError } from '../util';

/**
 * エラー処理
 *
 * @param request
 * @param error
 * @returns
 */
export function handleError(request: any, error: Error) {
  const applianceId = request.directive.endpoint.endpointId as string;

  let payload = undefined;
  if (error instanceof AlexaError) {
    payload = { type: error.type, message: error.message };
  } else if (error instanceof EoliaHttpError) {
    if (error.httpStatus === 409) {
      // Alexa: うまくいきませんでした
      // 他に適切なエラーがあれば。
      payload = { type: 'ALREADY_IN_OPERATION', message: `${error.code}: ${error.message}` };
    }
  } else if (error instanceof EoliaTemperatureError) {
    payload = {
      type: 'TEMPERATURE_VALUE_OUT_OF_RANGE',
      message: error.message,
      validRange: {
        minimumValue: {
          value: EoliaClient.MIN_TEMPERATURE,
          scale: 'CELSIUS'
        },
        maximumValue: {
          value: EoliaClient.MAX_TEMPERATURE,
          scale: 'CELSIUS'
        }
      }
    };
  }

  if (!payload) {
    payload = { type: 'INTERNAL_ERROR', message: error.message };
  }

  console.log('[error]', error.message);

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'ErrorResponse',
        'messageId': uuid(),
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': applianceId
      },
      'payload': payload
    }
  };
}
