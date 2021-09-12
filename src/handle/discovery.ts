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

    const functions = await client.getFunctions(device.product_code);

    endpoints.push({
      // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
      'endpointId': device.appliance_id,
      'manufacturerName': manufacturerName,
      'friendlyName': device.nickname,
      'description': `${device.product_code} ${device.product_name}`,
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

    const supportLong = functions.has('air_flow_quiet_powerful_long');
    const supportNanoex = functions.has('nanoex');

    // 詳細設定
    endpoints.push({
      'endpointId': device.appliance_id + '@Fan',
      'manufacturerName': manufacturerName,
      // リビングエアコン → 詳細設定リビングエアコン(グループに紐づけて発話する想定)
      'friendlyName': '詳細設定' + device.nickname,
      'description': device.product_code + ' ' + device.product_name + 'の詳細設定',
      'displayCategories': ['OTHER'],
      'capabilities': [
        // 風量
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.ModeController',
          'instance': 'Eolia.WindVolume',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'mode'
              }
            ],
            'retrievable': true,
            'proactivelyReported': true,
            'nonControllable': false
          },
          'capabilityResources': {
            'friendlyNames': [
              {
                '@type': 'text',
                'value': {
                  'text': '風量',
                  'locale': 'ja-JP'
                }
              }
            ]
          },
          'configuration': {
            'ordered': false,
            'supportedModes': [
              // wind_volume
              {
                'value': 'WindVolume.0',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'asset',
                      'value': {
                        'assetId': 'Alexa.Setting.Auto'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': 'おまかせ',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindVolume.2',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '1',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindVolume.3',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '2',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindVolume.4',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '3',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindVolume.5',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '4',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              // air_flow
              {
                'value': 'AirFlow.powerful',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': 'パワフル',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'asset',
                      'value': {
                        'assetId': 'Alexa.Value.Maximum'
                      }
                    }
                  ]
                }
              },
              ...supportLong ? [{
                'value': 'AirFlow.long',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': 'ロング',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              }] : [],
              {
                'value': 'AirFlow.quiet',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '静か',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'asset',
                      'value': {
                        'assetId': 'Alexa.Value.Minimum'
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // 風向(上下)
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.ModeController',
          'instance': 'Eolia.WindDirection',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'mode'
              }
            ],
            'retrievable': true,
            'proactivelyReported': true,
            'nonControllable': false
          },
          'capabilityResources': {
            'friendlyNames': [
              {
                '@type': 'text',
                'value': {
                  // 風向だと認識せず
                  'text': '風向き',
                  'locale': 'ja-JP'
                }
              }
            ]
          },
          'configuration': {
            'ordered': false,
            'supportedModes': [
              {
                'value': 'WindDirection.0',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'asset',
                      'value': {
                        'assetId': 'Alexa.Setting.Auto'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': 'おまかせ',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirection.1',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↑ (1)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '1',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '一番上',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirection.2',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↖ (2)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '2',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirection.3',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '← (3)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '3',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '真ん中',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '中央',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirection.4',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↙ (4)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '4',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirection.5',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↓ (5)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '5',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '一番下',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // 風向(左右)
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa.ModeController',
          'instance': 'Eolia.WindDirectionHorizon',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'mode'
              }
            ],
            'retrievable': true,
            'proactivelyReported': true,
            'nonControllable': false
          },
          'capabilityResources': {
            'friendlyNames': [
              {
                '@type': 'text',
                'value': {
                  'text': '水平風向き',
                  'locale': 'ja-JP'
                }
              },
              {
                '@type': 'text',
                'value': {
                  'text': 'すいへいかざむき',
                  'locale': 'ja-JP'
                }
              }
            ]
          },
          'configuration': {
            'ordered': false,
            'supportedModes': [
              {
                'value': 'WindDirectionHorizon.auto',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'asset',
                      'value': {
                        'assetId': 'Alexa.Setting.Auto'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': 'おまかせ',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirectionHorizon.to_left',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↙ ↙ (1)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '1',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirectionHorizon.nearby_left',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↙ ↓ (2)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '2',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirectionHorizon.front',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↓ ↓ (3)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '3',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirectionHorizon.nearby_right',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↓ ↘ (4)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '4',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              },
              {
                'value': 'WindDirectionHorizon.to_right',
                'modeResources': {
                  'friendlyNames': [
                    {
                      '@type': 'text',
                      'value': {
                        'text': '↘ ↘ (5)',
                        'locale': 'ja-JP'
                      }
                    },
                    {
                      '@type': 'text',
                      'value': {
                        'text': '5',
                        'locale': 'ja-JP'
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // ナノイーX
        ...supportNanoex ? [{
          'type': 'AlexaInterface',
          'interface': 'Alexa.ToggleController',
          'instance': 'Eolia.Nanoex',
          'version': '3',
          'properties': {
            'supported': [
              {
                'name': 'toggleState'
              }
            ],
            'proactivelyReported': true,
            'retrievable': true,
            'nonControllable': false
          },
          'capabilityResources': {
            'friendlyNames': [
              {
                '@type': 'text',
                'value': {
                  'text': 'ナノイーX',
                  'locale': 'ja-JP'
                }
              }
            ]
          }
        }] : [],
        // Alexa
        {
          'type': 'AlexaInterface',
          'interface': 'Alexa',
          'version': '3'
        }
      ]
    });

    if (functions.has('nanoex_cleaning')) {
      // おでかけクリーン
      endpoints.push({
        // https://developer.amazon.com/ja-JP/docs/alexa/device-apis/alexa-thermostatcontroller.html
        'endpointId': device.appliance_id + '@NanoexCleaning',
        'manufacturerName': manufacturerName,
        'friendlyName': device.nickname + 'おでかけクリーン',
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
