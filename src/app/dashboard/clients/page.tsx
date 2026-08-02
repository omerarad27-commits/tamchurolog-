import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Client } from "@/lib/types";

import { ClientList } from "./client-list";

export const metadata: Metadata = {
  title: "לקוחות | תמחורולוג",
};

export default async function ClientsPage() {
  const { supabase, business } = await requireBusiness();

  const { data, error } = await supabase
    .from("clients")
    .select("id, business_id, full_name, phone, email, notes, created_at")
    .eq("business_id", business.id)
    .order("full_name", { ascending: true });

  const clients = (data ?? []) as Client[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1>לקוחות</h1>
        <ButtonLink href="/dashboard/clients/new" size="sm">
          לקוח חדש
        </ButtonLink>
      </div>

      {error ? (
        <p className="rounded-tile border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          טעינת הלקוחות נכשלה. רענן את הדף ונסה שוב.
        </p>
      ) : clients.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center">
          <p className="font-semibold">אין עדיין לקוחות</p>
          <p className="mt-1 text-sm text-muted">
            הוסף לקוח אחד, ומשם אפשר לבנות לו הצעת מחיר בכמה שניות.
          </p>
          <ButtonLink href="/dashboard/clients/new" className="mt-4">
            הוספת הלקוח הראשון
          </ButtonLink>
        </div>
      ) : (
        <ClientList
          rows={clients.map((client) => ({
            id: client.id,
            fullName: client.full_name,
            phoneLabel: client.phone
              ? formatPhoneForDisplay(client.phone)
              : null,
            phoneDigits: (client.phone ?? "").replace(/\D/g, ""),
          }))}
        />
      )}
    </div>
  );
}
