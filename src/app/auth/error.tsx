"use client";

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Authentication Error</h1>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
