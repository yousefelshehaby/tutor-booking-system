"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { switchTaTutor } from "@/app/admin/(protected)/tas/actions";

export function TaTutorSwitcher({
  links,
  activeTutorId,
}: {
  links: { tutor_id: string; tutor_name: string }[];
  activeTutorId: string;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tutorId = e.target.value;
    if (tutorId === activeTutorId) return;

    setSwitching(true);
    await switchTaTutor(tutorId);
    setSwitching(false);
    router.refresh();
  }

  return (
    <div className="bg-blue-50 px-6 py-1.5 text-center text-xs font-medium text-blue-700">
      تعمل الآن مع:{" "}
      <select
        value={activeTutorId}
        onChange={handleChange}
        disabled={switching}
        className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700"
      >
        {links.map((link) => (
          <option key={link.tutor_id} value={link.tutor_id}>
            {link.tutor_name}
          </option>
        ))}
      </select>
    </div>
  );
}
