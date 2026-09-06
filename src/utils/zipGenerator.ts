import JSZip from 'jszip';
import { EXTENSION_FILES } from '../extensionFiles';

export async function generateExtensionZip(): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder('spotify-controls');

  // Add text files
  for (const file of EXTENSION_FILES) {
    if (root) {
      root.file(file.path, file.content);
    }
  }

  // Also include README.md
  try {
    const readmeRes = await fetch('/spotify-controls/README.md');
    if (readmeRes.ok) {
      const readmeText = await readmeRes.text();
      if (root) root.file('README.md', readmeText);
    }
  } catch (e) {
    // Fallback if fetch fails
  }

  // Fetch actual generated icons from public or static path, or generate basic png buffers
  const iconSizes = [48, 96, 128];
  for (const size of iconSizes) {
    try {
      const iconRes = await fetch(`/spotify-controls/icons/icon-${size}.png`);
      if (iconRes.ok) {
        const blob = await iconRes.blob();
        if (root) root.file(`icons/icon-${size}.png`, blob);
      }
    } catch (e) {
      // Ignored
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
