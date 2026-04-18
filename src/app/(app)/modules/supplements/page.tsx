"use client";

import { ShoppingModulePage } from "@/components/modules/shopping-module-page";

export default function SupplementsModulePage() {
  return (
    <ShoppingModulePage
      scope="supplements"
      title="Suplementos / Remédios"
      description="Pesquise suplementos e remédios com nome, marca, quantidade e dose diária para comparar marketplaces e lojas do segmento, incluindo preço proporcional por grama ou por 100 g."
      storageKey="praxis-protocol:supplements-module-v1"
      sourceNames={[
        "Mercado Livre",
        "Amazon",
        "Shopee",
        "Growth",
        "Integralmedica",
        "Max Titanium",
        "Oficial Farma",
      ]}
      examples={["Ex.: whey protein concentrado", "Ex.: vitamina D3", "Ex.: 1 kg"]}
      emptyLabel="Suplementos e remédios monitorados"
    />
  );
}
