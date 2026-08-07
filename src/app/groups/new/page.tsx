"use client";

import { useRouter } from "next/navigation";
import GroupDetailPanel from "@/components/GroupDetailPanel";

export default function NewGroupPage() {
  const router = useRouter();

  return (
    <GroupDetailPanel
      group={null}
      isNew
      variant="page"
      onClose={() => router.push("/groups")}
    />
  );
}
