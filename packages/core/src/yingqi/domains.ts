/**
 * 按域聚合。
 *
 * `tension` 高的域，是这一年真正值得看的地方 ——
 * 支持与反对同时强烈，意味着该领域有实质变动。
 * 只看 net（净值）会把「大起大落」误读成「平淡无事」。
 */

import { DOMAIN_LABEL, type Domain, type DomainOutlook, type YingqiEvent } from "./types.js";

const ALL_DOMAINS = Object.keys(DOMAIN_LABEL) as Domain[];

export function aggregateDomains(events: readonly YingqiEvent[]): DomainOutlook[] {
  return ALL_DOMAINS.map((domain) => {
    const mine = events.filter((e) => e.domains.includes(domain));
    const supporting = mine.filter((e) => e.polarity === 1);
    const opposing = mine.filter((e) => e.polarity === -1);
    const neutral = mine.filter((e) => e.polarity === 0);

    const sup = supporting.reduce((a, e) => a + e.weight, 0);
    const opp = opposing.reduce((a, e) => a + e.weight, 0);
    const tension = Math.max(sup, opp) > 0 ? Math.min(sup, opp) / Math.max(sup, opp) : 0;
    const net = sup - opp;

    return { domain, label: DOMAIN_LABEL[domain], supporting, opposing, neutral, tension, net };
  }).filter((d) => d.supporting.length + d.opposing.length + d.neutral.length > 0);
}
