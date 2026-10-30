"use client";
export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f4f8f0",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: 560,
            margin: "15vh auto",
            padding: 32,
            background: "white",
            borderRadius: 16,
          }}
        >
          <h1>Store temporarily unavailable</h1>
          <p>
            We could not connect to the store. Your saved basket has been kept.
            Please try again shortly.
          </p>
          <p lang="bn">
            স্টোরের সঙ্গে সংযোগ করা যায়নি। সংরক্ষিত কার্ট রাখা হয়েছে। একটু পরে
            আবার চেষ্টা করুন।
          </p>
          <button
            onClick={retry}
            style={{
              padding: 14,
              border: 0,
              borderRadius: 8,
              color: "white",
              background: "#ff5b00",
              cursor: "pointer",
            }}
          >
            Try again / আবার চেষ্টা করুন
          </button>
        </main>
      </body>
    </html>
  );
}
