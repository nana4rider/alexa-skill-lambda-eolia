import { v4 as uuid } from 'uuid';
import { getClient } from './common';

/**
 * 機器登録
 *
 * @param request
 * @returns
 */
export async function handleDiscover(request: any): Promise<object> {
  const endpoints = [];
  const client = await getClient();
  const devices = await client.getDevices();
  const manufacturerName = 'Eolia Client';

  for (const device of devices) {
    console.log('device:', device);

    endpoints.push({
      // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
      'endpointId': device.appliance_id,
      'manufacturerName': manufacturerName,
      'friendlyName': device.nickname,
      'description': device.product_code + ' ' + device.product_name,
      'displayCategories': ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
      'capabilities': [
        // エアコン
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.ThermostatController',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'targetSetpoint'
              },
              {
                'name': 'thermostatMode'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          },
          'configuration': {
            'supportedModes': ['AUTO', 'COOL', 'HEAT'],
            'supportsScheduling': false
          }
        },
        // 温度計
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.TemperatureSensor',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'temperature'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          }
        },
        // ON/OFF
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.PowerController',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'powerState'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true
          }
        },
        // Alexa
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa',
          'version': '3'
        }
      ]
    });

    // おでかけクリーン
    endpoints.push({
      // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
      'endpointId': device.appliance_id + '@NanoexCleaning',
      'manufacturerName': manufacturerName,
      'friendlyName': device.nickname + 'の掃除',
      'description': `${device.product_code} ${device.product_name} おでかけクリーン機能`,
      'displayCategories': ['SCENE_TRIGGER'],
      'capabilities': [
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.SceneController',
          'version': '3',
          'supportsDeactivation': true
        }
      ]
    });
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa.Discovery',
        'name': 'Discover.Response',
        'payloadVersion': '3',
        'messageId': uuid()
      },
      'payload': { 'endpoints': endpoints }
    }
  };
}
