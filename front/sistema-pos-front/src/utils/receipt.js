export function buildReceiptHtml(venta, options = {}) {
  const widthMm = Number(options.widthMm || 58);
  const charsPerLine = widthMm >= 80 ? 42 : 32; 

  const ESC = '\x1B';
  const CMD = {
    INIT: ESC + '@',
    CENTER: ESC + 'a' + '\x01',
    LEFT: ESC + 'a' + '\x00',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
  };

  const storeName = (options.storeName || 'SISTEMA POS').toUpperCase();
  const title = (options.title || 'TICKET DE VENTA').toUpperCase();
  const numero = venta?.numeroVenta ?? '';
  const fecha = venta?.fecha || venta?.createdAt || new Date().toISOString();
  const dateStr = new Date(fecha).toLocaleString();

  const productos = Array.isArray(venta?.productos) ? venta.productos : [];

  const subtotal = Number(venta?.subtotal || 0);
  const descuento = Number(venta?.descuento || 0);
  const total = Number(venta?.total || 0);

  const metodoPago = (venta?.metodoPago || 'efectivo').toUpperCase();
  const montoRecibido = Number(venta?.montoRecibido || 0);
  const vuelto = Number(venta?.vuelto || 0);
  const clienteNombre = (venta?.cliente?.nombre || 'CONSUMIDOR FINAL').toUpperCase();

  const center = (text) => {
    const spaces = Math.max(0, Math.floor((charsPerLine - text.length) / 2));
    return ' '.repeat(spaces) + text;
  };

  const justify = (left, right) => {
    const spaces = Math.max(1, charsPerLine - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  const line = () => '-'.repeat(charsPerLine);

  const formatMoney = (val) => Number(val || 0).toFixed(2);

  // 🔥 INICIALIZAR IMPRESORA
  let text = CMD.INIT;

  // ENCABEZADO
  text += CMD.CENTER;
  text += CMD.BOLD_ON;
  text += storeName + '\n';
  text += CMD.BOLD_OFF;
  text += title + '\n';
  text += dateStr + '\n';

  text += CMD.LEFT;
  text += line() + '\n';

  text += `TICKET:   ${numero}\n`;
  text += `CLIENTE:  ${clienteNombre.slice(0, charsPerLine - 10)}\n`;
  text += `PAGO:     ${metodoPago}\n`;

  text += line() + '\n';

  // PRODUCTOS
  productos.forEach(p => {
    const nombre = (p?.nombre || '').toUpperCase();
    const qty = Number(p?.cantidad || 0);
    const unit = Number(p?.precioUnitario || 0);
    const sub = Number(p?.subtotal || qty * unit);

    text += nombre.slice(0, charsPerLine) + '\n';
    text += justify(`${qty} x ${formatMoney(unit)}`, formatMoney(sub)) + '\n';
  });

  text += line() + '\n';

  // TOTALES
  text += justify('DESCUENTO:', formatMoney(descuento)) + '\n';
  text += justify('TOTAL:', formatMoney(total)) + '\n';

  text += line() + '\n';

  text += justify('RECIBIDO:', formatMoney(montoRecibido)) + '\n';
  text += justify('VUELTO:', formatMoney(vuelto)) + '\n';

  text += '\n';

  // PIE
  text += CMD.CENTER;
  text += 'GRACIAS POR SU COMPRA\n';

  text += '\n\n\n';

  // 🔥 LIMPIAR COMANDOS ESC/POS PARA HTML/PDF
  const cleanText = text.replace(/\x1B[@aE][\x00\x01]?/g, '');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    body { 
      width: ${widthMm}mm; 
      margin: 0; 
      padding: 0; 
      background: #fff;
    }
    pre { 
      margin: 0; 
      padding: 0 3mm; 
      font-family: 'Courier New', monospace; 
      font-size: 11px; 
      line-height: 1.1;
      white-space: pre-wrap; 
    }
  </style>
</head>
<body>
  <pre>${cleanText}</pre>
</body>
</html>`;
}
