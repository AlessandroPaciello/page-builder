import { auth, safeParseRole } from "@app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Guard deny-by-default a livello app (la dimostrazione dell'AC#2; il
  // enforcement RBAC del core arriva in Story 1.5 con Principal nel context
  // oRPC). Un ruolo fuori tassonomia non è mai trattato come ammesso.
  const role = safeParseRole(session.user.role);
  if (!role) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.user.name}</p>
      <p>Ruolo: {role}</p>
      <Dashboard />
    </div>
  );
}
