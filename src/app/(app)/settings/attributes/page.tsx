import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { AttributeForm } from "./attribute-form";

export default async function AttributesPage() {
  await requirePagePermission("admin");
  const attributes = await prisma.attributeDefinition.findMany({ orderBy: [{ cutStyle: "asc" }, { sortOrder: "asc" }, { label: "asc" }] });

  // Group by cut style ("every cut style" first).
  const groups = new Map<string, typeof attributes>();
  for (const a of attributes) {
    const k = a.cutStyle ?? "";
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Cut details</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Extra grading fields shown on a polished stone for its cut style — e.g. crown height on an Old Mine, facet
          count on a Rose cut. Fields can be renamed or deactivated but not deleted, so values already recorded keep
          their meaning.
        </p>
        <Link href="/settings" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>

      {ordered.map(([cut, list]) => (
        <section key={cut || "all"} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">{cut ? (CUT_STYLE_LABELS[cut] ?? cut) : "Every cut style"}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {list.map((a) => (
              <AttributeForm
                key={a.id}
                attributeId={a.id}
                attrKey={a.key}
                defaults={{ label: a.label, cutStyle: a.cutStyle, type: a.type, options: a.options, sortOrder: a.sortOrder, active: a.active }}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Add a field</h2>
        <AttributeForm defaults={{ label: "", cutStyle: null, type: "TEXT", options: [], sortOrder: 100, active: true }} />
      </section>
    </div>
  );
}
