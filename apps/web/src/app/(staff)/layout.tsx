import { StaffRouteGuard } from "@/components/auth/staff-route-guard";

export default function StaffRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffRouteGuard>{children}</StaffRouteGuard>;
}
