"use client";

export default function ProtectedError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Protected Route Error</h1>
      <pre>{error.message}</pre>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
