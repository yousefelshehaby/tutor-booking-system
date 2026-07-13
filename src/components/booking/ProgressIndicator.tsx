const STEP_LABELS = ["البيانات", "الصف الدراسي", "المجموعة", "الدفع"];

export function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="mb-8 flex w-full items-center">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isCompleted
                    ? "bg-blue-600 text-white"
                    : isCurrent
                      ? "border-2 border-blue-600 text-blue-600"
                      : "border-2 border-zinc-300 text-zinc-400"
                }`}
              >
                {isCompleted ? "✓" : stepNumber}
              </span>
              <span
                className={`text-xs ${isCurrent ? "font-semibold text-zinc-900" : "text-zinc-500"}`}
              >
                {label}
              </span>
            </div>
            {stepNumber !== STEP_LABELS.length && (
              <div
                className={`mx-2 h-0.5 flex-1 ${isCompleted ? "bg-blue-600" : "bg-zinc-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
