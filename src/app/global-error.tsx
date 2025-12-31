"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <h2>Global Application Error</h2>
        <pre>{error.message}</pre>
        <button onClick={() => reset()}>Retry</button>
      </body>
    </html>
  );
}
