// Keep a ten-photo gallery safely below the shared-state request size limit.
export function readResizedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error("JPEG・PNG・WebP形式の画像を選択してください。"));
      return;
    }
    const source = new Image();
    const objectUrl = URL.createObjectURL(file);
    source.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("画像を読み込めませんでした。")); };
    source.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("画像を処理できませんでした。");
        let size = Math.min(1200, Math.max(source.naturalWidth, source.naturalHeight));
        let result = "";
        do {
          const scale = size / Math.max(source.naturalWidth, source.naturalHeight);
          canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL("image/jpeg", 0.8);
          size = Math.floor(size * 0.8);
        } while (result.length > 280_000 && size >= 160);
        if (result.length > 280_000) throw new Error("画像を小さくしてから再度お試しください。");
        resolve(result);
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(objectUrl); }
    };
    source.src = objectUrl;
  });
}
