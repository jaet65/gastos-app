export const filtrarGastosParaReporte = (
  gastos,
  {
    fechaInicio = '',
    fechaFin = '',
    terminoBusqueda = '',
    mostrarArchivados = false,
    tipoReporte = 'normal',
  } = {}
) => {
  const busqueda = terminoBusqueda.trim().toLocaleLowerCase();

  return gastos.filter((gasto) => {
    if (tipoReporte === 'MAF') {
      if (gasto.categoria !== 'MAF') return false;
    } else if (gasto.categoria === 'MAF' || gasto.categoria === 'ANTP') {
      return false;
    }

    if (fechaInicio && gasto.fecha < fechaInicio) return false;
    if (fechaFin && gasto.fecha > fechaFin) return false;
    if (!mostrarArchivados && gasto.archivado) return false;

    if (busqueda && !String(gasto.concepto || '').toLocaleLowerCase().includes(busqueda)) {
      const padrePropina = gastos.find((item) => item.idPropina === gasto.id);
      const padreCaseta = gastos.find((item) => item.id === gasto.idPadre);
      const coincideConPadre = [padrePropina, padreCaseta].some((padre) =>
        String(padre?.concepto || '').toLocaleLowerCase().includes(busqueda)
      );
      if (!coincideConPadre) return false;
    }

    return true;
  });
};

export const resolverGastosPorIds = (gastos, ids) => {
  const gastosPorId = new Map(gastos.map(gasto => [gasto.id, gasto]));
  const seleccionados = ids.map(id => gastosPorId.get(id));
  if (seleccionados.some(gasto => !gasto)) {
    throw new Error('No se encontraron todos los gastos guardados en este reporte.');
  }
  return seleccionados;
};