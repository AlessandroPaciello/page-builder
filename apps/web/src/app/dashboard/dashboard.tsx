"use client";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export default function Dashboard() {
  const privateData = useQuery(orpc.privateData.queryOptions());

  return (
    <>
      <p>API: {privateData.data?.message}</p>
    </>
  );
}
