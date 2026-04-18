import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function getAuthenticatedUserId() {
  const session = await auth();
  return session.userId ?? null;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Autenticação obrigatória para usar notificações push.",
    },
    { status: 401 },
  );
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Corpo JSON inválido.");
  }
}
