const UNKNOWN = 'desconhecida'

/** VER-01..VER-04: master and player must run exactly the same version; an absent side is "desconhecida". */
export function versionError(master: string | undefined, player: string | undefined): string | null {
  if (master !== undefined && master === player) return null
  return `Versão diferente da do mestre: mestre ${master ?? UNKNOWN}, você ${player ?? UNKNOWN}. Atualize o app.`
}
