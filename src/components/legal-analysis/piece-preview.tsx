"use client";

import { pieceTabs } from "@/lib/legal-analysis/constants";
import type {
  GeneratedPieceKey,
  GeneratedPieces,
} from "@/types/legal-analysis";
import {
  ActionButton,
  ChoiceButton,
  SectionCard,
  StatusPill,
} from "@/components/legal-analysis/ui";

export function PiecePreview({
  activeTab,
  pieces,
  onTabChange,
  onCopyCurrent,
  onCopyParecer,
  onCopyMinuta,
  onExportPdf,
  onExportWord,
  onPrint,
}: {
  activeTab: GeneratedPieceKey;
  pieces: GeneratedPieces;
  onTabChange: (tab: GeneratedPieceKey) => void;
  onCopyCurrent: () => void;
  onCopyParecer: () => void;
  onCopyMinuta: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onPrint: () => void;
}) {
  return (
    <SectionCard
      title="Pré-visualização textual"
      description="As peças são geradas automaticamente com base nos dados do fluxo e podem ser copiadas, impressas ou exportadas."
      actions={<StatusPill label="Auto gerado" tone="info" />}
      className="h-full"
    >
      <div className="flex flex-wrap gap-2">
        {pieceTabs.map((tab) => (
          <ChoiceButton
            key={tab.key}
            active={tab.key === activeTab}
            onClick={() => onTabChange(tab.key)}
            type="button"
            className="px-3 py-2 text-xs"
          >
            {tab.label}
          </ChoiceButton>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton type="button" onClick={onCopyCurrent}>
          Copiar texto atual
        </ActionButton>
        <ActionButton type="button" tone="secondary" onClick={onCopyParecer}>
          Copiar parecer
        </ActionButton>
        <ActionButton type="button" tone="secondary" onClick={onCopyMinuta}>
          Copiar minuta
        </ActionButton>
        <ActionButton type="button" tone="ghost" onClick={onExportPdf}>
          Exportar PDF
        </ActionButton>
        <ActionButton type="button" tone="ghost" onClick={onExportWord}>
          Exportar Word
        </ActionButton>
        <ActionButton type="button" tone="ghost" onClick={onPrint}>
          Imprimir
        </ActionButton>
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.96))] p-5">
        <pre className="max-h-[820px] overflow-auto whitespace-pre-wrap font-mono text-[0.83rem] leading-7 text-slate-800">
          {pieces[activeTab]}
        </pre>
      </div>
    </SectionCard>
  );
}
