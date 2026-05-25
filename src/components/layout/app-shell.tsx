import Link from "next/link";
import { BookOpenCheck, ClipboardList, FileText, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import type { Role } from "@/lib/types";

const links = {
  ADMIN: [
    { href: "/admin", label: "Admin", icon: ShieldCheck },
    { href: "/admin/paragraphs", label: "Paragraphs", icon: FileText },
  ],
  TEACHER: [{ href: "/teacher/tasks", label: "Tasks", icon: ClipboardList }],
};

export function AppShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const roleLinks = links[role];

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white md:block">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <BookOpenCheck className="h-5 w-5 text-[var(--primary)]" />
          <span className="font-semibold">Thesis Evaluation</span>
        </div>
        <nav className="space-y-1 p-3">
          {roleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur md:px-6">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">{role}</p>
            <p className="font-medium">{name}</p>
          </div>
          <LogoutButton />
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-1 border-t bg-white p-2 md:hidden">
        {roleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

