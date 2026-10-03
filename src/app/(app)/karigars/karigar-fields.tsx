export const karigarInputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

// Profile fields shared by the add and edit karigar forms.
export function KarigarFields({
  departments,
  defaults,
}: {
  departments: { id: string; name: string }[];
  defaults: { phone: string; employeeCode: string; joiningDate: string; notes: string; departmentIds: string[] };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Phone
          <input name="phone" type="tel" defaultValue={defaults.phone} className={karigarInputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Employee code
          <input name="employeeCode" defaultValue={defaults.employeeCode} className={karigarInputClass} />
        </label>
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Joining date
        <input name="joiningDate" type="date" defaultValue={defaults.joiningDate} className={karigarInputClass} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Departments</legend>
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
      <label className="text-sm font-medium text-zinc-700">
        Notes
        <input name="notes" defaultValue={defaults.notes} className={karigarInputClass} />
      </label>
    </div>
  );
}
