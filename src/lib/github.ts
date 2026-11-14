const API = "https://api.github.com";

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${body.message ?? "request failed"}`);
  return body;
}

export async function whoami(): Promise<string> {
  return (await gh("/user")).login;
}

export async function defaultBranch(owner: string, repo: string): Promise<string> {
  return (await gh(`/repos/${owner}/${repo}`)).default_branch;
}

export async function canPush(owner: string, repo: string): Promise<boolean> {
  const r = await gh(`/repos/${owner}/${repo}`);
  return !!r.permissions?.push;
}

export async function ensureFork(owner: string, repo: string, me: string): Promise<string> {
  await gh(`/repos/${owner}/${repo}/forks`, { method: "POST", body: "{}" });
  for (let i = 0; i < 20; i++) {
    try {
      await gh(`/repos/${me}/${repo}`);
      return me;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Fork did not become available");
}

export async function openPr(opts: { owner: string; repo: string; head: string; base: string; title: string; body: string }) {
  const r = await gh(`/repos/${opts.owner}/${opts.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: opts.title, head: opts.head, base: opts.base, body: opts.body }),
  });
  return { url: r.html_url as string, number: r.number as number };
}
