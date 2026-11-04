import type { Brief } from "@/lib/api/hooks/use-briefs";

export function BriefContacts({ brief }: { brief: Brief }) {
  if (!brief.contacts?.length && !brief.secondaryContact?.email) return null;
  const contacts = brief.contacts?.length ? brief.contacts : [{ id: "primary", ...brief.secondaryContact, isPrimary: true, isSubmitter: false }];
  return <section className="space-y-3 rounded-lg border bg-card p-5" aria-label="Brief contacts">
    <h2 className="font-semibold">Brief contacts</h2>
    <p className="text-sm text-muted-foreground">The main contact hosts this brief’s events. If no main contact is specified, events use the partner’s main contact.</p>
    <div className="grid gap-3 sm:grid-cols-2">{contacts.map(contact => <div key={contact.id} className="rounded-md border p-3 text-sm">
      <p className="font-medium">{contact.name || contact.email}</p>
      <p className="text-xs text-muted-foreground">{[contact.isPrimary ? "Main contact" : "Additional contact", contact.isSubmitter ? "Submitter" : "", contact.role].filter(Boolean).join(" · ")}</p>
      {contact.email && <a className="mt-1 block break-all hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>}
      {contact.phone && <p className="text-muted-foreground">{contact.phone}</p>}
    </div>)}</div>
  </section>;
}
