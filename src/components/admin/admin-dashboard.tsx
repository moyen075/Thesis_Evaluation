"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Teacher {
  id: string;
  email: string;
  full_name: string;
}

interface ParagraphAssignment {
  id: string;
  paragraphId: string;
  teacherIds: string[];
  locked: boolean;
}

interface AdminDashboardProps {
  stats: {
    teachers: number;
    paragraphs: number;
    activeTasks: number;
    completedTasks: number;
  };
  teachers: Teacher[];
  assignments: ParagraphAssignment[];
}

export function AdminDashboard({
  stats,
  teachers,
  assignments,
}: AdminDashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [draftAssignments, setDraftAssignments] = useState(
    () =>
      new Map(
        assignments.map((assignment) => [
          assignment.id,
          [
            assignment.teacherIds[0] ?? "",
            assignment.teacherIds[1] ?? "",
          ] as string[],
        ])
      )
  );

  const workloads = useMemo(() => {
    const counts = new Map(teachers.map((teacher) => [teacher.id, 0]));
    for (const assignment of assignments) {
      for (const teacherId of assignment.teacherIds) {
        counts.set(teacherId, (counts.get(teacherId) ?? 0) + 1);
      }
    }
    return counts;
  }, [assignments, teachers]);

  async function runAction(name: string, request: () => Promise<Response>) {
    setLoading(name);
    setMessage("");
    try {
      const response = await request();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Request failed"
        );
      }
      setMessage(data.created !== undefined ? `Created ${data.created} assignments.` : "Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  async function deleteTeacher(id: string, name: string) {
    if (!confirm(`Delete ${name}? This will remove their account and all assigned tasks.`)) return;
    await runAction(`delete-${id}`, () =>
      fetch("/api/admin/teachers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    );
  }

  async function createTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await runAction("teacher", () =>
      fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      })
    );

    form.reset();
  }

  async function saveAssignment(paragraphId: string) {
    const teacherIds = draftAssignments.get(paragraphId) ?? [];
    await runAction(`assignment-${paragraphId}`, () =>
      fetch("/api/admin/assignments/manual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraphId, teacherIds }),
      })
    );
  }

  async function clearAllAssignments() {
    if (!confirm("Clear all unstarted assignments? Only NOT_STARTED tasks will be removed.")) return;
    await runAction("clear-all", () =>
      fetch("/api/admin/assignments/manual", { method: "DELETE" })
    );
  }

  return (
    <div className="space-y-6 pb-16 md:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Dataset, teachers, assignments, and exports
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading !== null}
            onClick={() =>
              runAction("import", () =>
                fetch("/api/admin/import/fake-news", { method: "POST" })
              )
            }
          >
            {loading === "import" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            Import YAML
          </Button>
          <Button
            type="button"
            disabled={loading !== null}
            onClick={() =>
              runAction("auto", () =>
                fetch("/api/admin/assignments/auto", { method: "POST" })
              )
            }
          >
            {loading === "auto" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Auto assign
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading !== null}
            onClick={clearAllAssignments}
          >
            {loading === "clear-all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-red-500" />
            )}
            Clear All
          </Button>
          <a href="/api/admin/export">
            <Button type="button" variant="secondary">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </a>
        </div>
      </div>

      {message && (
        <p className="rounded-md border bg-white px-3 py-2 text-sm">{message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Teachers" value={stats.teachers} />
        <StatCard icon={<Database className="h-4 w-4" />} label="Paragraphs" value={stats.paragraphs} />
        <StatCard icon={<RefreshCw className="h-4 w-4" />} label="Active tasks" value={stats.activeTasks} />
        <StatCard icon={<Download className="h-4 w-4" />} label="Completed" value={stats.completedTasks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Create Teacher
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createTeacher} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary password</Label>
                  <Input id="password" name="password" type="password" minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading !== null}>
                  {loading === "teacher" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Create account
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h2 className="font-semibold">Workload</h2>
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex items-center justify-between rounded-md border bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{teacher.full_name}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{teacher.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{workloads.get(teacher.id) ?? 0}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading !== null}
                    onClick={() => deleteTeacher(teacher.id, teacher.full_name)}
                  >
                    {loading === `delete-${teacher.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-red-500" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Paragraph Assignments</h2>
            <Badge>{assignments.length} paragraphs</Badge>
          </div>
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Paragraph</th>
                  <th className="px-3 py-2 font-medium">Teacher 1</th>
                  <th className="px-3 py-2 font-medium">Teacher 2</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const draft = draftAssignments.get(assignment.id) ?? ["", ""];
                  return (
                    <tr key={assignment.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{assignment.paragraphId}</td>
                      {[0, 1].map((index) => (
                        <td key={index} className="px-3 py-2">
                          <select
                            className="h-9 w-full rounded-md border bg-white px-2"
                            value={draft[index] ?? ""}
                            disabled={assignment.locked}
                            onChange={(event) => {
                              const next = [...draft];
                              next[index] = event.target.value;
                              setDraftAssignments(
                                new Map(draftAssignments).set(assignment.id, next)
                              );
                            }}
                          >
                            <option value="">Unassigned</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.full_name}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {assignment.locked ? (
                          <Badge className="border-amber-300 bg-amber-50 text-amber-800">Locked</Badge>
                        ) : (
                          <Badge>Editable</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={assignment.locked || loading !== null}
                          onClick={() => saveAssignment(assignment.id)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

