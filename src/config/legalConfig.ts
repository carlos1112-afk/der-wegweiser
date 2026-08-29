/**
 * Legal & Operator Configuration — Der Wegweiser
 * 
 * Trennung von Quellcode-Templates und dynamischen/Build-zeitigen Betreiberangaben.
 * Ermöglicht die Bereitstellung des Quellcodes ohne unnötig fest eingebrannte
 * Privatanschriften, während der Release-Build und die Website das vollständige
 * gesetzliche Impressum gem. § 5 DDG und DSGVO einbinden.
 */

export interface LegalConfig {
  operatorName: string;
  operatorAddress: string;
  operatorEmail: string;
  serverLocation: string;
  disputeResolutionUrl: string;
}

export const LEGAL_CONFIG: LegalConfig = {
  operatorName: import.meta.env.VITE_OPERATOR_NAME || 'Pascal Gregor',
  operatorAddress: import.meta.env.VITE_OPERATOR_ADDRESS || 'Lindenstraße 8, 02979 Spreetal',
  operatorEmail: import.meta.env.VITE_OPERATOR_EMAIL || 'wegweiser-app@proton.me',
  serverLocation: 'Google Cloud Platform (Frankfurt am Main, Region europe-west3, Art. 28 DSGVO DPA)',
  disputeResolutionUrl: 'https://ec.europa.eu/consumers/odr/',
};
