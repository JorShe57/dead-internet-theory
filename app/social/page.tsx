import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSessionServerSide } from "@/lib/server/auth";
import SocialClient from "@/components/social/SocialClient";

/**
 * Server-side social page with authentication check
 * Performs auth validation server-side to avoid client-side flash
 */
export default async function SocialPage() {
  // Get session token from cookies
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("dit_session_token")?.value;
  
  // If no token, redirect to home
  if (!sessionToken) {
    redirect("/");
  }
  
  // Validate session server-side
  const isValid = await validateSessionServerSide(sessionToken);
  
  // If invalid, redirect to home
  if (!isValid) {
    redirect("/");
  }
  
  // If valid, render the client component
  return <SocialClient />;
}
