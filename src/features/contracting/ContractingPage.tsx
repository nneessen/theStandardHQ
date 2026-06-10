// src/features/contracting/ContractingPage.tsx
// Entry for the /contracting route — the Contracting Hub (Concept C).

import { ContractingHubPage } from "./ContractingHubPage";

export function ContractingPage({ initialTab }: { initialTab?: string }) {
  return <ContractingHubPage initialTab={initialTab} />;
}

export default ContractingPage;
