export function arriviCucina(visti: Set<string> | null, attuali: string[]) {
  return { visti: new Set([...(visti ?? []),...attuali]),nuovi: visti === null ? [] : attuali.filter(id => !visti.has(id)) }
}
