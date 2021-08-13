import { EoliaClient } from './client/EoliaClient';

const env = process.env;

void (async () => {
  const client = new EoliaClient(env.USER_ID!, env.PASSWORD!);

  let devices = await client.getDevices();
  // console.log(devices);

  let device = devices[1];
  let status = await client.getDeviceStatus(device.appliance_id);
  // console.log(status);

  let operation = client.createOperation(status);
  operation.operation_token = 'BS5ciQvf61oUNAp3';

  status = await client.setDeviceStatus(operation);
  console.log(operation.operation_token);
  status = await client.setDeviceStatus(operation);
  console.log(operation.operation_token);
  operation = await client.setDevicePowerOff(operation.appliance_id, operation.operation_token);
  console.log(operation.operation_token);
})();
