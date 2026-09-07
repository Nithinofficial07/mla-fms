import { api } from '@/api/client';

/**
 * Fetch an authenticated API endpoint as a file. Plain <a href>/window.open
 * to /api/... don't carry the Bearer token, so exports/prints 401. This does
 * the GET through axios (token attached), then hands the browser a blob.
 */
async function fetchBlob(path: string, params?: Record<string, string | number>) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const cd = (res.headers['content-disposition'] as string | undefined) ?? '';
  const name = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd)?.[1];
  return { blob: res.data as Blob, name: name ? decodeURIComponent(name) : undefined };
}

/** Trigger a "Save as" download of an authenticated endpoint. */
export async function downloadViaApi(
  path: string,
  params: Record<string, string | number> | undefined,
  fallbackName: string,
) {
  const { blob, name } = await fetchBlob(path, params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Open an authenticated endpoint (e.g. a PDF) in a new tab, for viewing/printing.
 * Opens the tab synchronously (before the await) so pop-up blockers don't kill it.
 */
export async function openViaApi(path: string, params?: Record<string, string | number>) {
  const tab = window.open('', '_blank');
  try {
    const { blob } = await fetchBlob(path, params);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url; // pop-up blocked -> navigate current tab
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
