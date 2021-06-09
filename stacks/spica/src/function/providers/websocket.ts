export function provideWsInterceptor(baseUrl: string): string {
  return baseUrl.replace("http", "ws");
}
