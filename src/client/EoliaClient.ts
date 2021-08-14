import axios, { AxiosInstance } from 'axios';
import { DateTime } from 'luxon';

export class EoliaClient {
  static readonly API_BASE_URL = 'https://app.rac.apws.panasonic.com/eolia/v2';
  static readonly MIN_TEMPERATURE = 16;
  static readonly MAX_TEMPERATURE = 30;
  static readonly TEMPERATURE_SUPPORT_MODES: EoliaOperationMode[] = ['Auto', 'Cooling', 'Heating', 'CoolDehumidifying'];

  private client: AxiosInstance;

  constructor(private userId: string, private password: string,
    public accessToken: string | undefined = undefined,
    private baseURL: string = EoliaClient.API_BASE_URL) {

    const options = {
      baseURL: baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept-Language': 'ja-jp',
        'Accept-Encoding': 'gzip'
      },
    };

    this.client = axios.create(options);

    this.client.interceptors.request.use(requestConfig => {
      console.log('[axios]', requestConfig.method, requestConfig.url);

      if (this.accessToken) {
        requestConfig.headers.Cookie = 'atkn=' + this.accessToken;
      }

      requestConfig.headers['X-Eolia-Date'] = DateTime.local().toFormat('yyyy-MM-dd\'T\'HH:mm:ss');

      return requestConfig;
    });

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
      let data = error.response.data;
      let httpStatus = error.response.status as number;
      if (data.code) {
        console.log('[eolia]', httpStatus, data.code, data.message);
      }

      if (error.response.status === 401 && !error.config._retry) {
        error.config._retry = true;
        await this.login();
        return await this.client.request(error.config);
      }

      if (error.response.data.code) {
        throw new EoliaHttpError(error, httpStatus, data.code, data.message);
      } else {
        throw error;
      }
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
    if (operation.operation_mode === 'Stop') {
      operation.operation_mode = 'Auto';
    }

    const applianceId = operation.appliance_id;
    const response = await this.client.put(`/devices/${applianceId}/status`, operation);
    operation.operation_token = response.data.operation_token;
    return response.data;
  }

  createOperation(status: EoliaStatus): EoliaOperation {
    if (EoliaClient.isTemperatureSupport(status.operation_mode)
      && (status.temperature < EoliaClient.MIN_TEMPERATURE
        || status.temperature > EoliaClient.MAX_TEMPERATURE)) {
      throw new EoliaTemperatureError(status.temperature);
    }

    let operation: EoliaOperation = {
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

    return operation;
  }

  static isTemperatureSupport(mode: EoliaOperationMode) {
    return EoliaClient.TEMPERATURE_SUPPORT_MODES.includes(mode);
  }
}

export class EoliaHttpError extends Error {
  constructor(public cause: Error,
    public httpStatus: number,
    public code: string,
    message: string) {
    super(message);
  }
}

export class EoliaTemperatureError extends Error {
  constructor(public temperature: number) {
    super('temperature: ' + temperature);
  }
}
