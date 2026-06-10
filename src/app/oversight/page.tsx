import { CrmNav } from "@/components/CrmNav";
import { OversightView } from "@/components/OversightView";

export const dynamic = "force-dynamic";

export default function OversightPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <CrmNav active="oversight" />
      <OversightView />
    </div>
  );
}
