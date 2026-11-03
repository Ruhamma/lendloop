const MAX_SIDE = 1600;

/**
 * Re-draw a photo on a canvas before upload. The new file has no EXIF metadata, so the
 * GPS location phones embed in pictures never leaves the device, and large photos are
 * scaled down to at most 1600 px on the longest side.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo"))),
      "image/jpeg",
      0.85,
    ),
  );
}
