const DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/** Decodes the signature-pad's `canvas.toDataURL('image/png')` output into a PNG buffer ready for Bitrix Disk upload. */
export function decodeSignatureDataUrl(dataUrl: string): Buffer {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Signature must be a PNG data URL (data:image/png;base64,...)");
  }
  return Buffer.from(match[1], "base64");
}

/** A blank/never-touched canvas still produces a valid (tiny, ~fully transparent) PNG — reject those so we don't store an empty signature. */
export function isLikelyBlankSignature(buffer: Buffer): boolean {
  return buffer.length < 1000;
}
