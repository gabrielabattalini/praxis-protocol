import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/legal-contact";

/**
 * Casca das páginas legais (termos/privacidade/reembolso). Públicas —
 * a Stripe e as lojas exigem esses links acessíveis sem login, e o
 * checkout aponta pra cá.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#070709] text-zinc-200">
      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-widest text-[var(--accent,#fb923c)]"
          >
            PRAXIS
          </Link>
          <nav className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <Link href="/legal/termos" className="hover:text-zinc-300">
              Termos
            </Link>
            <Link href="/legal/privacidade" className="hover:text-zinc-300">
              Privacidade
            </Link>
            <Link href="/legal/reembolso" className="hover:text-zinc-300">
              Reembolso
            </Link>
          </nav>
        </header>
        <main className="prose-invert space-y-6 text-sm leading-7 text-zinc-300 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </main>
        <footer className="mt-12 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Dúvidas? Escreva para{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </footer>
      </div>
    </div>
  );
}
