
/** items: [{ name, blob }] -> single .zip Blob (stored, no re-compression). */
export async function zipFiles(items) {
  // fetched on first use (~29 KB gz) — tools load without it
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Map();
  items.forEach(({ name, blob }) => {
    let final = name;
    if (used.has(name)) {
      const n = used.get(name) + 1;
      used.set(name, n);
      const dot = name.lastIndexOf('.');
      final = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
    } else {
      used.set(name, 0);
    }
    zip.file(final, blob);
  });
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
