const escapeHtml = (value) => {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMoney = (value) => {
  const n = Number(value || 0);
  return n.toFixed(2);
};

const formatDate = (value) => {
  try {
    const d = value ? new Date(value) : new Date();
    return d.toLocaleString();
  } catch {
    return String(value || '');
  }
};

export function buildReceiptHtml(venta, options = {}) {
  const widthMm = Number(options.widthMm || 58);
  const title = options.title || 'RECIBO DE VENTA';
  const storeName = options.storeName || 'Sistema POS';

  const numero = venta?.numeroVenta ?? '';
  const fecha = venta?.fecha || venta?.createdAt || new Date().toISOString();

  const productos = Array.isArray(venta?.productos) ? venta.productos : [];

  const subtotal = Number(venta?.subtotal || 0);
  const descuento = Number(venta?.descuento || 0);
  const total = Number(venta?.total || 0);

  const metodoPago = venta?.metodoPago || 'efectivo';
  const montoRecibido = Number(venta?.montoRecibido || 0);
  const vuelto = Number(venta?.vuelto || 0);

  const clienteNombre = venta?.cliente?.nombre || 'Consumidor Final';

  const itemsHtml = productos
    .map((p) => {
      const nombre = escapeHtml(p?.nombre || '');
      const qty = Number(p?.cantidad || 0);
      const unit = Number(p?.precioUnitario || 0);
      const sub = Number(p?.subtotal || qty * unit);
      return `
        <div class="row item">
          <div class="name">${nombre}</div>
          <div class="meta">
            <span>${qty} x ${formatMoney(unit)}</span>
            <span>${formatMoney(sub)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Recibo ${escapeHtml(numero)}</title>
  <style>
    @page { size: ${widthMm}mm auto; margin: 2mm; }
    html, body { width: ${widthMm}mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; padding: 0; color: #000; }
    .center { text-align: center; }
    .muted { opacity: .75; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; flex-direction: column; gap: 2px; }
    .meta { display: flex; justify-content: space-between; }
    .totals { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; }
    .totals .label { opacity: .85; }
    .totals .val { text-align: right; }
    .big { font-size: 14px; font-weight: 700; }
    .foot { margin-top: 10px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">${escapeHtml(storeName)}</div>
    <div>${escapeHtml(title)}</div>
    <div class="muted">${escapeHtml(formatDate(fecha))}</div>
  </div>

  <div class="sep"></div>

  <div class="row">
    <div><b>Venta:</b> ${escapeHtml(numero)}</div>
    <div><b>Cliente:</b> ${escapeHtml(clienteNombre)}</div>
    <div><b>Pago:</b> ${escapeHtml(metodoPago.toUpperCase())}</div>
  </div>

  <div class="sep"></div>

  ${itemsHtml || '<div class="muted">(Sin productos)</div>'}

  <div class="sep"></div>

  <div class="totals">
    <div class="label">Subtotal</div><div class="val">${formatMoney(subtotal)}</div>
    <div class="label">Descuento</div><div class="val">${formatMoney(descuento)}</div>
    <div class="label big">TOTAL</div><div class="val big">${formatMoney(total)}</div>
  </div>

  <div class="sep"></div>

  <div class="totals">
    <div class="label">Recibido</div><div class="val">${formatMoney(montoRecibido)}</div>
    <div class="label">Vuelto</div><div class="val">${formatMoney(vuelto)}</div>
  </div>

  <div class="foot center muted">
    Gracias por su compra
  </div>
</body>
</html>`;
}
