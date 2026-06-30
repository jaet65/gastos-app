import React, { useMemo, useState } from 'react';
import { Card, Title, Text, Flex, Metric, Divider, Button, TabGroup, TabList, Tab } from '@tremor/react';
import { Car, Utensils, Layers, ShieldCheck } from 'lucide-react';

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
    const [auditType, setAuditType] = useState(0); // 0 for Periodo, 1 for Ciudad

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

                const city = auditPeriod ? auditPeriod.city : 'Sin Ciudad';
                
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

                const gastosPorCategoria = gastos.reduce((acc, gasto) => {
                    const categoria = gasto.categoria || 'Otros';
                    if (!acc[categoria]) {
                        acc[categoria] = { total: 0, averagePerDay: null }; // Keep structure, but null avg
                    }
                    acc[categoria].total += parseFloat(gasto.monto);
                    return acc;
                }, {});

                return {
                    id: city,
                    city: city,
                    totalCiudad: totalCiudad,
                    gastosPorCategoria: gastosPorCategoria,
                    dateRanges: dateRanges,
                };
            }).sort((a, b) => b.totalCiudad - a.totalCiudad);
        }
    }, [allGastos, audits, selectedYear, auditType]);

    if (auditType === 0 && audits.length === 0) {
        return (
            <Card className="text-center mt-4">
                <Text>Añade un periodo de ciudad para comenzar la auditoría.</Text>
            </Card>
        );
    }

    const currentIndex = availableYears.indexOf(selectedYear);
    const isPrevDisabled = currentIndex <= 0;
    const isNextDisabled = currentIndex >= availableYears.length - 1;

    return (
        <div className="space-y-6 mt-6">
            <Title>Resultados de la Auditoría</Title>

            <TabGroup index={auditType} onIndexChange={setAuditType}>
                <TabList variant="solid">
                    <Tab>Por Periodo</Tab>
                    <Tab>Por Ciudad</Tab>
                </TabList>
            </TabGroup>

            <Flex justifyContent="center" alignItems="center" className="gap-4">
                <Button onClick={handlePrevYear} disabled={isPrevDisabled} variant="light">&lt;&lt;</Button>
                <Text className="text-xl font-semibold">{selectedYear}</Text>
                <Button onClick={handleNextYear} disabled={isNextDisabled} variant="light">&gt;&gt;</Button>
            </Flex>

            {auditResults.length > 0 ? auditResults.map(result => (
                <Card key={result.id} decoration="top" decorationColor={auditType === 0 ? 'indigo' : 'blue'}>
                    <div className="mb-4">
                        <Flex alignItems="start">
                            <div className="flex-1">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Ciudad</Text>
                                <Metric className="text-slate-800">{result.city}</Metric>
                                {auditType === 0 ? (
                                    <Text className="text-slate-500">{result.startDate} al {result.endDate}</Text>
                                 ) : (
                                    <>
                                        <Text>Total para {selectedYear}</Text>
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
                            <div className="flex-1 text-center">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Total en {auditType === 0 ? 'Periodo' : 'Año'}</Text>
                                <Metric className={auditType === 0 ? 'text-indigo-600' : 'text-blue-600'}>{formatoMoneda(result.totalCiudad)}</Metric>
                            </div>
                            {auditType === 0 && (
                                <div className="flex-1 text-right">
                                    <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Promedio/Día</Text>
                                    <Metric className="text-indigo-600">{formatoMoneda(result.averagePerDay)}</Metric>
                                </div>
                            )}
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
                                            {data.averagePerDay !== null && (
                                                <Text className="font-mono text-sm text-slate-500">({formatoMoneda(data.averagePerDay)}/día)</Text>
                                            )}
                                        </Flex>
                                    </Flex>
                                );
                            })}
                    </div>
                </Card>
            )) : (
                <Card className="text-center">
                    <Text>No hay datos de auditoría para la selección actual.</Text>
                </Card>
            )}
        </div>
    );
};

export default PanelAuditoria;
