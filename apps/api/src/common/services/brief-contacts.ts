import { BadRequestException, ConflictException } from "@nestjs/common";
import { isEmail } from "class-validator";
import { EntityManager, Raw } from "typeorm";
import { Brief, SecondaryContact } from "@/database/entities/brief.entity";
import { BriefContact } from "@/database/entities/brief-contact.entity";
import { Organization, OrganizationUser, OrganizationUserRole } from "@/database/entities/organization.entity";
import { Role, User } from "@/database/entities/user.entity";

export const normalizedEmail = (email: string) => email.trim().toLowerCase();
export interface BriefHost { name: string; email: string; source: "brief" | "partner" }

export async function ensurePartnerContactLogin(manager: EntityManager, organizationId: string, contact: SecondaryContact, owner = false) {
  const email = normalizedEmail(contact.email || "");
  if (!isEmail(email)) throw new BadRequestException("A valid contact email is required");
  const organization = await manager.findOne(Organization, { where: { email: Raw(alias => `LOWER(${alias}) = :contactEmail`, { contactEmail: email }) }, withDeleted: true });
  if (organization && organization.id !== organizationId) throw new ConflictException("Contact email belongs to another partner");
  let user = await manager.findOne(User, { where: { email: Raw(alias => `LOWER(${alias}) = :contactEmail`, { contactEmail: email }) }, withDeleted: true });
  if (user && (user.deletedAt || !user.isActive || user.role !== Role.ORGANIZATION)) throw new ConflictException("Contact email is already used by an unavailable or different account");
  if (user) {
    const links = await manager.find(OrganizationUser, { where: { userId: user.id }, withDeleted: true });
    if (links.some(link => link.organizationId !== organizationId)) throw new ConflictException("Contact already belongs to another partner");
  } else {
    const [firstName, ...lastName] = (contact.name || "").trim().split(/\s+/);
    user = await manager.save(User, manager.create(User, { email, role: Role.ORGANIZATION, firstName, lastName: lastName.join(" "), isActive: true }));
  }
  const link = await manager.findOne(OrganizationUser, { where: { organizationId, userId: user.id }, withDeleted: true });
  if (link?.deletedAt) throw new ConflictException("The contact's partner membership was removed; restore it before importing");
  // Legacy partner main-contact logins had implicit owner access without a membership.
  // Adding a brief contact must preserve that access; existing explicit roles stay unchanged.
  const primaryOwner = owner || organization?.id === organizationId;
  if (!link) await manager.save(OrganizationUser, manager.create(OrganizationUser, { organizationId, userId: user.id, role: primaryOwner ? OrganizationUserRole.OWNER : OrganizationUserRole.MEMBER, isPrimary: primaryOwner }));
  return user;
}

export async function saveBriefContacts(manager: EntityManager, brief: Brief, primary?: SecondaryContact | null, submitter?: SecondaryContact) {
  await manager.update(BriefContact, { briefId: brief.id, isPrimary: true }, { isPrimary: false });
  const entries = [primary?.email?.trim() ? { ...primary, isPrimary: true, isSubmitter: false } : null,
    submitter?.email?.trim() ? { ...submitter, isPrimary: false, isSubmitter: true } : null];
  for (const contact of entries) {
    if (!contact) continue;
    const email = normalizedEmail(contact.email!);
    await ensurePartnerContactLogin(manager, brief.organizationId, contact);
    const existing = await manager.findOne(BriefContact, { where: { briefId: brief.id, email }, withDeleted: true });
    if (existing?.deletedAt) await manager.restore(BriefContact, existing.id);
    await manager.save(BriefContact, manager.create(BriefContact, {
      ...existing, briefId: brief.id, email, name: contact.name || existing?.name || email,
      role: contact.role || existing?.role, phone: contact.phone || existing?.phone,
      isPrimary: contact.isPrimary || !!existing?.isPrimary, isSubmitter: contact.isSubmitter || !!existing?.isSubmitter, deletedAt: undefined,
    }));
  }
}

export async function resolveBriefHost(manager: EntityManager, brief: Brief): Promise<BriefHost> {
  const contact = await manager.findOne(BriefContact, { where: { briefId: brief.id, isPrimary: true } });
  const organization = brief.organization || await manager.findOneByOrFail(Organization, { id: brief.organizationId });
  return briefHostContact(brief, organization, contact);
}

export function briefHostContact(brief: Brief, org: Organization, contact?: BriefContact | null): BriefHost {
  if (contact) return { name: contact.name || contact.email, email: normalizedEmail(contact.email), source: "brief" };
  // Compatibility for existing briefs until their contact has been edited/backfilled.
  if (brief.secondaryContact?.email && isEmail(brief.secondaryContact.email.trim())) return {
    name: brief.secondaryContact.name || brief.secondaryContact.email, email: normalizedEmail(brief.secondaryContact.email), source: "brief",
  };
  return { name: org.contactPerson || org.name, email: normalizedEmail(org.email), source: "partner" };
}
