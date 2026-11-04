"use client";

import DOMPurify from "dompurify";
import { useEffect, useState, type HTMLAttributes } from "react";

export function SafeHtml({ html, ...props }: Omit<HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML"> & { html?: string | null }) {
  const [safe, setSafe] = useState("");
  useEffect(() => {
    setSafe(DOMPurify.sanitize(html || "", {
      ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "a", "hr"],
      ALLOWED_ATTR: ["href", "title", "rel"],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    }));
  }, [html]);
  return <div {...props} dangerouslySetInnerHTML={{ __html: safe }} />;
}
