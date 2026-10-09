import { Download, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Card, Title, Text, Flex, Metric, Divider, Button } from '@tremor/react';
import { Car, Utensils, Layers, ShieldCheck, Trash } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Swal from 'sweetalert2';

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(cantidad);
};

const getCategoryDetails = (cat) => {
    switch (cat) {
        case 'Transporte': return { icon: Car, color: 'blue' };
        case 'Comida': return { icon: Utensils, color: 'green' };
        case 'MAF': return { icon: ShieldCheck, color: 'orange' };
        default: return { icon: Layers, color: 'slate' };
    }
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const parseLocalDate = (dateValue) => {
    if (dateValue === null || dateValue === undefined) return null;

    const value = String(dateValue).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getNumberOfDays = (startDate, endDate) => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (!start || !end) {
        return 0;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / DAY_IN_MS);
    return diffDays + 1;
};

const adjustDate = (dateString, adjustment) => {
    const date = parseLocalDate(dateString);
    if (!date) {
        return null;
    }

    const adjustedDate = new Date(date.getTime());
    adjustedDate.setDate(adjustedDate.getDate() + adjustment);
    return formatLocalDate(adjustedDate);
};

const PanelAuditoria = ({ allGastos, audits, onImport, isImporting }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [auditType, setAuditType] = useState(1); // 0 for Periodo, 1 for Ciudad
    const [isDeleting, setIsDeleting] = useState(false); // State to handle loading for delete all button

    const availableYears = useMemo(() => {
        const years = new Set([
            ...allGastos.map(gasto => parseInt(String(gasto.fecha || '').split('-')[0], 10)),
            ...audits.map(audit => parseInt(String(audit.startDate || '').split('-')[0], 10)),
        ].filter(Number.isFinite));
        return years.size > 0
            ? Array.from(years).sort((a, b) => a - b)
            : [new Date().getFullYear()];
    }, [allGastos, audits]);

    const handlePrevYear = () => {
        const currentIndex = availableYears.indexOf(selectedYear);
        if (currentIndex > 0) {
            setSelectedYear(availableYears[currentIndex - 1]);
        }
    };

    const handleNextYear = () => {
        const currentIndex = availableYears.indexOf(selectedYear);
        if (currentIndex < availableYears.length - 1) {
            setSelectedYear(availableYears[currentIndex + 1]);
        }
    };

    const auditResults = useMemo(() => {
        if (auditType === 0) { // By Period
            if (!audits.length) return [];
            
            const filteredAudits = audits.filter(audit => {
                const startYear = parseInt(String(audit.startDate || '').split('-')[0], 10);
                return Number.isFinite(startYear) && startYear === selectedYear;
            });

            const results = filteredAudits.map(audit => {
                const adjustedStartDate = adjustDate(audit.startDate, -1);
                const adjustedEndDate = adjustDate(audit.endDate, 1);

                if (!adjustedStartDate || !adjustedEndDate) {
                    return null;
                }

                const gastosEnPeriodo = allGastos.filter(gasto =>
                    gasto.fecha >= adjustedStartDate && gasto.fecha <= adjustedEndDate
                );

                const categoryTotals = {};
                gastosEnPeriodo.forEach(gasto => {
                    const categoria = gasto.categoria || 'Otros';
                    if (!categoryTotals[categoria]) {
                        categoryTotals[categoria] = 0;
                    }
                    categoryTotals[categoria] += parseFloat(gasto.monto);
                });

                const totalCiudad = Object.values(categoryTotals).reduce((sum, monto) => sum + monto, 0);
                const numberOfDays = getNumberOfDays(audit.startDate, audit.endDate);
                const averagePerDayCity = numberOfDays > 0 ? totalCiudad / numberOfDays : 0;

                const gastosPorCategoriaWithAverages = {};
                for (const categoria in categoryTotals) {
                    const total = categoryTotals[categoria];
                    const average = numberOfDays > 0 ? total / numberOfDays : 0;
                    gastosPorCategoriaWithAverages[categoria] = { total: total, averagePerDay: average };
                }

                return {
                    ...audit,
                    gastosPorCategoria: gastosPorCategoriaWithAverages,
                    totalCiudad,
                    totalIngresos: typeof audit.costo === 'number' && Number.isFinite(audit.costo) ? audit.costo : null,
                    averagePerDay: averagePerDayCity,
                };
            });

            return results
                .filter(Boolean)
                .filter(result => result.totalCiudad > 0 || result.totalIngresos > 0)
                .sort((a, b) => {
                    const aDate = parseLocalDate(a.startDate) || new Date(0);
                    const bDate = parseLocalDate(b.startDate) || new Date(0);
                    return aDate - bDate;
                });
        } else { // By City
            if (!audits || !audits.length) return [];
        
            const gastosThisYear = allGastos.filter(gasto => 
                parseInt(gasto.fecha.split('-')[0], 10) === selectedYear
            );

            const cityGroups = gastosThisYear.reduce((acc, gasto) => {
                const auditPeriod = audits.find(audit => {
                    const adjustedStart = adjustDate(audit.startDate, -1);
                    const adjustedEnd = adjustDate(audit.endDate, 1);
                    return adjustedStart && adjustedEnd && gasto.fecha >= adjustedStart && gasto.fecha <= adjustedEnd;
                });

                const city = auditPeriod ? auditPeriod.city : 'Sin asignación';

                if (!acc[city]) acc[city] = { gastos: [], audits: [] };
                acc[city].gastos.push(gasto);
                return acc;
            }, {});

            audits
                .filter(audit => parseInt(String(audit.startDate || '').split('-')[0], 10) === selectedYear)
                .forEach(audit => {
                    const city = audit.city || 'Sin asignación';
                    if (!cityGroups[city]) cityGroups[city] = { gastos: [], audits: [] };
                    cityGroups[city].audits.push(audit);
                });

            return Object.entries(cityGroups).map(([city, { gastos, audits: cityAudits }]) => {
                const totalCiudad = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
                const tieneIngresos = cityAudits.some(audit => typeof audit.costo === 'number' && Number.isFinite(audit.costo));
                const totalIngresos = cityAudits.reduce(
                    (sum, audit) => sum + (typeof audit.costo === 'number' && Number.isFinite(audit.costo) ? audit.costo : 0),
                    0
                );

                const dateRanges = cityAudits
                    .map(audit => ({ startDate: audit.startDate, endDate: audit.endDate }))
                    .filter(range => parseLocalDate(range.startDate) && parseLocalDate(range.endDate))
                    .sort((a, b) => {
                        const aStart = parseLocalDate(a.startDate) || new Date(0);
                        const bStart = parseLocalDate(b.startDate) || new Date(0);
                        return aStart - bStart;
                    });
                
                const totalDaysInCity = dateRanges.reduce((total, range) => total + getNumberOfDays(range.startDate, range.endDate), 0);
                const averagePerDayCity = totalDaysInCity > 0 ? totalCiudad / totalDaysInCity : 0;

                const gastosPorCategoria = gastos.reduce((acc, gasto) => {
                    const categoria = gasto.categoria || 'Otros';
                    if (!acc[categoria]) {
                        acc[categoria] = { total: 0, averagePerDay: 0 };
                    }
                    acc[categoria].total += parseFloat(gasto.monto);
                    return acc;
                }, {});

                for (const categoria in gastosPorCategoria) {
                    gastosPorCategoria[categoria].averagePerDay = totalDaysInCity > 0 ? gastosPorCategoria[categoria].total / totalDaysInCity : 0;
                }

                return {
                    id: city,
                    city: city,
                    totalCiudad: totalCiudad,
                    totalIngresos: tieneIngresos ? totalIngresos : null,
                    gastosPorCategoria: gastosPorCategoria,
                    dateRanges: dateRanges,
                    averagePerDay: averagePerDayCity,
                };
            })
            .filter(result => result.totalCiudad > 0 || result.totalIngresos > 0)
            .sort((a, b) => {
                const cityA = (a.city || '').trim();
                const cityB = (b.city || '').trim();
                const isSinCiudadA = cityA.toLowerCase() === "sin ciudad";
                const isSinCiudadB = cityB.toLowerCase() === "sin ciudad";
            
                if (isSinCiudadA && !isSinCiudadB) {
                    return 1;
                }
                if (isSinCiudadB && !isSinCiudadA) {
                    return -1;
                }
                return cityA.localeCompare(cityB);
            });
        }
    }, [allGastos, audits, selectedYear, auditType]);

    const totalGastosAnual = useMemo(() => {
        if (!allGastos || allGastos.length === 0) return 0;
        return allGastos
            .filter(gasto => parseInt(String(gasto.fecha || '').split('-')[0], 10) === selectedYear)
            .reduce((sum, gasto) => sum + parseFloat(gasto.monto || 0), 0);
    }, [allGastos, selectedYear]);
    const totalIngresosAnual = useMemo(() => audits
        .filter(audit => parseInt(String(audit.startDate || '').split('-')[0], 10) === selectedYear)
        .reduce((sum, audit) => (
            sum + (typeof audit.costo === 'number' && Number.isFinite(audit.costo) ? audit.costo : 0)
        ), 0), [audits, selectedYear]);
    const diferenciaAnual = totalIngresosAnual - totalGastosAnual;

    if (auditType === 0 && audits.length === 0) {
        return (
            <Card className="text-center mt-4 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                <Text>Añade un periodo de ciudad para comenzar la auditoría.</Text>
            </Card>
        );
    }

    const handleGenerateReport = async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);
        const doc = new jsPDF({ orientation: 'landscape' });
        
        // 1. Título principal
        const title = `Auditoría por ${auditType === 0 ? 'Periodo' : 'Ciudad'} - ${selectedYear}`;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(title, 14, 16);

        // 2. Resumen anual, con las mismas métricas de la tarjeta en pantalla
        const summaryY = 23;
        const summaryWidth = (doc.internal.pageSize.getWidth() - 28) / 3;
        const summaryItems = [
            { label: 'INGRESOS ANUALES', value: formatoMoneda(totalIngresosAnual), color: [5, 150, 105] },
            { label: 'EGRESOS ANUALES', value: formatoMoneda(-totalGastosAnual), color: [220, 38, 38] },
            {
                label: 'DIFERENCIA ANUAL',
                value: formatoMoneda(diferenciaAnual),
                color: diferenciaAnual > 0 ? [5, 150, 105] : diferenciaAnual < 0 ? [220, 38, 38] : [100, 116, 139],
            },
        ];
        summaryItems.forEach((item, index) => {
            const x = 14 + index * summaryWidth;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, summaryY, summaryWidth - 4, 18, 2, 2, 'FD');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(item.label, x + 4, summaryY + 6);
            doc.setFontSize(12);
            doc.setTextColor(...item.color);
            doc.text(item.value, x + 4, summaryY + 14);
        });

        // 3. Preparación de datos de la tabla
        const tableColumn = ["Ciudad", "Periodos considerados", "Ingresos (Costo)", "Egresos (Gastos)", "Diferencia", "Promedio/Día", "Gastos por categoría"];
        const tableRows = [];

        auditResults.forEach(result => {
            const period = auditType === 0 
                ? `${result.startDate} al ${result.endDate}` 
                : result.dateRanges.map(r => `${r.startDate} al ${r.endDate}`).join('\n');
                
            const categories = Object.entries(result.gastosPorCategoria)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([cat, data]) => (
                    data.averagePerDay > 0
                        ? `${cat}: ${formatoMoneda(data.total)} (${formatoMoneda(data.averagePerDay)}/día)`
                        : `${cat}: ${formatoMoneda(data.total)}`
                ))
                .join('\n');
            
            const rowData = [
                result.city,
                period,
                result.totalIngresos === null ? '-' : formatoMoneda(result.totalIngresos),
                formatoMoneda(-result.totalCiudad),
                result.totalIngresos === null ? '-' : formatoMoneda(result.totalIngresos - result.totalCiudad),
                formatoMoneda(result.averagePerDay),
                categories,
            ];
            tableRows.push(rowData);
        });

        // 4. Generar la tabla debajo del resumen anual
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 47,
            headStyles: {
                fillColor: [30, 41, 59], // Encabezado elegante slate/oscuro
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left',
            },
            styles: {
                fontSize: 8,
                cellPadding: 2,
                valign: 'middle',
                overflow: 'linebreak',
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251] // Filas intercaladas para mejor lectura
            },
            tableWidth: 'auto',
            margin: { left: 14, right: 14 },
            columnStyles: {
                0: { cellWidth: 32, halign: 'left' },
                1: { cellWidth: 55, halign: 'left' },
                2: { cellWidth: 34, halign: 'left' },
                3: { cellWidth: 36, halign: 'left' },
                4: { cellWidth: 32, halign: 'left' },
                5: { cellWidth: 30, halign: 'left' },
                6: { cellWidth: 50, halign: 'left' },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                if (data.column.index === 2) {
                    data.cell.styles.textColor = auditResults[data.row.index].totalIngresos === null
                        ? [100, 116, 139]
                        : [5, 150, 105];
                } else if (data.column.index === 3) {
                    data.cell.styles.textColor = [220, 38, 38];
                } else if (data.column.index === 4) {
                    const { totalIngresos, totalCiudad } = auditResults[data.row.index];
                    if (totalIngresos === null) {
                        data.cell.styles.textColor = [100, 116, 139];
                    } else {
                        const difference = totalIngresos - totalCiudad;
                        data.cell.styles.textColor = difference > 0
                            ? [5, 150, 105]
                            : difference < 0
                                ? [220, 38, 38]
                                : [100, 116, 139];
                    }
                }
            }
        });

        doc.save('TrackSIM_Audit.pdf');
    };

    const handleDeleteAllAudits = async () => {
        const confirmation = await Swal.fire({
            title: '¿Limpiar auditorías?',
            text: 'Esta acción es irreversible y eliminará todos los periodos de auditoría.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        setIsDeleting(true);
        Swal.fire({
            title: 'Limpiando auditorías',
            html: '<p>Consultando periodos...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading(),
        });

        try {
            const querySnapshot = await getDocs(collection(db, "auditorias"));
            const documents = querySnapshot.docs;
            const total = documents.length;
            let deleted = 0;
            const updateProgress = () => {
                const percentage = total === 0 ? 100 : Math.round((deleted / total) * 100);
                Swal.update({
                    html: `<p>Auditorías eliminadas: ${deleted} de ${total}</p>
                        <progress value="${deleted}" max="${Math.max(total, 1)}" style="width:100%"></progress>
                        <p>${percentage}%</p>`,
                });
            };
            updateProgress();

            await Promise.all(documents.map(async (document) => {
                await deleteDoc(doc(db, "auditorias", document.id));
                deleted += 1;
                updateProgress();
            }));

            await Swal.fire({
                icon: 'success',
                title: 'Limpieza completada',
                text: `Se eliminaron ${deleted} auditorías.`,
                timer: 1800,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Error al eliminar todos los periodos de auditoría:", error);
            await Swal.fire({
                icon: 'error',
                title: 'Error al limpiar auditorías',
                text: error.message,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const currentIndex = availableYears.indexOf(selectedYear);
    const isPrevDisabled = currentIndex <= 0;
    const isNextDisabled = currentIndex >= availableYears.length - 1;

    return (
        <div className="space-y-6 mt-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                variant="light"
                onClick={onImport}
                size="xs"
                icon={Upload}
                loading={isImporting}
                disabled={isImporting}
                className="inline-flex h-9 min-h-9 items-center justify-center bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600 rounded-md px-2 text-xs"
                >
                {isImporting ? 'Importando...' : 'Importar'}
                </Button>
                <Button
                variant="light"
                onClick={handleGenerateReport}
                size="xs"
                icon={Download}
                className="inline-flex h-9 min-h-9 items-center justify-center bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600 rounded-md px-2 text-xs"
                >
                Generar Reporte
                </Button>
                <Button
                variant="light"
                onClick={handleDeleteAllAudits}
                size="xs"
                icon={Trash}
                loading={isDeleting}
                disabled={isDeleting}
                className="inline-flex h-9 min-h-9 items-center justify-center bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600 rounded-md px-2 text-xs"
                >
                Limpiar
                </Button>
            </div>

            <div className="flex justify-center gap-2">
                <Button
                    variant={auditType === 1 ? "primary" : "light"}
                    color={auditType === 1 ? "blue" : "slate"}
                    onClick={() => setAuditType(1)}
                    size="xs"
                    className="rounded-xl px-4 py-2"
                >
                    Ciudad
                </Button>
                <Button
                    variant={auditType === 0 ? "primary" : "light"}
                    color={auditType === 0 ? "blue" : "slate"}
                    onClick={() => setAuditType(0)}
                    size="xs"
                    className="rounded-xl px-4 py-2"
                >
                    Periodo
                </Button>
            </div>

            <Flex justifyContent="center" alignItems="center" className="gap-4">
                <Button onClick={handlePrevYear} disabled={isPrevDisabled} variant="light">&lt;&lt;</Button>
                <Text className="text-xl font-semibold">{selectedYear}</Text>
                <Button onClick={handleNextYear} disabled={isNextDisabled} variant="light">&gt;&gt;</Button>
            </Flex>
            
            <Card className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                <div>
                    <Text>Auditoria anual: {selectedYear}</Text>
                    <div className="mt-3 grid gap-4 sm:grid-cols-3">
                        <div>
                            <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Ingresos anuales</Text>
                            <Metric className="truncate text-emerald-600">{formatoMoneda(totalIngresosAnual)}</Metric>
                        </div>
                        <div>
                            <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Egresos anuales</Text>
                            <Metric className="truncate text-red-600">{formatoMoneda(-totalGastosAnual)}</Metric>
                        </div>
                        <div>
                            <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Diferencia anual</Text>
                            <Metric className={`truncate ${
                                diferenciaAnual > 0
                                    ? 'text-emerald-600'
                                    : diferenciaAnual < 0
                                        ? 'text-red-600'
                                        : 'text-slate-500'
                            }`}>
                                {formatoMoneda(diferenciaAnual)}
                            </Metric>
                        </div>
                    </div>
                </div>
            </Card>


            {auditResults.length > 0 ? auditResults.map(result => (
                <Card key={result.id} decoration="top" decorationColor={auditType === 0 ? 'indigo' : 'blue'} className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                    <div className="mb-4">
                        <Flex alignItems="start">
                            <div className="flex-1">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Ciudad</Text>
                                <Metric className="text-slate-800">{result.city}</Metric>
                                {auditType === 0 ? (
                                    <Text className="text-slate-500">{result.startDate} al {result.endDate}</Text>
                                 ) : (
                                    <>
                                        {result.dateRanges && result.dateRanges.length > 0 && (
                                            <div className="mt-2">
                                                <Text className="text-xs font-semibold text-slate-500">Periodos considerados:</Text>
                                                <ul className="text-xs text-slate-400 list-disc pl-5 mt-1">
                                                    {result.dateRanges.map((range, index) => (
                                                        <li key={index}>{range.startDate} al {range.endDate}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                 )}
                            </div>
                        </Flex>
                    </div>

                    <Divider />

                    <div className="mt-4 space-y-3">
                        {Object.entries(result.gastosPorCategoria)
                            .sort(([, a], [, b]) => b.total - a.total)
                            .map(([categoria, data]) => {
                                const { icon: Icon, color } = getCategoryDetails(categoria);
                                return (
                                    <Flex key={categoria} justifyContent="between" alignItems="center">
                                        <Flex className="w-auto gap-2" justifyContent="start" alignItems="center">
                                            <Icon className={`text-${color}-500`} size={14} />
                                            <Text className="font-medium text-slate-700">{categoria}</Text>
                                        </Flex>
                                        <Flex className="w-auto gap-4" justifyContent="end" alignItems="center">
                                            <Text className="font-mono text-slate-700">{formatoMoneda(data.total)}</Text>
                                            {data.averagePerDay > 0 && (
                                                <Text className="font-mono text-sm text-slate-500">({formatoMoneda(data.averagePerDay)}/día)</Text>
                                            )}
                                        </Flex>
                                    </Flex>
                                );
                            })}
                    </div>
                    <Divider className="mt-4!" />
                    <Flex className="mt-4 justify-center gap-12">
                        {result.totalIngresos !== null && (
                            <div className="text-center">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Ingresos (Costo)</Text>
                                <Metric className="text-emerald-600">{formatoMoneda(result.totalIngresos)}</Metric>
                            </div>
                        )}
                        <div className="text-center">
                            <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Egresos (Gastos)</Text>
                            <Metric className="text-red-600">{formatoMoneda(-result.totalCiudad)}</Metric>
                        </div>
                        {result.totalIngresos !== null && (
                            <div className="text-center">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Diferencia</Text>
                                <Metric className={
                                    result.totalIngresos > result.totalCiudad
                                        ? 'text-emerald-600'
                                        : result.totalIngresos < result.totalCiudad
                                            ? 'text-red-600'
                                            : 'text-slate-500'
                                }>
                                    {formatoMoneda(result.totalIngresos - result.totalCiudad)}
                                </Metric>
                            </div>
                        )}
                        {result.averagePerDay > 0 && (
                            <div className="flex-1 text-right">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Promedio/Día</Text>
                                <Metric className={auditType === 0 ? 'text-indigo-600' : 'text-blue-600'}>{formatoMoneda(result.averagePerDay)}</Metric>
                            </div>
                        )}
                    </Flex>
                </Card>
            )) : (
                <Card className="text-center rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                    <Text>No hay datos de auditoría para la selección actual.</Text>
                </Card>
            )}
        </div>
    );
};

export default PanelAuditoria;
