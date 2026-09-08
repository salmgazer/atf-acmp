import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          ATF AI Challenge
        </h1>
        <p className="max-w-2xl text-center text-lg text-muted-foreground">
          The continent&apos;s largest hands-on Artificial Intelligence program. Upskill, form a
          team, and build solutions that solve Africa&apos;s toughest problems.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/portal/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Staff Portal
            </span>
            <span className="text-sm text-muted-foreground">Manage the platform</span>
          </Link>

          <Link
            href="/org/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Organization Portal
            </span>
            <span className="text-sm text-muted-foreground">Submit briefs</span>
          </Link>

          <Link
            href="/app/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Participant Portal
            </span>
            <span className="text-sm text-muted-foreground">Join the challenge</span>
          </Link>

          <Link
            href="/mentor/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Mentor Portal
            </span>
            <span className="text-sm text-muted-foreground">Guide teams</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
