// Testo del banner «allergeni da confermare» con singolare/plurale corretto.
export function testoBannerAllergeni(n: number): { evidenza: string; resto: string } {
  return n === 1
    ? { evidenza: '1 piatto', resto: 'ha gli allergeni da confermare.' }
    : { evidenza: `${n} piatti`, resto: 'hanno gli allergeni da confermare.' }
}
