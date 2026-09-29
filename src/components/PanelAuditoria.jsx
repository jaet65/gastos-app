import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Card, Title, Text, Flex, Metric, Divider, Button } from '@tremor/react';
import { Car, Utensils, Layers, ShieldCheck, Trash } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

const getNumberOfDays = (startDate, endDate) => {
    const start = new Date(startDate + 'T00:00:00'); // Ensure local time parsing
    const end = new Date(endDate + 'T00:00:00'); // Ensure local time parsing
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end day
};

const adjustDate = (dateString, adjustment) => {
    const date = new Date(dateString + 'T00:00:00');
    date.setDate(date.getDate() + adjustment);
    return date.toISOString().split('T')[0];
};

const PanelAuditoria = ({ allGastos, audits }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [auditType, setAuditType] = useState(1); // 0 for Periodo, 1 for Ciudad
    const [isDeleting, setIsDeleting] = useState(false); // State to handle loading for delete all button

    const availableYears = useMemo(() => {
        if (!allGastos || allGastos.length === 0) return [new Date().getFullYear()];
        const years = new Set(allGastos.map(gasto => parseInt(gasto.fecha.split('-')[0], 10)));
        return Array.from(years).sort((a, b) => a - b);
    }, [allGastos]);

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
            if (!audits.length || !allGastos.length) return [];
            
            const filteredAudits = audits.filter(audit => {
                const auditYear = parseInt(audit.startDate.split('-')[0], 10);
                return auditYear === selectedYear;
            });

            const results = filteredAudits.map(audit => {
                const adjustedStartDate = adjustDate(audit.startDate, -1);
                const adjustedEndDate = adjustDate(audit.endDate, 1);
                
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
                    averagePerDay: averagePerDayCity,
                };
            });

            return results.filter(result => result.totalCiudad > 0)
                          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        } else { // By City
            if (!allGastos || !allGastos.length || !audits || !audits.length) return [];
        
            const gastosThisYear = allGastos.filter(gasto => 
                parseInt(gasto.fecha.split('-')[0], 10) === selectedYear
            );

            const cityGroups = gastosThisYear.reduce((acc, gasto) => {
                // Find the audit period for this expense
                const auditPeriod = audits.find(audit => 
                    gasto.fecha >= adjustDate(audit.startDate, -1) && gasto.fecha <= adjustDate(audit.endDate, 1)
                );

                const city = auditPeriod ? auditPeriod.city : 'Sin asignación';
                
                if (!acc[city]) acc[city] = [];
                acc[city].push(gasto);
                return acc;
            }, {});

            return Object.entries(cityGroups).map(([city, gastos]) => {
                const totalCiudad = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
                
                const contributingAudits = new Set();
                gastos.forEach(gasto => {
                    const auditPeriod = audits.find(audit => 
                        gasto.fecha >= adjustDate(audit.startDate, -1) && gasto.fecha <= adjustDate(audit.endDate, 1)
                    );
                    if (auditPeriod) {
                        contributingAudits.add(JSON.stringify({startDate: auditPeriod.startDate, endDate: auditPeriod.endDate}));
                    }
                });
        
                const dateRanges = Array.from(contributingAudits).map(s => JSON.parse(s)).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
                
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
                    gastosPorCategoria: gastosPorCategoria,
                    dateRanges: dateRanges,
                    averagePerDay: averagePerDayCity,
                };
            }).sort((a, b) => {
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
            .filter(gasto => parseInt(gasto.fecha.split('-')[0], 10) === selectedYear)
            .reduce((sum, gasto) => sum + parseFloat(gasto.monto || 0), 0);
    }, [allGastos, selectedYear]);

    if (auditType === 0 && audits.length === 0) {
        return (
            <Card className="text-center mt-4 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                <Text>Añade un periodo de ciudad para comenzar la auditoría.</Text>
            </Card>
        );
    }

    const handleGenerateReport = () => {
        const doc = new jsPDF();
        
        // 1. Título principal
        const title = `Auditoría por ${auditType === 0 ? 'Periodo' : 'Ciudad'} - ${selectedYear}`;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(title, 14, 16);

        // 2. Tarjeta de Resumen General (Antes de la tabla)
        const cardY = 22;
        doc.setFillColor(248, 250, 252); // Fondo gris muy claro
        doc.setDrawColor(226, 232, 240); // Borde sutil
        doc.roundedRect(14, cardY, 182, 14, 2, 2, 'FD');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('GASTO TOTAL ANUAL ACUMULADO:', 18, cardY + 9);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // Rojo destacado (o azul [37, 99, 235])
        doc.text(formatoMoneda(totalGastosAnual), 190, cardY + 9, { align: 'right' });

        // 3. Preparación de datos de la tabla
        const tableColumn = ["Ciudad", "Periodo", "Total", "Promedio/Día", "Categorías"];
        const tableRows = [];

        auditResults.forEach(result => {
            const period = auditType === 0 
                ? `${result.startDate} al ${result.endDate}` 
                : result.dateRanges.map(r => `${r.startDate} al ${r.endDate}`).join('\n');
                
            const categories = Object.entries(result.gastosPorCategoria)
                .map(([cat, data]) => `${cat}: ${formatoMoneda(data.total)}`)
                .join('\n');
            
            const rowData = [
                result.city,
                period,
                formatoMoneda(result.totalCiudad),
                formatoMoneda(result.averagePerDay),
                categories,
            ];
            tableRows.push(rowData);
        });

        // 4. Generar la tabla arrancando después de la tarjeta (startY: 42)
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 42,
            headStyles: {
                fillColor: [30, 41, 59], // Encabezado elegante slate/oscuro
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251] // Filas intercaladas para mejor lectura
            }
        });

        doc.save('TrackSIM_Audit.pdf');
    };

    const handleDeleteAllAudits = async () => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar TODOS los periodos de auditoría? Esta acción es irreversible y eliminará todos los datos de auditoría de la base de datos.")) {
            return;
        }

        setIsDeleting(true); // Start loading

        try {
            const querySnapshot = await getDocs(collection(db, "auditorias"));
            const deletePromises = [];
            querySnapshot.forEach((document) => {
                deletePromises.push(deleteDoc(doc(db, "auditorias", document.id)));
            });
            await Promise.all(deletePromises);
            alert("Todos los periodos de auditoría han sido eliminados correctamente.");
            // Optionally, you might want to refresh the audits data here if it's not handled by a real-time listener
        } catch (error) {
            console.error("Error al eliminar todos los periodos de auditoría:", error);
            alert("Ocurrió un error al intentar eliminar los periodos de auditoría.");
        } finally {
            setIsDeleting(false); // End loading
        }
    };

    const currentIndex = availableYears.indexOf(selectedYear);
    const isPrevDisabled = currentIndex <= 0;
    const isNextDisabled = currentIndex >= availableYears.length - 1;

    return (
        <div className="space-y-6 mt-6">
            <div className="grid grid-cols-3 items-center w-full">
            {/* Columna izquierda vacía para balancear el espacio */}
            <div></div>

            {/* Columna central: Botones centrados */}
            <div className="flex justify-center gap-2 mt-20">
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

            {/* Columna derecha: Botón alinear a la derecha */}
            <div className="flex justify-end gap-2">
                <Button
                variant="light"
                onClick={handleGenerateReport}
                size="xs"
                icon={Download}
                className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600 rounded-md px-2 py-1 text-xs"
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
                className="bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600 rounded-md px-2 py-1 text-xs"
                >
                Limpiar
                </Button>
            </div>
            </div>

            <Flex justifyContent="center" alignItems="center" className="gap-4">
                <Button onClick={handlePrevYear} disabled={isPrevDisabled} variant="light">&lt;&lt;</Button>
                <Text className="text-xl font-semibold">{selectedYear}</Text>
                <Button onClick={handleNextYear} disabled={isNextDisabled} variant="light">&gt;&gt;</Button>
            </Flex>
            
            <Card className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                <Flex alignItems="start">
                    <div className="truncate">
                        <Text>Gastos anuales: {selectedYear}</Text>
                        <Metric className="truncate">{formatoMoneda(totalGastosAnual)}</Metric>
                    </div>
                </Flex>
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
                        <div className="text-center">
                            <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Total por {auditType === 0 ? 'Periodo' : 'Año'}</Text>
                            <Metric className={auditType === 0 ? 'text-indigo-600' : 'text-blue-600'}>{formatoMoneda(result.totalCiudad)}</Metric>
                        </div>
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
