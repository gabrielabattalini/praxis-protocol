"use client";

import { ShoppingModulePage } from "@/components/modules/shopping-module-page";

export default function MarketModulePage() {
  return (
    <ShoppingModulePage
      scope="market"
      title="Mercado"
      description="Monte sua lista de mercado, informe o consumo diario e escolha se cada item sera comprado online ou presencialmente para estimar quanto comprar por mes e quanto vai gastar."
      storageKey="praxis-protocol:market-module-v1"
      sourceNames={["Mercado Livre", "Amazon", "Shopee", "Magazine Luiza"]}
      examples={["Ex.: carne moida", "Ex.: Friboi", "Ex.: 1 kg"]}
      emptyLabel="Itens do mercado monitorados"
    />
  );
}
