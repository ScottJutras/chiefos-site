export default function BetaPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold">ChiefOS Beta</h1>
        <p className="mt-3 text-gray-600">
          Want early access? Email us and we’ll get you set up.
        </p>

        <div className="mt-8 rounded-lg border bg-gray-50 p-5">
          <p className="text-sm text-gray-700">
            Email:{" "}
            <a className="underline" href="mailto:hello@usechiefos.com">
              hello@usechiefos.com
            </a>
          </p>
          <p className="mt-2 text-sm text-gray-700">
            If you’re already in, go to{" "}
            <a className="underline" href="/login">
              Login
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
