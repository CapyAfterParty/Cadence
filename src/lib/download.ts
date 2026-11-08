export function downloadText(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV that Anki imports directly: front, back, tags. */
export function ankiCsv(rows: { front: string; back: string; tags: string[] }[]) {
  const head = '#separator:Comma\n#html:false\n#tags column:3\n';
  return head + rows.map((r) => [r.front, r.back, r.tags.join(' ')].map(csvCell).join(',')).join('\n') + '\n';
}

export const tagify = (s: string) => s.trim().replace(/\s+/g, '_').replace(/[^\w:-]/g, '');
