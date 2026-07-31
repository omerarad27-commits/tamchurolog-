import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { parseQuestions } from "@/lib/intake";

import { DeleteFormButton } from "../delete-form-button";
import { FormBuilder } from "../form-builder";

export const metadata: Metadata = {
  title: "עריכת שאלון | תמחורולוג",
};

export default async function EditFormPage({
  params,
}: PageProps<"/dashboard/forms/[id]">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">עריכת שאלון</h1>
      <FormBuilder
        draft={{
          id: data.id,
          name: data.name,
          questions: parseQuestions(data.questions),
        }}
      />
      <DeleteFormButton id={data.id} name={data.name} />
    </div>
  );
}
