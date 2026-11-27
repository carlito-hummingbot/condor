import { Navigate, useLocation } from "react-router-dom";

import { isChatLink } from "@/lib/chatLinks";
import { Dashboard } from "@/pages/Dashboard";

/** `/`: the sample Dashboard, or a chat deep link on its way to `/chat`. Showcase only. */
export function Home() {
  const { search } = useLocation();
  if (isChatLink(search)) return <Navigate to={`/chat${search}`} replace />;
  return <Dashboard />;
}
