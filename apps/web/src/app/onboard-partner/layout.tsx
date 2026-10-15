import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Opportunity Brief | Africa Technology Foundation",
  description: "Submit your partner's AI opportunity brief for the ATF AI Challenge program.",
};

export default function OnboardPartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
