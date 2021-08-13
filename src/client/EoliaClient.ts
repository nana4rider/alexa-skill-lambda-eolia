import axios, { AxiosInstance } from 'axios';
import { DateTime } from 'luxon';

export class EoliaClient {
  static readonly API_BASE_URL = 'https://app.rac.apws.panasonic.com/eolia/v2';
  static readonly LOWER_TEMPERATURE = 16;
  static readonly UPPER_TEMPERATURE = 30;

  private client: AxiosInstance;

  constructor(private userId: string, private password: string,
    private accessToken: string | undefined = undefined,
    private baseURL: string = EoliaClient.API_BASE_URL) {

    const options = {
      baseURL: baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept-Language': 'ja-jp',
      },
    };

    this.client = axios.create(options);

    this.client.interceptors.request.use(
      requestConfig => {

        if (this.accessToken) {
          requestConfig.headers.Cookie = 'atkn=' + this.accessToken;
        }

        requestConfig.headers['X-Eolia-Date'] = DateTime.local().toFormat('yyyy-MM-dd\'T\'HH:mm:ss');

        return requestConfig;
      }
    );

    this.client.interceptors.response.use(response => {
      if (response.headers['set-cookie']) {
        const resCookie: string = response.headers['set-cookie'][0];
        const tokenMatcher = resCookie.match(/atkn=(.+?);/);
        if (tokenMatcher) {
          this.accessToken = tokenMatcher[1];
        }
      }

      return response;
    }, async error => {
      if (error.response.status === 401 && !error.config._retry) {
        error.config._retry = true;
        await this.login();
        return await this.client.request(error.config);
      }

      throw error;
    });
  }

  async login(userId = this.userId, password = this.password,
    options = {}) {
    const response = await this.client.post('/auth/login', {
      idpw: {
        id: userId,
        pass: password,
        terminal_type: 3,
        next_easy: true,
        ...options
      }
    });
    this.userId = userId;
    this.password = password;
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async getDevices(): Promise<EoliaDevice[]> {
    const response = await this.client.get('/devices');
    return response.data.ac_list;
  }

  async getDeviceStatus(applianceId: string): Promise<EoliaStatus> {
    const response = await this.client.get(`/devices/${applianceId}/status`);
    return { ...response.data, operation_token: null };
  }

  async setDeviceStatus(operation: EoliaOperation): Promise<EoliaStatus> {
    const applianceId = operation.appliance_id;
    const response = await this.client.put(`/devices/${applianceId}/status`, operation);
    operation.operation_token = response.data.operation_token;
    return response.data;
  }

  async setDevicePowerOff(applianceId: string, operationToken: string | null = null) {
    return await this.setDeviceStatus({
      appliance_id: applianceId,
      operation_token: operationToken,
      // Set dummy data.
      operation_status: false,
      nanoex: false,
      wind_volume: 0,
      air_flow: 'not_set',
      wind_direction: 0,
      wind_direction_horizon: 'auto',
      timer_value: 0,
      operation_mode: 'Auto',
      temperature: 20,
      ai_control: 'off',
      airquality: false
    });
  }

  createOperation(status: EoliaStatus): EoliaOperation {
    if (status.temperature < EoliaClient.LOWER_TEMPERATURE) {
      status.temperature = EoliaClient.LOWER_TEMPERATURE;
    }
    if (status.temperature > EoliaClient.UPPER_TEMPERATURE) {
      status.temperature = EoliaClient.UPPER_TEMPERATURE;
    }

    let operation : EoliaOperation = {
      appliance_id: status.appliance_id,
      operation_status: status.operation_status,
      nanoex: status.nanoex,
      wind_volume: status.wind_volume,
      air_flow: status.air_flow,
      wind_direction: status.wind_direction,
      wind_direction_horizon: status.wind_direction_horizon,
      timer_value: status.timer_value,
      operation_mode: status.operation_mode,
      temperature: status.temperature,
      ai_control: status.ai_control,
      airquality: status.airquality,
      operation_token: status.operation_token,
    };

    if (operation.operation_mode === 'Stop') {
      operation.operation_mode = 'Auto';
    }

    return operation;
  }
}
