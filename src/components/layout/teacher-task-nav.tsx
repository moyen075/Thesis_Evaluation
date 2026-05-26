"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TeacherSidebarTask {
  id: string;
  paragraphId: string;
  status: string;
}

export function TeacherTaskNav({ tasks }: { tasks: TeacherSidebarTask[] }) {
  const pathname = usePathname();
  const phase2Unlocked =
    tasks.length > 0 && tasks.every((task) => task.status !== "NOT_STARTED");

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 px-3">
        <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
          {phase2Unlocked ? "Phase 2 Tasks" : "Phase 1 Tasks"}
        </p>
      </div>
      <div className="space-y-1">
        {tasks.map((task) => {
          const href = `/teacher/tasks/${task.id}`;
          const isCurrent = pathname === href;
          const isDone = phase2Unlocked
            ? task.status === "PHASE_2_COMPLETE"
            : task.status !== "NOT_STARTED";
          const label = phase2Unlocked
            ? task.status === "PHASE_2_COMPLETE"
              ? "Done"
              : "Review"
            : task.status === "NOT_STARTED"
              ? "Phase 1"
              : "Done";

          return (
            <Link
              key={task.id}
              href={href}
              className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-[var(--muted)] ${
                isCurrent
                  ? "bg-[var(--muted)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
                ) : (
                  <Clock3 className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate font-medium">{task.paragraphId}</span>
              </span>
              <Badge
                className={`shrink-0 ${
                  isCurrent ? "border-[var(--primary)] text-[var(--primary)]" : ""
                }`}
              >
                {isCurrent ? "Current" : label}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
