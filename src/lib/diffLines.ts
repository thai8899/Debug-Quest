export type DiffLine = { type: "same" | "del" | "add"; text: string; before?: number; after?: number };

// Line diff (longest common subsequence). Snippets are tiny, so the simple O(n*m) version is fine.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n"), b = after.split("\n");
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ type: "same", text: a[i], before: i, after: j }); i++; j++; }
    else if (i < a.length && (j === b.length || dp[i + 1][j] >= dp[i][j + 1])) { out.push({ type: "del", text: a[i], before: i }); i++; }
    else { out.push({ type: "add", text: b[j], after: j }); j++; }
  }
  return out;
}
