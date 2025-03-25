export interface Batch {
  requests: Request[];
  concurrenct: number;
}

export interface Request {
  id: string;
  method: ["GET", "POST", "PATCH", "DELETE"];
  url: string;
  body: object;
  headers: object;
}

export interface HTTPService {
  get<T>(url: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, data: Record<string, any>, headers?: Record<string, string>): Promise<T>;
  put<T>(url: string, data: Record<string, any>, headers?: Record<string, string>): Promise<T>;
  delete<T>(
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T>;
}

export const HTTP_SERVICE = Symbol.for("HTTP_SERVICE");
