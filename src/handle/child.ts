import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { handleCleaningActivate, handleCleaningDeactivate } from './cleaning';
import { handleFanSetMode, handleFanTurnOff, handleFanTurnOn } from './fan';

/**
 * モード指定
 *
 * @param request
 */
export async function handleChildSetMode(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  let reports;
  if (childId === 'Fan') {
    reports = await handleFanSetMode(applianceId, request);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': reports
    }
  };
}

/**
 * Turn ON
 *
 * @param request
 */
export async function handleChildTurnOn(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  let reports;
  if (childId === 'Fan') {
    reports = await handleFanTurnOn(applianceId, request);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': reports
    }
  };
}

/**
 * Turn OFF
 *
 * @param request
 */
export async function handleChildTurnOff(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  let reports;
  if (childId === 'Fan') {
    reports = await handleFanTurnOff(applianceId, request);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
  }

  return {
    'event': {
      'header': {
        'namespace': 'Alexa',
        'name': 'Response',
        'messageId': uuid(),
        'correlationToken': request.directive.header.correlationToken,
        'payloadVersion': '3'
      },
      'endpoint': {
        'endpointId': applianceId,
      },
      'payload': {},
    },
    'context': {
      'properties': reports
    }
  };
}

/**
 * シーン有効
 *
 * @param request
 * @returns
 */
export async function handleChildSceneActivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  if (childId === 'NanoexCleaning') {
    await handleCleaningActivate(applianceId);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
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
 * シーン無効
 *
 * @param request
 * @returns
 */
export async function handleChildSceneDeactivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  if (childId === 'NanoexCleaning') {
    await handleCleaningDeactivate(applianceId);
  } else {
    throw new Error(`Undefined childId: ${childId}`);
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
