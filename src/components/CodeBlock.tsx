"use client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ code, language = "typescript" }: { code: string; language?: string }) {
  return (
    <SyntaxHighlighter language={language} style={oneDark} showLineNumbers
      customStyle={{ margin: 0, borderRadius: 12, fontSize: 13, background: "#10102a" }}>
      {code}
    </SyntaxHighlighter>
  );
}
