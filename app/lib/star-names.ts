/**
 * Real star names (IAU proper names) handed to anyone who leaves their name blank, so an unnamed light still gets a
 * name from the actual sky.
 */
export const STAR_NAMES = [
  "Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon", "Achernar", "Betelgeuse", "Hadar",
  "Altair", "Acrux", "Aldebaran", "Antares", "Spica", "Pollux", "Fomalhaut", "Deneb", "Mimosa", "Regulus",
  "Adhara", "Castor", "Shaula", "Gacrux", "Bellatrix", "Elnath", "Miaplacidus", "Alnilam", "Alnair", "Alnitak",
  "Alioth", "Dubhe", "Mirfak", "Wezen", "Sargas", "Kaus Australis", "Avior", "Alkaid", "Menkalinan", "Atria",
  "Alhena", "Peacock", "Alsephina", "Mirzam", "Alphard", "Polaris", "Hamal", "Algieba", "Diphda", "Mizar",
  "Nunki", "Menkent", "Mirach", "Alpheratz", "Rasalhague", "Kochab", "Saiph", "Denebola", "Algol", "Tiaki",
  "Muhlifain", "Aspidiske", "Suhail", "Alphecca", "Mintaka", "Sadr", "Eltanin", "Schedar", "Naos", "Almach",
  "Caph", "Izar", "Dschubba", "Larawag", "Merak", "Ankaa", "Girtab", "Enif", "Scheat", "Sabik",
  "Phecda", "Aludra", "Markeb", "Navi", "Markab", "Aljanah", "Acrab", "Zubenelgenubi", "Unukalhai", "Sheratan",
  "Kraz", "Phact", "Ruchbah", "Alderamin", "Albireo", "Tarazed", "Mira", "Thuban", "Zosma", "Sualocin",
  "Rotanev", "Alcyone", "Electra", "Maia", "Merope", "Taygeta", "Pleione", "Asterope", "Celaeno", "Proxima",
  "Toliman", "Rigil Kentaurus",
];

/** A fresh random star, for a new post with no name. */
export function randomStarName() {
  return STAR_NAMES[Math.floor(Math.random() * STAR_NAMES.length)];
}

/**
 * The name to show for an entry. Lights saved as "anonymous" before star names existed get one picked from their id,
 * so each keeps the same star on every visit.
 */
export function shownName(entry: { id: string; name: string }) {
  if (entry.name !== "anonymous") return entry.name;
  let h = 0;
  for (let i = 0; i < entry.id.length; i++) h = (Math.imul(h, 31) + entry.id.charCodeAt(i)) | 0;
  return STAR_NAMES[Math.abs(h) % STAR_NAMES.length];
}
