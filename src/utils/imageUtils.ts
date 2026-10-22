/**
 * Client-side image resizer and compressor
 * Resizes the image to a max of 1024px on the longest side
 * and compresses to JPEG ~0.8
 */

export interface ProcessedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  originalSizeKB: number;
  compressedSizeKB: number;
}

export function processReceiptImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read the selected image file.'));
    };

    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();

      img.onerror = () => {
        reject(new Error('The file is not a valid or readable image.'));
      };

      img.onload = () => {
        try {
          const maxDimension = 1024;
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not initialize canvas context.'));
            return;
          }

          // Fill white background in case of transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw the image scaled
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with ~0.8 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const cleanBase64 = compressedDataUrl.replace(/^data:image\/jpeg;base64,/, '');

          const originalSizeKB = Math.round(file.size / 1024);
          const compressedSizeKB = Math.round((cleanBase64.length * 3) / 4 / 1024);

          resolve({
            dataUrl: compressedDataUrl,
            base64: cleanBase64,
            mimeType: 'image/jpeg',
            width,
            height,
            originalSizeKB,
            compressedSizeKB,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}
