/** VSOP87 数据出处与截断记录 —— 由 scripts/generate-vsop87.mjs 生成，请勿手改。 */
export const VSOP87_PROVENANCE = {
  dataset: "VSOP87D.ear",
  description: "地球日心黄经/黄纬/向径，动力学黄道与当日平分点",
  sources: [
    {
      "name": "CDS/VizieR VI/81 (Strasbourg)",
      "url": "https://cdsarc.cds.unistra.fr/ftp/cats/VI/81/VSOP87D.ear"
    },
    {
      "name": "IMCCE (Observatoire de Paris)",
      "url": "ftp://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87D.ear"
    }
  ],
  sha256: "8b160c859136d467f2be7fc29efa8a9652e95516dfbde00e4c739d7ddc90ca91",
  cutoff: { L: 1e-9, R: 1e-8 },
  termCounts: { L: [506,223,75,8,4,2], R: [152,49,9,2,1,0] },
  totalTerms: { L: 818, R: 213 },
  originalTerms: { L: 1080, R: 997 },
  worstCaseResidual: { L_rad: 1.4176999999999993e-7, L_arcsec: 0.029242161546619985, R_au: 0.0000013716800000000002 },
} as const;
