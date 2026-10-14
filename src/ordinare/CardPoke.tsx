import type { PokeConfig } from '@/menu/importa'
import { formatEuro } from '@/domain/soldi'
/** Ingresso alla poke da comporre, in cima alla categoria delle poke. */
export function CardPoke({ config,apri }: { config: PokeConfig; apri: () => void }) {
  return <button type="button" className="b-poke-card" aria-label="Componi la tua poke" onClick={apri}>
    <span className="b-poke-card__icona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-2.5 2.5-2.5M13 7c.5-1.5 2-2 3.5-1.5" /></svg></span>
    <span className="b-poke-card__testi"><span className="b-poke-card__titolo">Componi la tua poke</span>
      <span className="b-secondario">{config.gruppi.length} passi · da <span className="b-num">{formatEuro(config.prezzoBaseCent ?? 0)}</span></span></span>
    <span aria-hidden="true" className="b-poke-card__freccia">→</span>
  </button>
}
