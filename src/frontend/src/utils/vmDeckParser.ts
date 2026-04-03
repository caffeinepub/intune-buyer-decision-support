// VM Deck Excel parser
// Parses the VM deck Excel file to extract:
//   1. Style code -> Zone mapping (from column B heading rows + col C style codes)
//   2. Style code -> embedded image (as base64 data URL)
//
// Uses a dual approach:
//   a. SheetJS bookImages (ws['!images']) - works on newer XLSX builds
//   b. Manual ZIP entry scan of xl/media/* as fallback, anchored via drawing XML

import type { VMDeckEntry } from "../types";

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  // Process in chunks to avoid call stack overflow on large images
  const CHUNK = 8192;
  for (let i = 0; i < len; i += CHUNK) {
    binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Inflate a deflated ZIP entry without external library using DecompressionStream */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(data as unknown as ArrayBuffer);
    writer.close();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      if (result.done) {
        done = true;
        break;
      }
      chunks.push(result.value);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  } catch {
    return data; // fallback: return as-is
  }
}

/** Parse a ZIP file (xlsx is a zip) into a map of path -> Uint8Array */
async function parseZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries = new Map<string, Uint8Array>();

  let offset = 0;
  while (offset < bytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // not a local file header

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLength);
    const name = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + fileNameLength + extraLength;
    const compData = bytes.slice(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (compression === 0) {
      data = compData;
    } else if (compression === 8) {
      data = await inflateRaw(compData);
      void uncompressedSize; // may differ from actual if ZIP64
    } else {
      data = compData;
    }

    entries.set(name, data);
    offset = dataStart + compressedSize;
  }

  return entries;
}

/** Parse drawing XML to get image index -> first row mapping */
function parseDrawingXml(xml: string): Map<number, number> {
  // Map: imageIdx (0-based) -> top-left row (0-based xdr:row)
  const imageRowMap = new Map<number, number>();
  // Match two-cell anchors and one-cell anchors
  // <xdr:twoCellAnchor> or <xdr:oneCellAnchor> containing <xdr:from><xdr:row>N</xdr:row>...
  // and <xdr:pic><xdr:blipFill><a:blip r:embed="rId..."/>
  const anchorRegex =
    /<xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)>/g;
  let anchorIdx = 0;
  let matchResult = anchorRegex.exec(xml);
  while (matchResult !== null) {
    const block = matchResult[1];
    // Get first xdr:row inside xdr:from
    const fromMatch = block.match(
      /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/,
    );
    const row = fromMatch ? Number.parseInt(fromMatch[1], 10) : 0;
    imageRowMap.set(anchorIdx, row);
    anchorIdx++;
    matchResult = anchorRegex.exec(xml);
  }
  return imageRowMap;
}

export async function parseVMDeckFile(
  file: File,
): Promise<Record<string, VMDeckEntry>> {
  const buffer = await readFileAsArrayBuffer(file);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error("XLSX library not loaded");

  // Read the workbook to get cell data (zones, style codes)
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: "array",
    cellStyles: true,
    bookImages: true,
  });

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  // Build row -> style code and row -> zone maps
  let currentZone = "Unknown";
  const rowToStyleCode: Record<number, string> = {};
  const rowToZone: Record<number, string> = {};

  data.forEach((row, i) => {
    // Try multiple columns for zone (col B=index 1, col A=0)
    const zoneCell = row[1] ?? row[0];
    const styleCell = row[2] ?? row[1]; // col C=index 2, fallback col B

    if (
      zoneCell &&
      typeof zoneCell === "string" &&
      zoneCell.trim() &&
      !zoneCell.trim().match(/^\d/) /* not a style code */
    ) {
      const candidate = zoneCell.trim().toUpperCase();
      // Only treat as zone if it looks like a zone name (all caps word, not a number)
      if (/^[A-Z][A-Z\s&-]+$/.test(candidate)) {
        currentZone = zoneCell.trim();
      }
    }
    if (styleCell && typeof styleCell === "string" && styleCell.trim()) {
      const code = styleCell.trim();
      // Style codes are typically alphanumeric
      if (/[A-Za-z0-9]/.test(code) && code.length >= 3) {
        const excelRow = i + 1; // 0-indexed array -> 1-indexed excel row
        rowToStyleCode[excelRow] = code;
        rowToZone[excelRow] = currentZone;
      }
    }
  });

  const result: Record<string, VMDeckEntry> = {};

  // ── Approach 1: SheetJS ws['!images'] ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsImages: any[] | undefined = ws["!images"];
  if (wsImages && wsImages.length > 0) {
    for (const img of wsImages) {
      const row0: number | undefined =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img as any)?.anchor?.r ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img as any)?.tl?.r ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img as any)?.from?.r ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img as any)?.l?.row ??
        undefined;
      if (row0 === undefined) continue;
      const sheetRow = row0 + 1;
      const styleCode = rowToStyleCode[sheetRow];
      if (!styleCode) continue;

      const imgData =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img as any).data || (img as any).buf || (img as any).buffer;
      if (!imgData) continue;

      const base64 = arrayBufferToBase64(imgData as ArrayBuffer | Uint8Array);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fmt = ((img as any).type || (img as any).fmt || "").toLowerCase();
      const mime = fmt.includes("png") ? "image/png" : "image/jpeg";
      result[styleCode] = {
        imageUrl: `data:${mime};base64,${base64}`,
        zone: rowToZone[sheetRow] || "Unknown",
      };
    }
  }

  // ── Approach 2: Manual ZIP parsing ────────────────────────────────────────
  if (Object.keys(result).length === 0) {
    try {
      const zipEntries = await parseZip(buffer);

      // Find all media images
      const mediaImages: Array<{
        name: string;
        idx: number;
        data: Uint8Array;
        mime: string;
      }> = [];
      const mediaEntries = Array.from(zipEntries.entries())
        .filter(
          ([name]) =>
            name.startsWith("xl/media/") || name.startsWith("xl\\media\\"),
        )
        .sort(([a], [b]) => a.localeCompare(b));

      for (let i = 0; i < mediaEntries.length; i++) {
        const [name, data] = mediaEntries[i];
        const lname = name.toLowerCase();
        const mime = lname.endsWith(".png")
          ? "image/png"
          : lname.endsWith(".gif")
            ? "image/gif"
            : "image/jpeg";
        mediaImages.push({ name, idx: i, data, mime });
      }

      if (mediaImages.length === 0) {
        // No images in zip, just map zones
        for (const [excelRowStr, styleCode] of Object.entries(rowToStyleCode)) {
          const excelRow = Number(excelRowStr);
          result[styleCode] = {
            imageUrl: "",
            zone: rowToZone[excelRow] || "Unknown",
          };
        }
        return result;
      }

      // Parse drawing XML to map image positions to rows
      let imageRowMap: Map<number, number> | null = null;
      const drawingEntry = Array.from(zipEntries.entries()).find(
        ([name]) => name.includes("drawing") && name.endsWith(".xml"),
      );
      if (drawingEntry) {
        const xmlText = new TextDecoder().decode(drawingEntry[1]);
        imageRowMap = parseDrawingXml(xmlText);
      }

      if (imageRowMap && imageRowMap.size > 0) {
        // Map each image to a style code via row
        for (const [imgIdx, img] of mediaImages.entries()) {
          const row0 = imageRowMap.get(imgIdx);
          if (row0 === undefined) continue;
          const sheetRow = row0 + 1;
          const styleCode = rowToStyleCode[sheetRow];
          if (!styleCode) continue;
          const base64 = arrayBufferToBase64(img.data);
          result[styleCode] = {
            imageUrl: `data:${img.mime};base64,${base64}`,
            zone: rowToZone[sheetRow] || "Unknown",
          };
        }
      } else {
        // Fallback: pair images in order with style codes
        const styleCodes = Object.entries(rowToStyleCode)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([rowStr, code]) => ({ row: Number(rowStr), code }));

        for (
          let i = 0;
          i < Math.min(mediaImages.length, styleCodes.length);
          i++
        ) {
          const { code, row } = styleCodes[i];
          const img = mediaImages[i];
          const base64 = arrayBufferToBase64(img.data);
          result[code] = {
            imageUrl: `data:${img.mime};base64,${base64}`,
            zone: rowToZone[row] || "Unknown",
          };
        }
      }
    } catch (e) {
      console.warn("ZIP-based image extraction failed:", e);
    }
  }

  // If still nothing, at least populate zones
  if (Object.keys(result).length === 0) {
    for (const [excelRowStr, styleCode] of Object.entries(rowToStyleCode)) {
      const excelRow = Number(excelRowStr);
      result[styleCode] = {
        imageUrl: "",
        zone: rowToZone[excelRow] || "Unknown",
      };
    }
  }

  return result;
}
