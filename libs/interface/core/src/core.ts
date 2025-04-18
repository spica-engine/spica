export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}

export interface CorsOptions {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
}
