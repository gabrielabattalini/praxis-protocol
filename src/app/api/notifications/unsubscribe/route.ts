import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { unsubscribeUserFromNotifications } from "@/lib/notification-center.server";

export const runtime = "nodejs";

// endpoint opcional: ausente = desinscreve TODOS os dispositivos.
// Quando presente, precisa ser uma URL válida — antes um `endpoint: ""`
// (ou null) caía no branch "sem endpoint" e apagava SILENCIOSAMENTE
// todas as subscriptions do usuário.
const bodySchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let endpoint: string | undefined;
  try {
    endpoint = bodySchema.parse(await request.json()).endpoint;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const status = await unsubscribeUserFromNotifications(userId, endpoint);
  return NextResponse.json(status);
}
