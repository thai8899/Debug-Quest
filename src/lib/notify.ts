export type ScanAlert = {
  repoName: string;
  bugCount: number;
  scanUrl: string;
};

/** Fire-and-forget ntfy push. Never throws. */
export async function sendNtfyAlert(params: ScanAlert): Promise<void> {
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

/** Fire-and-forget Discord webhook. Never throws. */
export async function sendDiscordAlert(params: ScanAlert): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) {
    console.warn("[discord] DISCORD_WEBHOOK_URL not set; skipping alert");
    return;
  }

  const content =
    `**Debug Quest** — ${params.bugCount} bug(s) found in \`${params.repoName}\`.\n` +
    `Play to unlock: ${params.scanUrl}`;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Debug Quest",
        content,
        embeds: [
          {
            title: "Bugs found — play to unlock",
            description: `**${params.bugCount}** bug(s) in \`${params.repoName}\``,
            url: params.scanUrl,
            color: 0x00e5a0,
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[discord] webhook failed: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[discord] webhook error:", err instanceof Error ? err.message : err);
  }
}

/** Send all configured alert channels (ntfy + Discord). Failures never throw. */
export async function sendScanAlert(params: ScanAlert): Promise<void> {
  await Promise.all([sendNtfyAlert(params), sendDiscordAlert(params)]);
}
