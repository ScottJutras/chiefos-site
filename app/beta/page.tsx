// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\beta\page.tsx
export default function BetaPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold">Get access to ChiefOS</h1>
        <p className="mt-3 text-gray-600">
          Stop stacking apps. Start running a system.
        </p>

        <div className="mt-8 rounded-lg border bg-gray-50 p-5">
          <p className="text-sm text-gray-700">
            Email:{" "}
            <a className="underline" href="mailto:hello@usechiefos.com">
              hello@usechiefos.com
            </a>
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Already set up? Go to{" "}
            <a className="underline" href="/login">
              Sign in
            </a>
            .
          </p>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          Tell us your trade + crew size, and we’ll point you to the right plan.
        </div>
      </div>
    </main>
  );
}