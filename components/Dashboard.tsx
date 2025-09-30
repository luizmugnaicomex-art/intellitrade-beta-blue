import React, { useState, useMemo, memo } from 'react';
import type { ImportProcess, ExchangeRates, CurrencyRateDetail, CostItem, Currency, Claim, Task, User } from '../types';
import { ImportStatus, ContainerStatus, PaymentStatus } from '../types';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { AlertTriangle, Clock, Truck, Anchor, CheckCircle, Ship, CircleDollarSign, Euro, JapaneseYen, Loader, Save, Edit, X as XIcon, Calendar, TrendingUp, BarChart3, FileWarning as FileWarningIcon, Warehouse, DollarSign as DollarSignIcon, TrendingDown, Minus } from 'lucide-react';
import { differenceInDays, format, isThisMonth, isThisYear, endOfMonth, addMonths, endOfYear, isPast, addDays } from 'date-fns';


interface DashboardProps {
    imports: ImportProcess[];
    claims: Claim[];
    theme: 'light' | 'dark';
    companyLogo: string | null;
    exchangeRates: ExchangeRates | null;
    setExchangeRates: (rates: ExchangeRates | null) => void;
    ratesLoading: boolean;
    ratesError: string | null;
    tasks: Task[];
    currentUser: User;
}

const KPICard: React.FC<{ title: string; value: string | React.ReactNode; icon: React.ReactNode; description: string; trend: 'up' | 'down' | 'stable'; trendText: string; }> = memo(({ title, value, icon, description, trend, trendText }) => {
    const trendInfo = {
        up: { icon: <TrendingUp size={16} />, color: 'text-emerald-500' },
        down: { icon: <TrendingDown size={16} />, color: 'text-red-500' },
        stable: { icon: <Minus size={16} />, color: 'text-gray-500 dark:text-gray-400' },
    };

    return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-brand-primary/80 dark:to-brand-primary p-4 rounded-xl shadow-lg">
        <div className="flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-sm text-brand-gray-500 dark:text-gray-400">{title}</p>
                 {typeof value === 'string' ? <p className="text-2xl font-bold text-brand-gray-500 dark:text-white">{value}</p> : <div className="text-2xl font-bold text-brand-gray-500 dark:text-white">{value}</div>}
            </div>
            <div className="p-3 bg-brand-highlight rounded-full text-brand-primary">
                {icon}
            </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
             <div className={`flex items-center gap-1 text-xs font-semibold ${trendInfo[trend].color}`}>
                {trendInfo[trend].icon}
                <span>{trendText}</span>
            </div>
            <p className="text-xs text-brand-gray-400 dark:text-gray-500 truncate">{description}</p>
        </div>
    </div>
)});

const MyTasksWidget: React.FC<{ tasks: Task[], currentUser: User }> = memo(({ tasks, currentUser }) => {
    const myTasks = useMemo(() => {
        return tasks
            .filter(t => t.assignedToId === currentUser.id && t.status !== 'Completed')
            .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
            .slice(0, 5); // Show top 5
    }, [tasks, currentUser.id]);

    if (myTasks.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-card">
            <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white mb-4">My Open Tasks</h3>
            <div className="space-y-3">
                {myTasks.map(task => {
                    const isOverdue = task.dueDate && new Date(task.dueDate+'T00:00:00Z') < new Date();
                    return (
                         <Link to="/workflow" key={task.id} className="block p-3 rounded-lg bg-slate-50 dark:bg-brand-primary/50 hover:bg-slate-100 dark:hover:bg-brand-primary">
                            <p className="font-medium text-sm text-brand-gray-500 dark:text-gray-200">{task.description}</p>
                            <div className="flex items-center justify-between mt-1">
                                <span className={`text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                    Due: {task.dueDate ? new Date(task.dueDate+'T00:00:00Z').toLocaleDateString() : 'N/A'}
                                </span>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-brand-highlight/50 text-brand-primary font-semibold">{task.priority}</span>
                            </div>
                        </Link>
                    );
                })}
                 {myTasks.length > 0 && <Link to="/workflow" className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline pt-2 block text-center">View All Tasks</Link>}
            </div>
        </div>
    );
});


const Dashboard: React.FC<DashboardProps> = ({ imports, claims, theme, companyLogo, exchangeRates, setExchangeRates, ratesLoading, ratesError, tasks, currentUser }) => {
    const [isEditingRates, setIsEditingRates] = useState(false);
    const [manualRates, setManualRates] = useState<ExchangeRates | null>(exchangeRates);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

    React.useEffect(() => {
        setManualRates(exchangeRates);
    }, [exchangeRates]);
    
    const convertToBRL = (value: number, currency: Currency): number => {
        if (!exchangeRates) return 0;
        switch(currency) {
            case 'USD': return value * exchangeRates.usd.venda;
            case 'EUR': return value * exchangeRates.eur.venda;
            case 'CNY': return value * exchangeRates.cny;
            default: return value;
        }
    };


    const {
        importsAtRisk, avgTransitLeadTime, paymentsDueSoon, avgClearanceTime
    } = useMemo(() => {
        const today = new Date();
        const nextWeek = addDays(today, 7);
        const atRiskIds = new Set();
        let totalLeadTime = 0, leadTimeCount = 0;
        let duePaymentsCount = 0;
        let totalClearance = 0, clearanceCount = 0;

        imports.forEach(imp => {
            // Avg. Transit Lead Time
            if (imp.departureVesselDate && imp.arrivalVesselDate) {
                const lead = differenceInDays(new Date(imp.arrivalVesselDate), new Date(imp.departureVesselDate));
                if (lead >= 0) {
                    totalLeadTime += lead;
                    leadTimeCount++;
                }
            }

            // Avg Clearance Time
             if (imp.greenChannelDate && imp.arrivalVesselDate) {
                const clearance = differenceInDays(new Date(imp.greenChannelDate), new Date(imp.arrivalVesselDate));
                if (clearance >= 0) {
                    totalClearance += clearance;
                    clearanceCount++;
                }
            }

            // Imports at Risk: Past ETA
            const isDelivered = imp.overallStatus === 'Delivered';
            if (!isDelivered && imp.dates.estimatedArrival && isPast(new Date(imp.dates.estimatedArrival))) {
                atRiskIds.add(imp.id);
            }

            // Imports at Risk: Demurrage
            const arrivalEvent = imp.trackingHistory.find(e => e.stage === ImportStatus.ArrivalAtPort);
            if (!isDelivered && arrivalEvent) {
                const freeTimeEndDate = addDays(new Date(arrivalEvent.date), imp.demurrageFreeTimeDays);
                const daysToDemurrage = differenceInDays(freeTimeEndDate, today);
                if (daysToDemurrage <= 5) {
                    atRiskIds.add(imp.id);
                }
            }

            // Payments due soon
            imp.costs.forEach(cost => {
                if(cost.dueDate && cost.status !== PaymentStatus.Paid && cost.status !== PaymentStatus.Cancelled) {
                    const dueDate = new Date(cost.dueDate + 'T00:00:00Z');
                     if (dueDate >= today && dueDate <= nextWeek) {
                        duePaymentsCount++;
                    }
                }
            });
        });
        
        // Imports at Risk: Open Claims
        claims.forEach(claim => {
            if (claim.status !== 'Resolved' && claim.status !== 'Rejected') {
                const imp = imports.find(i => i.id === claim.importId);
                if (imp && imp.overallStatus !== 'Delivered') {
                    atRiskIds.add(claim.importId);
                }
            }
        });

        return {
            importsAtRisk: atRiskIds.size,
            avgTransitLeadTime: leadTimeCount > 0 ? (totalLeadTime / leadTimeCount).toFixed(1) : 'N/A',
            paymentsDueSoon: duePaymentsCount,
            avgClearanceTime: clearanceCount > 0 ? (totalClearance / clearanceCount).toFixed(1) : 'N/A',
        };
    }, [imports, claims]);

    const monthlyCostData = useMemo(() => {
        if (!exchangeRates) return [];
        
        const costsInMonth = imports.flatMap(imp => imp.costs)
            .filter(cost => {
                const costDate = cost.paymentDate || cost.dueDate;
                return costDate && costDate.startsWith(selectedMonth);
            });

        const breakdown = costsInMonth.reduce((acc, cost) => {
            const costInBRL = convertToBRL(cost.value, cost.currency);
            acc[cost.category] = (acc[cost.category] || 0) + costInBRL;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(breakdown).map(([name, value]) => ({name, value}));
    }, [imports, selectedMonth, exchangeRates]);

    const currencyFormatter = (value: number) => `R$${(value/1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
    
    const handleRateChange = (currency: 'usd' | 'eur' | 'cny', field: keyof CurrencyRateDetail | 'rate', value: string) => {
        const numericValue = parseFloat(value) || 0;
        setManualRates(prev => {
            if (!prev) return prev;
            const newRates = { ...prev };
            if (currency === 'cny') {
                newRates.cny = numericValue;
            } else {
                newRates[currency] = { ...newRates[currency], [field]: numericValue };
            }
            return newRates;
        });
    };

    const handleSaveRates = () => {
        if(manualRates) {
            setExchangeRates({...manualRates, date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString()});
        }
        setIsEditingRates(false);
    }
    
    const renderRateDisplay = (label: string, value?: number) => (
        <p className="text-xl font-bold text-brand-gray-500 dark:text-white">
            {label} {value?.toFixed(4) ?? 'N/A'}
        </p>
    );

    const renderRateInput = (currency: 'usd' | 'eur', field: keyof CurrencyRateDetail) => (
         <input 
            type="number"
            step="0.0001"
            value={manualRates?.[currency]?.[field] || ''}
            onChange={e => handleRateChange(currency, field, e.target.value)}
            className="w-24 p-1 text-sm border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200"
         />
    );


    return (
        <div className="space-y-6">
             {companyLogo && (
                <div className="flex justify-center mb-2">
                    <img src={companyLogo} alt="Company Logo" className="max-h-16" />
                </div>
             )}

            <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white">Daily Currency Exchange Rates (BRL)</h3>
                    {isEditingRates ? (
                         <div className="flex items-center gap-2">
                            <button onClick={handleSaveRates} className="p-2 text-emerald-600 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900"><Save size={20}/></button>
                            <button onClick={() => { setIsEditingRates(false); setManualRates(exchangeRates); }} className="p-2 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900"><XIcon size={20}/></button>
                        </div>
                    ) : (
                        <button onClick={() => setIsEditingRates(true)} className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 p-2 rounded-lg hover:bg-sky-100 dark:hover:bg-brand-accent"><Edit size={14}/> Update Rates</button>
                    )}
                </div>
                {ratesLoading && !exchangeRates ? (
                    <div className="text-center py-4"><Loader className="animate-spin text-brand-accent"/></div>
                ) : ratesError ? (
                     <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md">
                        <p><span className="font-bold">Error:</span> {ratesError}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-brand-secondary p-4 rounded-xl shadow-card space-y-2">
                             <div className="flex items-center gap-2 font-bold text-brand-secondary dark:text-gray-200"><CircleDollarSign size={20} className="text-emerald-500"/> USD</div>
                             {isEditingRates ? (
                                <div className="space-y-1 text-sm"><label>Compra:</label> {renderRateInput('usd', 'compra')} <label className="ml-2">Venda:</label> {renderRateInput('usd', 'venda')}</div>
                             ) : (
                                <>{renderRateDisplay('Compra:', manualRates?.usd?.compra)} {renderRateDisplay('Venda:', manualRates?.usd?.venda)}</>
                             )}
                        </div>
                         <div className="bg-white dark:bg-brand-secondary p-4 rounded-xl shadow-card space-y-2">
                             <div className="flex items-center gap-2 font-bold text-brand-secondary dark:text-gray-200"><Euro size={20} className="text-sky-500"/> EUR</div>
                             {isEditingRates ? (
                                <div className="space-y-1 text-sm"><label>Compra:</label> {renderRateInput('eur', 'compra')} <label className="ml-2">Venda:</label> {renderRateInput('eur', 'venda')}</div>
                             ) : (
                                 <>{renderRateDisplay('Compra:', manualRates?.eur?.compra)} {renderRateDisplay('Venda:', manualRates?.eur?.venda)}</>
                             )}
                        </div>
                         <div className="bg-white dark:bg-brand-secondary p-4 rounded-xl shadow-card space-y-2">
                             <div className="flex items-center gap-2 font-bold text-brand-secondary dark:text-gray-200"><JapaneseYen size={20} className="text-red-500"/> CNY</div>
                              {isEditingRates ? (
                                <div className="space-y-1 text-sm"><label>Taxa:</label> <input type="number" step="0.0001" value={manualRates?.cny || ''} onChange={e => handleRateChange('cny', 'rate', e.target.value)} className="w-24 p-1 text-sm border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200"/></div>
                             ) : (
                                renderRateDisplay('Taxa:', manualRates?.cny)
                             )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-card">
                <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white mb-4">Key Performance Indicators</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard title="Imports at Risk" value={`${importsAtRisk}`} icon={<AlertTriangle size={24}/>} description="ETA past, near demurrage, open claims." trend="down" trendText="-5% vs last week"/>
                    <KPICard title="Avg. Transit Time" value={`${avgTransitLeadTime} days`} icon={<Ship size={24}/>} description="Vessel departure to port arrival." trend="up" trendText="+2% vs last month" />
                    <KPICard title="Avg. Clearance Time" value={`${avgClearanceTime} days`} icon={<CheckCircle size={24}/>} description="Vessel arrival to DI green channel." trend="stable" trendText="Unchanged"/>
                    <KPICard title="Payments Due (Next 7d)" value={`${paymentsDueSoon}`} icon={<DollarSignIcon size={24}/>} description="Cost items due for payment soon." trend="up" trendText="+15% vs last week"/>
                </div>
            </div>

            <MyTasksWidget tasks={tasks} currentUser={currentUser} />

            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-card">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white">Monthly Costs (BRL)</h3>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="p-1 border dark:border-brand-accent rounded-md text-sm bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200"
                    />
                </div>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyCostData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                            <XAxis type="number" stroke={theme === 'dark' ? '#A9A9A9' : '#708090'} tickFormatter={currencyFormatter} />
                            <YAxis dataKey="name" type="category" stroke={theme === 'dark' ? '#A9A9A9' : '#708090'} width={120} />
                            <Tooltip formatter={(value: number) => `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: theme === 'dark' ? '#022C43' : 'white', border: '1px solid #374151' }}/>
                            <Legend wrapperStyle={{color: theme === 'dark' ? '#A9A9A9' : '#708090'}} />
                            <Bar dataKey="value" name="Cost" fill={theme === 'dark' ? '#7ac7e8' : '#36454F'} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;