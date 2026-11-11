import { signOut } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** POST /api/auth/signout — cierra la sesión y redirige a /login. */
export async function POST() {
  await signOut();
  redirect("/login");
}
