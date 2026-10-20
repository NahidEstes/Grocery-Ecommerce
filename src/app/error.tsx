"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-container empty-state">
      <h1>A little hiccup.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
