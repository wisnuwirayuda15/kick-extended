// Content scripts bypass CORS; a userscript's page fetch does not.
// Route every cross-origin call through GM_xmlhttpRequest instead.
export function gmFetch(url, opts: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: opts.method || "GET",
      url,
      headers: opts.headers || {},
      timeout: opts.timeout || 15000,
      onload: (r) =>
        resolve({
          ok: r.status >= 200 && r.status < 300,
          status: r.status,
          json: () => JSON.parse(r.responseText),
          text: () => r.responseText,
        }),
      onerror: () => reject(new Error("network")),
      ontimeout: () => reject(new Error("timeout")),
    });
  });
}

export function checkStreamUrl(url) {
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: "HEAD",
      url,
      timeout: 3000,
      onload: (r) => resolve(r.status >= 200 && r.status < 300 ? url : null),
      onerror: () => resolve(null),
      ontimeout: () => resolve(null),
    });
  });
}
