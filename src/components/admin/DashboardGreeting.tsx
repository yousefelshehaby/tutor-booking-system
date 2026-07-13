export function DashboardGreeting({ greeting, subtitle }: { greeting: string; subtitle?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-l from-blue-600 to-blue-500 px-6 py-7 shadow-sm sm:px-8 sm:py-8">
      <p className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{greeting}</p>
      {subtitle && <p className="mt-2 text-sm text-blue-100 sm:text-base">{subtitle}</p>}
    </div>
  );
}
