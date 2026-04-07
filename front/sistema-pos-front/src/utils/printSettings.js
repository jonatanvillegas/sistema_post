const STORAGE_KEY = 'pos.printSettings';

export const DEFAULT_PRINT_SETTINGS = {
  paperWidthMm: 58,
  silent: false,
  deviceName: '',
  copies: 1,
};

export function getPrintSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      paperWidthMm: Number(parsed.paperWidthMm || DEFAULT_PRINT_SETTINGS.paperWidthMm),
      silent: Boolean(parsed.silent),
      deviceName: typeof parsed.deviceName === 'string' ? parsed.deviceName : '',
      copies: Number(parsed.copies || DEFAULT_PRINT_SETTINGS.copies),
    };
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function setPrintSettings(next) {
  const merged = { ...getPrintSettings(), ...(next || {}) };
  // normalizar
  if (![58, 80].includes(Number(merged.paperWidthMm))) merged.paperWidthMm = 58;
  if (!Number.isFinite(Number(merged.copies)) || Number(merged.copies) < 1) merged.copies = 1;
  merged.deviceName = (merged.deviceName || '').toString();
  merged.silent = Boolean(merged.silent);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
