/**
 * Minimal HTTP client contract the sync engine depends on.
 *
 * Defined structurally (rather than importing axios) so this package stays
 * free of any particular HTTP library. Both consumers satisfy it:
 *   - the CLI's `httpService.Client` (an axios instance whose response
 *     interceptor unwraps `response.data`), and
 *   - `@spica-devkit/testing`'s own axios-based client.
 *
 * Each method resolves to the already-unwrapped response body (`R`), matching
 * the interceptor behaviour both consumers install.
 */
export interface SyncHttpClient {
  get<R = any>(url: string, config?: any): Promise<R>;
  delete<R = any>(url: string, config?: any): Promise<R>;
  head<R = any>(url: string, config?: any): Promise<R>;
  post<R = any>(url: string, data?: any, config?: any): Promise<R>;
  patch<R = any>(url: string, data?: any, config?: any): Promise<R>;
  put<R = any>(url: string, data?: any, config?: any): Promise<R>;
}
