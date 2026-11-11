// Ontario course codes look like SPH4U, MHF4U, ENG4C or MCV4U1.
// Names can start with one ("SPH4U Physics"); split it out so the code
// can sit quietly beside the title.
const CODE = /^\s*([A-Z]{3}[1-4][A-Z](?:[0-9A-Z])?)\b[\s:·–-]*(.*)$/;

export function splitCourse(name: string): { code: string | null; title: string } {
  const m = name.match(CODE);
  if (!m) return { code: null, title: name };
  return { code: m[1], title: m[2].trim() || m[1] };
}

export const courseTitle = (name: string) => splitCourse(name).title;
