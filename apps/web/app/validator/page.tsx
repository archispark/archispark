"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ValidatorRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/views?tab=validateur"); }, [router]);
  return null;
}
