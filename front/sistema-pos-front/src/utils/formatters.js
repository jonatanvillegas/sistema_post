// C$ Córdoba Nicaragüense (NIO)
export const formatCurrency = (amount = 0) => {
  return `C$ ${Number(amount).toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatNumber = (n = 0) =>
  Number(n).toLocaleString('es-NI');
