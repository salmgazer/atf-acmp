export interface Organization {
  id: string;
  name: string;
  email: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
