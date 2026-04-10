// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\beta\page.tsx
export default function BetaPage() {
  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-[#E8E2D8]">Get access to ChiefOS</h1>
        <p className="mt-3 text-[#A8A090]">
          Stop stacking apps. Start running a system.
        </p>

        <div className="mt-8 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-5">
          <p className="text-sm text-[#A8A090]">
            Email:{" "}
            <a className="underline text-[#D4A853] hover:text-[#C49843]" href="mailto:hello@usechiefos.com">
              hello@usechiefos.com
            </a>
          </p>
          <p className="mt-2 text-sm text-[#A8A090]">
            Already set up? Go to{" "}
            <a className="underline text-[#D4A853] hover:text-[#C49843]" href="/login">
              Sign in
            </a>
            .
          </p>
        </div>

        <div className="mt-6 text-sm text-[#706A60]">
          Tell us your trade + crew size, and we’ll point you to the right plan.
        </div>
      </div>
    </main>
  );
}