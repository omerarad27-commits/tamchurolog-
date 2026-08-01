import type { Metadata } from "next";

import { FormBuilder } from "../form-builder";

export const metadata: Metadata = {
  title: "שאלון חדש | תמחורולוג",
};

export default function NewFormPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">שאלון חדש</h1>
      <FormBuilder />
    </div>
  );
}
