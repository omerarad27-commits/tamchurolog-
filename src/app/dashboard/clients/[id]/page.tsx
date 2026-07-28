import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import type { Client } from "@/lib/types";

import { ClientForm } from "../client-form";
import { DeleteClientButton } from "../delete-client-button";

export const metadata: Metadata = {
  title: "עריכת לקוח | תמחורולוג",
};

export default async function EditClientPage({
  params,
}: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("clients")
    .select("id, business_id, full_name, phone, email, notes, created_at")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) notFound();

  const client = data as Client;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          ‹ חזרה ללקוחות
        </Link>
        <h1 className="mt-2 truncate text-2xl font-bold">{client.full_name}</h1>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <ClientForm client={client} />
      </div>

      <DeleteClientButton id={client.id} fullName={client.full_name} />
    </div>
  );
}
