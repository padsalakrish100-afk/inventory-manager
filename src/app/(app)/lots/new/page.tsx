import { createLot } from "../actions";
import { LotForm } from "../lot-form";

export default function NewLotPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New lot</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Start tracking a rough batch before any cutting or polishing begins.
        </p>
      </div>
      <LotForm action={createLot} submitLabel="Create lot" />
    </div>
  );
}
