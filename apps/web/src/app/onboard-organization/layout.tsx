import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Opportunity Brief | Africa Technology Foundation",
  description: "Submit your organisation's AI opportunity brief for the ATF AI Challenge program.",
};

export default function OnboardOrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
