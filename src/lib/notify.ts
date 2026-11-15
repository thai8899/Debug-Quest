/** Fire-and-forget ntfy push. Never throws — failed alerts must not break a scan. */
export async function sendNtfyAlert(params: {
  repoName: string;
  bugCount: number;
  scanUrl: string;
}): Promise<void> {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) {
    console.warn("[ntfy] NTFY_TOPIC not set; skipping alert");
    return;
  }

  const body = `${params.bugCount} bugs found in ${params.repoName}. Play to unlock`;

  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: "Debug Quest",
        Priority: "high",
        Tags: "bug",
        Click: params.scanUrl,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[ntfy] push failed: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[ntfy] push error:", err instanceof Error ? err.message : err);
  }
}
