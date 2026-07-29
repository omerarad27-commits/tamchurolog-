import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Client } from "@/lib/types";

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
        <h1 className="text-2xl font-bold">לקוחות</h1>
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
        <ul className="flex flex-col gap-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{client.full_name}</p>
                  {client.phone ? (
                    <p className="numeric truncate text-sm text-muted">
                      {formatPhoneForDisplay(client.phone)}
                    </p>
                  ) : (
                    <p className="truncate text-sm text-warning">חסר טלפון</p>
                  )}
                </div>
                <span aria-hidden="true" className="text-muted">
                  ‹
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
