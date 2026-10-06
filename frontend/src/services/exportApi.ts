import { client } from './client'

// Bypasses the shared request<T>() JSON helper deliberately -- this is the only endpoint in the
// app whose response body isn't JSON, so it talks to the authenticated `client` instance directly
// with responseType: 'blob' instead. See frontend_spec_051_data_export.md.
export const exportApi = {
  downloadExport: (): Promise<Blob> =>
    client.get('/export', { responseType: 'blob' }).then((response) => response.data),
}
