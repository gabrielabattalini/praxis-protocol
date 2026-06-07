"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, ImageIcon, Wind } from "lucide-react";
import {
  getRecoveryExerciseGuide,
  recoveryExerciseImageCandidates,
} from "@/lib/recovery-exercise-guide";

/**
 * Slot de imagem do exercício. Tenta os caminhos candidatos em
 * /public/recovery/<slug>.(webp|png|jpg) em ordem; o primeiro que existir
 * é exibido. Enquanto nenhum existir, mostra um placeholder na identidade
 * visual indicando exatamente onde colocar o arquivo. Ou seja: é só subir
 * a imagem na pasta /public/recovery/ que ela aparece sozinha aqui.
 */
function GuideImage({ slug, name }: { slug: string; name: string }) {
  const candidates = recoveryExerciseImageCandidates(slug);
  const [index, setIndex] = useState(0);

  if (index >= candidates.length) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.06)] text-center">
        <ImageIcon className="h-6 w-6 text-[var(--accent)]" />
        <p className="px-4 text-xs text-zinc-400">
          Imagem em breve — demonstração de{" "}
          <span className="text-zinc-200">{name}</span>
        </p>
        <p className="font-mono text-[10px] text-zinc-600">
          /recovery/{slug}.webp
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-white/10 bg-black/40">
      <Image
        key={candidates[index]}
        src={candidates[index]}
        alt={`Como executar: ${name}`}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 640px"
        className="object-cover"
        onError={() => setIndex((current) => current + 1)}
      />
    </div>
  );
}

/**
 * Aba "como executar" de um exercício de Recuperação: imagem (ou
 * placeholder) + passo a passo numerado + respiração + cuidados.
 * Retorna null se não houver guia cadastrado pro nome do exercício.
 */
export function RecoveryExerciseGuidePanel({ name }: { name: string }) {
  const guide = getRecoveryExerciseGuide(name);
  if (!guide) return null;

  return (
    <div className="mt-2 rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.05)] p-4">
      <GuideImage slug={guide.slug} name={name} />

      <p className="mt-4 font-label text-[0.55rem] uppercase tracking-widest text-[var(--accent)]">
        Como executar
      </p>
      <ol className="mt-2 space-y-2">
        {guide.steps.map((step, stepIndex) => (
          <li
            key={stepIndex}
            className="flex gap-3 text-sm leading-6 text-zinc-200"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-slate-950">
              {stepIndex + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {guide.breathing ? (
        <div className="mt-3 flex items-start gap-2 text-xs text-zinc-400">
          <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            <span className="font-semibold text-zinc-300">Respiração:</span>{" "}
            {guide.breathing}
          </span>
        </div>
      ) : null}

      {guide.cuidados ? (
        <div className="mt-2 flex items-start gap-2 text-xs text-zinc-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            <span className="font-semibold text-zinc-300">Cuidados:</span>{" "}
            {guide.cuidados}
          </span>
        </div>
      ) : null}
    </div>
  );
}
