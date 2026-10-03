"use client";

import { useState } from "react";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Owner / Admin", hint: "Everything, including costs and profit." },
  { value: "MANAGER", label: "Manager", hint: "Operations and stock. Costs only if allowed below." },
  { value: "OPERATOR", label: "Department operator", hint: "Issue/return in their departments only." },
  { value: "SALES", label: "Viewer / Sales", hint: "Stock and memo only, no costs." },
];

// Role, cost visibility, and department scope — shared by the add and edit
// user forms.
export function AccessFields({
  departments,
  defaults,
}: {
  departments: { id: string; name: string }[];
  defaults: { role: string; canSeeCosts: boolean; departmentIds: string[] };
}) {
  const [role, setRole] = useState(defaults.role);

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700">Role</legend>
        <div className="mt-2 flex flex-col gap-2">
          {ROLE_OPTIONS.map((r) => (
            <label
              key={r.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-zinc-200 px-3 py-2 has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-50"
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900">{r.label}</span>
                <span className="block text-xs text-zinc-500">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {role === "MANAGER" && (
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
          <input type="checkbox" name="canSeeCosts" defaultChecked={defaults.canSeeCosts} className="h-4 w-4" />
          Can see costs, profit, and rough price
        </label>
      )}

      {role === "OPERATOR" && (
        <fieldset>
          <legend className="block text-sm font-medium text-zinc-700">Departments</legend>
          <p className="text-xs text-zinc-500">They can only issue and return stones for these.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {departments.map((d) => (
              <label
                key={d.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  name="departmentIds[]"
                  value={d.id}
                  defaultChecked={defaults.departmentIds.includes(d.id)}
                  className="h-4 w-4"
                />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
