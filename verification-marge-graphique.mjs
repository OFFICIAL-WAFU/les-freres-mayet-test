import assert from 'node:assert/strict';
import { createServer } from 'vite';
const srv = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', configFile: 'vite.config.ts' });
try {
  const { activiteAnnuelle } = await srv.ssrLoadModule('/src/lib/activite-annuelle.ts');
  const { margeGraphique, tauxMargeGraphique } = await srv.ssrLoadModule('/src/lib/marge-graphique.ts');
  const facture = { id: 'F', type: 'facture', statut: 'Finalisé', date: '15/10/2026', montantHTCentimes: 25000n, montantCentimes: 30000n, deduction: { statut: 'finalise', ht: 5000n, ttc: 6000n } };
  const docs = [facture,
    { id: 'A', type: 'acompte', statut: 'Finalisé', date: '15/10/2026', montantHTCentimes: 5000n },
    { id: 'AV', type: 'avoir', statut: 'Finalisé', date: '16/10/2026', factureSource: { id: 'F' }, montantHTCentimes: 2000n, montantCentimes: 2400n },
    { ...facture, id: 'B', statut: 'Brouillon' },
    { ...facture, id: 'DEMO', fictif: true }];
  const ca = activiteAnnuelle(docs, '2026-11-07', 'ht');
  const achats = [
    { date_achat: '2026-10-01', total_ht_centimes: 10000 },
    { date_achat: '2026-10-31', total_ht_centimes: '2000' },
    { date_achat: '2026-11-01', total_ht_centimes: 5000 },
    { date_achat: '2026-12-31', total_ht_centimes: 1000 },
    { date_achat: '2025-10-01', total_ht_centimes: 999999 },
    { date_achat: '2027-01-01', total_ht_centimes: 999999 }];
  const m = margeGraphique(ca.mois, achats, ca.annee);
  // Même CA que les barres HT : montant complet, moins avoir, acompte séparé et brouillons exclus.
  assert.equal(ca.mois[9], 28000n);
  assert.equal(m.ventes[9], ca.mois[9]);
  assert.equal(m.achats[9], 12000n);
  assert.equal(m.marge[9], 16000n);
  assert.equal(tauxMargeGraphique(m.marge[9], m.ventes[9]), '57,1 %');
  // Achats seuls, absence de CA et absence totale de données.
  assert.equal(m.marge[10], -5000n);
  assert.equal(tauxMargeGraphique(m.marge[10], m.ventes[10]), '–');
  assert.deepEqual([m.ventes[0], m.achats[0], m.marge[0]], [0n, 0n, 0n]);
  // Toute l'année des achats, y compris décembre ; pas de coût de main-d'œuvre.
  assert.deepEqual([m.totalVentes, m.totalAchats, m.totalMarge], [28000n, 18000n, 10000n]);
  assert.equal(tauxMargeGraphique(m.totalMarge, m.totalVentes), '35,7 %');
  assert.equal(margeGraphique([10000n], [], '2026').totalMarge, 10000n);
  assert.equal(tauxMargeGraphique(-5000n, 10000n), '-50,0 %');
  assert.equal(tauxMargeGraphique(-5000n, -10000n), '50,0 %');
  // Les barres TTC diffèrent, la marge continue à utiliser exclusivement le CA HT.
  const ttc = activiteAnnuelle(docs, '2026-11-07', 'ttc');
  assert.notEqual(ttc.mois[9], ca.mois[9]);
  assert.equal(margeGraphique(activiteAnnuelle(docs, '2026-11-07', 'ht').mois, achats, '2026').totalMarge, m.totalMarge);
  console.log('Marge du graphique : contrôles réussis');
} finally { await srv.close(); }