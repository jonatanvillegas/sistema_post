import api from './axios';

export const getReporteUtilidades = (params) => api.get('/reportes/utilidades', { params });
export const getReporteProductos = (params) => api.get('/reportes/productos', { params });
export const getReporteComprasVsVentas = (params) => api.get('/reportes/compras-ventas', { params });
export const getReporteInventarioValorizado = (params) => api.get('/reportes/inventario-valorizado', { params });
export const getReporteMovimientosStock = (params) => api.get('/reportes/movimientos-stock', { params });
export const getReporteClientesFrecuentes = (params) => api.get('/reportes/clientes-frecuentes', { params });
export const getReporteDevoluciones = (params) => api.get('/reportes/devoluciones', { params });
