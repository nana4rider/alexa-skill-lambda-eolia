import * as luxon from 'luxon';
import { handleDiscover } from './handle/discovery';
import { handleError } from './handle/error';
import { handleAcceptGrant, handleReportState } from './handle/others';
import { handleTurnOff, handleTurnOn } from './handle/power';
import { handleSceneActivate, handleSceneDeactivate } from './handle/scene';
import { handleAdjustTargetTemperature, handleSetTargetTemperature, handleSetThermostatMode } from './handle/thermostat';

luxon.Settings.defaultLocale = 'ja';
luxon.Settings.defaultZone = 'Asia/Tokyo';
luxon.Settings.throwOnInvalid = true;

exports.handler = async (request: any) => {
  const directiveNamespace = request.directive.header.namespace;
  const directiveName = request.directive.header.name;

  let response: any;
  console.log('[request]', directiveNamespace, directiveName);
  console.log('[requestData]', JSON.stringify(request));

  try {
    if (directiveNamespace === 'Alexa.Discovery' && directiveName === 'Discover') {
      // 機器登録
      response = await handleDiscover(request);
    } else if (directiveNamespace === 'Alexa.Authorization' && directiveName === 'AcceptGrant') {
      // 認証
      response = await handleAcceptGrant(request);
    } else if (directiveNamespace == 'Alexa' && directiveName == 'ReportState') {
      // 状態レポート
      response = await handleReportState(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'SetTargetTemperature') {
      // 温度指定(絶対値)
      response = await handleSetTargetTemperature(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'AdjustTargetTemperature') {
      // 温度指定(相対値)
      response = await handleAdjustTargetTemperature(request);
    } else if (directiveNamespace === 'Alexa.PowerController' && directiveName === 'TurnOn') {
      // ON
      response = await handleTurnOn(request);
    } else if (directiveNamespace === 'Alexa.PowerController' && directiveName === 'TurnOff') {
      // OFF
      response = await handleTurnOff(request);
    } else if (directiveNamespace === 'Alexa.ThermostatController' && directiveName === 'SetThermostatMode') {
      // モード指定
      response = await handleSetThermostatMode(request);
    } else if (directiveNamespace === 'Alexa.SceneController' && directiveName === 'Activate') {
      // シーン有効
      response = await handleSceneActivate(request);
    } else if (directiveNamespace === 'Alexa.SceneController' && directiveName === 'Deactivate') {
      // シーン無効
      response = await handleSceneDeactivate(request);
    } else {
      throw new Error(`namespace: ${directiveNamespace}, name: ${directiveName}`);
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    response = handleError(request, error);
  }

  // console.log(response);
  console.log('[response]', response.event.header.namespace, response.event.header.name);
  return response;
};
