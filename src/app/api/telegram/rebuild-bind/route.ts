import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getTelegramBinding,
  rebuildReverseBinding,
} from "@/lib/telegram-center.server";

export const runtime = "nodejs";

/**
 * Reconstrói a chave reversa `chatId → userId` pro bind atual do usuário.
 * Útil pra contas que conectaram Telegram antes da feature de botão inline
 * "Concluir" (a feature precisa do reverse lookup pra resolver o user a
 * partir do callback_query, e ele só era criado em novos binds).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const binding = await getTelegramBinding(userId);
  if (!binding) {
    return NextResponse.json(
      { ok: false, error: "Telegram não conectado." },
      { status: 400 },
    );
  }
  await rebuildReverseBinding(userId, binding.chatId);
  return NextResponse.json({ ok: true, chatId: binding.chatId });
}
