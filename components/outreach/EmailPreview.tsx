'use client';

import { useRef, useEffect, useState } from 'react';

interface Props {
  html: string;
}

export default function EmailPreview({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    // Adjust height after content loads
    const timer = setTimeout(() => {
      const body = doc.body;
      if (body) {
        setHeight(Math.min(800, Math.max(300, body.scrollHeight + 20)));
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [html]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white">
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        style={{ width: '100%', height: `${height}px`, border: 'none' }}
        title="Email Preview"
      />
    </div>
  );
}
