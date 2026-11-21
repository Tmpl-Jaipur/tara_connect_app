/**
 * Universal file downloader that works seamlessly across:
 * 1. Standard Web Browsers (Chrome, Safari, Firefox, Edge, etc.)
 * 2. Mobile Capacitor Android WebView (via window.AndroidDownloader bridge)
 */

export const saveBlobOrBuffer = async (data, fileName, mimeType = 'application/octet-stream') => {
  if (typeof window !== 'undefined' && window.AndroidDownloader && typeof window.AndroidDownloader.downloadBase64 === 'function') {
    try {
      let base64 = '';
      if (typeof data === 'string' && data.startsWith('data:')) {
        base64 = data;
      } else if (data instanceof Blob) {
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(data);
        });
      } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const blob = new Blob([data], { type: mimeType });
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      window.AndroidDownloader.downloadBase64(base64, fileName, mimeType);
      return;
    } catch (err) {
      console.warn('AndroidDownloader failed, falling back to standard download:', err);
    }
  }

  // Standard web browser fallback
  let blob = data;
  if (!(data instanceof Blob)) {
    blob = new Blob([data], { type: mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {}
  }, 1200);
};

export const savePdfDoc = async (doc, fileName) => {
  if (typeof window !== 'undefined' && window.AndroidDownloader && typeof window.AndroidDownloader.downloadBase64 === 'function') {
    try {
      const dataUri = doc.output('datauristring');
      window.AndroidDownloader.downloadBase64(dataUri, fileName, 'application/pdf');
      return;
    } catch (err) {
      console.warn('AndroidDownloader PDF failed, falling back to doc.save:', err);
    }
  }
  doc.save(fileName);
};
