import { api } from './api';

function filenameFromDisposition(header) {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function normalizeBlobError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      err.response.data = parsed;
    } catch {
      // keep the original error
    }
  }
  return err;
}

export async function downloadJobExport(jobId, decision = 'SHORTLIST') {
  try {
    const res = await api.get(`/jobs/${jobId}/export`, {
      params: { decision },
      responseType: 'blob',
    });
    const filename =
      filenameFromDisposition(res.headers['content-disposition']) ||
      `candidates-${decision.toLowerCase()}.csv`;
    triggerDownload(res.data, filename);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
}
