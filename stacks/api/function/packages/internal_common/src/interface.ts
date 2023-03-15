export interface InitializeOptions {
  publicUrl?: string;
  interceptor?: InterceptorDef;
}

export interface ApikeyInitialization extends InitializeOptions {
  apikey: string;
}

export interface IdentityInitialization extends InitializeOptions {
  identity: string;
}

export interface InitializationResult {
  authorization: string;
  publicUrl: string;
  service: HttpService;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}

export interface BaseRequest {
  url?: string;
  headers?: any;
  params?: any;
  data?: any;
  method?:
    | "get"
    | "GET"
    | "delete"
    | "DELETE"
    | "head"
    | "HEAD"
    | "options"
    | "OPTIONS"
    | "post"
    | "POST"
    | "put"
    | "PUT"
    | "patch"
    | "PATCH"
    | "purge"
    | "PURGE"
    | "link"
    | "LINK"
    | "unlink"
    | "UNLINK";
}

export interface BaseResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: BaseRequest;
}

export interface InterceptorDef<
  Req extends BaseRequest = BaseRequest,
  Res extends BaseResponse<any> = BaseResponse<any>
> {
  request?: {
    onFulfilled: (r: Req) => Req | Promise<Req>;
    onRejected: (error: any) => any;
  };
  response?: {
    onFulfilled: (r: Res) => Res | Promise<Res>;
    onRejected: (error: any) => any;
  };
}

export interface InterceptorIds {
  request?: number;
  response?: number;
}

export interface HttpService {
  baseUrl: string;
  setBaseUrl(url: string): void;
  setAuthorization(authorization: string): void;
  setWriteDefaults(writeDefaults: {headers: {[key: string]: string}}): void;

  attachInterceptor(interceptor: InterceptorDef): InterceptorIds;
  detachInterceptor(interceptorIds: InterceptorIds): void;

  get<T>(url: string, options?: any): Promise<T>;
  post<T>(url: string, body: any, options?: any): Promise<T>;
  put<T>(url: string, body: any, options?: any): Promise<T>;
  patch<T>(url: string, body: any, options?: any): Promise<T>;
  delete(url: string, options?: any);
  request<T>(options: any): Promise<T>;
}