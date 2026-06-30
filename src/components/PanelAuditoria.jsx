import React, { useMemo, useState } from 'react';
import { Card, Title, Text, Flex, Metric, Divider, Button } from '@tremor/react';
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

const PanelAuditoria = ({ allGastos, audits }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const availableYears = useMemo(() => {
        if (!audits || audits.length === 0) return [new Date().getFullYear()];
        const years = new Set(audits.map(audit => parseInt(audit.startDate.split('-')[0], 10)));
        return Array.from(years).sort((a, b) => a - b);
    }, [audits]);

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
        if (!audits.length || !allGastos.length) return [];

        const filteredAudits = audits.filter(audit => {
            const auditYear = parseInt(audit.startDate.split('-')[0], 10);
            return auditYear === selectedYear;
        });

        const results = filteredAudits.map(audit => {
            const gastosEnPeriodo = allGastos.filter(gasto =>
                gasto.fecha >= audit.startDate && gasto.fecha <= audit.endDate
            );

            const gastosPorCategoria = gastosEnPeriodo.reduce((acc, gasto) => {
                const categoria = gasto.categoria || 'Otros';
                acc[categoria] = (acc[categoria] || 0) + parseFloat(gasto.monto);
                return acc;
            }, {});

            const totalCiudad = Object.values(gastosPorCategoria).reduce((sum, monto) => sum + monto, 0);

            return {
                ...audit,
                gastosPorCategoria,
                totalCiudad,
            };
        });

        // Filter out audits with totalCiudad of 0 and sort chronologically
        return results.filter(result => result.totalCiudad > 0)
                      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }, [allGastos, audits, selectedYear]);

    if (audits.length === 0) {
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

            <Flex justifyContent="center" alignItems="center" className="gap-4">
                <Button onClick={handlePrevYear} disabled={isPrevDisabled} variant="light">&lt;&lt;</Button>
                <Text className="text-xl font-semibold">{selectedYear}</Text>
                <Button onClick={handleNextYear} disabled={isNextDisabled} variant="light">&gt;&gt;</Button>
            </Flex>

            {auditResults.length > 0 ? auditResults.map(result => (
                <Card key={result.id} decoration="top" decorationColor="indigo">
                    <div className="mb-4">
                        <Flex alignItems="start">
                            <div>
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Ciudad</Text>
                                <Metric className="text-slate-800">{result.city}</Metric>
                                <Text className="text-slate-500">{result.startDate} al {result.endDate}</Text>
                            </div>
                            <div className="text-right">
                                <Text className="uppercase text-xs font-bold text-slate-500 tracking-wider">Total en Periodo</Text>
                                <Metric className="text-indigo-600">{formatoMoneda(result.totalCiudad)}</Metric>
                            </div>
                        </Flex>
                    </div>

                    <Divider />

                    <div className="mt-4 space-y-3">
                        {Object.entries(result.gastosPorCategoria)
                            .sort(([, a], [, b]) => b - a)
                            .map(([categoria, monto]) => {
                                const { icon: Icon, color } = getCategoryDetails(categoria);
                                return (
                                    <Flex key={categoria}>
                                        <Flex className="w-auto gap-2" justifyContent="start" alignItems="center">
                                            <Icon className={`text-${color}-500`} size={14} />
                                            <Text className="font-medium text-slate-700">{categoria}</Text>
                                        </Flex>
                                        <Text className="font-mono font-semibold text-slate-700">{formatoMoneda(monto)}</Text>
                                    </Flex>
                                );
                            })}
                    </div>
                </Card>
            )) : (
                <Card className="text-center">
                    <Text>No hay datos de auditoría para el año {selectedYear}.</Text>
                </Card>
            )}
        </div>
    );
};

export default PanelAuditoria;
