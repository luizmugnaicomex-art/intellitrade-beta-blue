import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { ImportProcess, TrackingEvent, Container, CostItem, ContainerMilestone, ContainerTrackingInfo, User, DIChannel, ExchangeRates, Currency } from '../types';
import { ImportStatus, ContainerStatus, SeaportStatus, PaymentStatus } from '../types';
import { Edit, Package, DollarSign, ListChecks, FileArchive, BrainCircuit, Loader, AlertCircle, Ship, MessageSquare, Save, CheckCircle, Wallet, FileBadge, RefreshCw, MapPin, PackageSearch, Mail, Plus, X, BellDot, User as UserIcon, FileText, AlertTriangle, ChevronDown } from 'lucide-react';
import { geminiSuggestNCM, geminiPredictLeadTime, geminiGetContainerTrackingInfo, geminiSendEmailNotification } from '../services/geminiService';
import { differenceInDays, addDays } from 'date-fns';

interface ImportDetailProps {
    imports: ImportProcess[];
    users: User[];
    updateImport: (updatedImport: ImportProcess) => void;
    currentUser: User;
    exchangeRates: ExchangeRates | null;
}

const InfoPill: React.FC<{ label: string; value: string | number | undefined; }> = ({ label, value }) => (
    <div className="bg-slate-100 dark:bg-brand-primary p-3 rounded-lg text-center">
        <p className="text-xs text-brand-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-semibold text-brand-gray-500 dark:text-white truncate">{value || 'N/A'}</p>
    </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, children }) => (
    <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
        <div className="flex items-center mb-4 border-b dark:border-gray-700 pb-3">
            {icon}
            <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white ml-3">{title}</h3>
        </div>
        {children}
    </div>
);

const getPaymentStatusChip = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.Paid: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/50 dark:text-emerald-300';
        case PaymentStatus.PendingApproval: return 'bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-300';
        case PaymentStatus.Approved: return 'bg-sky-100 text-sky-700 dark:bg-sky-800/50 dark:text-sky-300';
        case PaymentStatus.Processed: return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800/50 dark:text-indigo-300';
        case PaymentStatus.Reconciled: return 'bg-teal-100 text-teal-700 dark:bg-teal-800/50 dark:text-teal-300';
        case PaymentStatus.Disputed: return 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300';
        case PaymentStatus.Cancelled: return 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
};

const getDiChannelChip = (channel?: DIChannel) => {
    switch(channel) {
        case 'Green': return 'bg-green-500 text-white';
        case 'Yellow': return 'bg-yellow-500 text-white';
        case 'Red': return 'bg-red-500 text-white';
        case 'Gray': return 'bg-gray-500 text-white';
        default: return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
    }
}

const CONTAINER_STAGES: ContainerStatus[] = [
    ContainerStatus.OnVessel,
    ContainerStatus.AtPort,
    ContainerStatus.CustomsCleared,
    ContainerStatus.InTransitToFactory,
    ContainerStatus.DeliveredToFactory,
    ContainerStatus.SentToDepot
];

const ContainerProgressBar: React.FC<{ currentStatus: ContainerStatus | SeaportStatus }> = ({ currentStatus }) => {
    const currentIndex = CONTAINER_STAGES.indexOf(currentStatus as ContainerStatus);
    return (
        <div className="w-full pt-2">
             <div className="flex w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 my-1">
                {CONTAINER_STAGES.map((status, index) => (
                    <div key={status} className="flex-1 first:rounded-l-full last:rounded-r-full" title={status}>
                        <div className={`h-full w-full transition-colors ${index <= currentIndex ? 'bg-sky-500' : ''} ${index === 0 ? 'rounded-l-full' : ''} ${index === CONTAINER_STAGES.length-1 ? 'rounded-r-full' : ''} ${index < currentIndex ? 'border-r-2 border-white dark:border-gray-700' : ''}`}></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DemurrageCalculator: React.FC<{ imp: ImportProcess }> = ({ imp }) => {
    const arrivalEvent = imp.trackingHistory.find(e => e.stage === ImportStatus.ArrivalAtPort);
    if (!arrivalEvent) return <p className="text-xs text-gray-500 dark:text-gray-400">Awaiting port arrival to calculate demurrage.</p>;

    const today = new Date();
    today.setHours(0,0,0,0);
    const arrivalDate = new Date(arrivalEvent.date);
    arrivalDate.setHours(0,0,0,0);
    const freeTimeEndDate = addDays(arrivalDate, imp.demurrageFreeTimeDays);
    const daysRemaining = differenceInDays(freeTimeEndDate, today);
    const DEMURRAGE_RATE = 150; // USD per day, mock rate

    return (
        <div className="mt-4 border-t dark:border-gray-700 pt-4 text-xs space-y-1">
            <h5 className="font-semibold text-sm text-brand-gray-500 dark:text-gray-200 mb-2">Demurrage Preview</h5>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Free Days:</span> <span>{imp.demurrageFreeTimeDays}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Free Time Ends:</span> <span>{freeTimeEndDate.toLocaleDateString()}</span></div>
            {daysRemaining >= 0 ? (
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-right">{daysRemaining} free days remaining.</p>
            ) : (
                <div className="text-red-600 dark:text-red-400 text-right">
                    <p className="font-semibold">{-daysRemaining} days in demurrage.</p>
                    <p>Estimated Cost: ${(-daysRemaining * DEMURRAGE_RATE).toLocaleString()}</p>
                </div>
            )}
        </div>
    );
};

const ContainerItem: React.FC<{ 
    imp: ImportProcess,
    container: Container, 
    onFetchTracking: (id: string, num: string) => void,
    onUpdate: (id: string, field: keyof Container, value: any) => void,
    trackingInfo: any,
    loadingStates: any,
    canEditLogistics: boolean
}> = ({ imp, container, onFetchTracking, onUpdate, trackingInfo, loadingStates, canEditLogistics }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasDiscrepancy = container.etaFromCarrier && container.etaFactory && container.etaFromCarrier !== container.etaFactory;
    const showPortDetails = [ContainerStatus.AtPort, ContainerStatus.CustomsCleared, ContainerStatus.InTransitToFactory, ContainerStatus.DeliveredToFactory, ContainerStatus.SentToDepot].includes(container.currentStatus as ContainerStatus);

    return (
        <div className={`rounded-lg border dark:border-brand-accent ${hasDiscrepancy ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-400' : 'bg-slate-50 dark:bg-brand-primary/50'}`}>
            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <div className="font-semibold text-brand-gray-500 dark:text-gray-200">{container.containerNumber}</div>
                    <div className="text-sm text-brand-gray-500 dark:text-gray-300">{container.currentStatus}</div>
                     <div className="text-sm text-brand-gray-500 dark:text-gray-300 hidden md:block">
                        Carrier ETA: {container.etaFromCarrier ? new Date(container.etaFromCarrier + 'T00:00:00Z').toLocaleDateString() : 'N/A'}
                        {hasDiscrepancy && <span title={`Factory ETA (${new Date(container.etaFactory + 'T00:00:00Z').toLocaleDateString()}) differs.`}><AlertTriangle size={16} className="text-amber-500 inline ml-2" /></span>}
                    </div>
                    <div className="text-sm text-brand-gray-500 dark:text-gray-300 hidden md:block">Factory ETA: {container.etaFactory ? new Date(container.etaFactory + 'T00:00:00Z').toLocaleDateString() : 'N/A'}</div>
                </div>
                 <ChevronDown size={20} className={`text-brand-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
            {isExpanded && (
                <div className="p-4 border-t dark:border-gray-700 animate-fade-in-down space-y-4">
                    <ContainerProgressBar currentStatus={container.currentStatus} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-brand-gray-500 dark:text-gray-300">Status</label>
                            <select 
                              value={container.currentStatus} 
                              onChange={(e) => onUpdate(container.id, 'currentStatus', e.target.value)}
                              disabled={!canEditLogistics}
                              className="block w-full mt-1 p-2 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800"
                            >
                                {Object.values(ContainerStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-2 gap-2">
                             <button onClick={() => onFetchTracking(container.id, container.containerNumber)} disabled={loadingStates[`tracking_${container.id}`]} className="w-full text-sm flex items-center justify-center gap-2 bg-teal-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50">
                                {loadingStates[`tracking_${container.id}`] ? <Loader size={16} className="animate-spin"/> : <PackageSearch size={16}/>} Sync Status
                            </button>
                             <button 
                                onClick={() => onUpdate(container.id, 'seaportArrivalDate', new Date().toISOString().split('T')[0])}
                                disabled={!canEditLogistics || !!container.seaportArrivalDate}
                                className="w-full text-sm flex items-center justify-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                            >
                                <CheckCircle size={16}/> Confirm Port Arrival
                            </button>
                        </div>
                    </div>
                    {trackingInfo && (
                         <div className="mt-4 border-t dark:border-gray-700 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="font-semibold text-sm text-brand-gray-500 dark:text-gray-200">Journey Milestones</h5>
                                {container.lastSync && <span className="text-xs text-brand-gray-500 dark:text-gray-400">Last Synced: {new Date(container.lastSync).toLocaleString()}</span>}
                            </div>
                            <ul className="space-y-2 text-xs">
                                {trackingInfo.milestones.map((m: ContainerMilestone, i: number) => (
                                    <li key={i} className="flex gap-2">
                                        <span className="font-medium text-brand-gray-500 dark:text-gray-300 w-1/4">{new Date(m.date + 'T00:00:00Z').toLocaleDateString()}</span>
                                        <span className="text-brand-gray-500 dark:text-gray-400 w-3/4">{m.description} at {m.location}</span>
                                    </li>
                                ))}
                            </ul>
                         </div>
                    )}
                    {showPortDetails && (
                        <>
                            <div className="mt-4 border-t dark:border-gray-700 pt-4">
                                <h5 className="font-semibold text-sm text-brand-gray-500 dark:text-gray-200 mb-2">Sea Port Warehouse Details</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="text-xs font-medium text-brand-gray-500 dark:text-gray-400">Status at Port</label>
                                        <select 
                                            value={container.seaportStatus || ''} 
                                            onChange={(e) => onUpdate(container.id, 'seaportStatus', e.target.value)}
                                            disabled={!canEditLogistics}
                                            className="block w-full mt-1 p-1.5 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800 text-xs"
                                        >
                                            <option value="">-- Select Status --</option>
                                            {Object.values(SeaportStatus).map((s: any) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-brand-gray-500 dark:text-gray-400">Port Arrival Date</label>
                                        <input
                                            type="date"
                                            value={(container.seaportArrivalDate || '').split('T')[0]}
                                            onChange={(e) => onUpdate(container.id, 'seaportArrivalDate', e.target.value)}
                                            disabled={!canEditLogistics}
                                            className="block w-full mt-1 p-1.5 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 border-t dark:border-gray-700 pt-4">
                                <h5 className="font-semibold text-sm text-brand-gray-500 dark:text-gray-200 mb-2">Unloading & Release Dates</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <label className="text-xs font-medium text-brand-gray-500 dark:text-gray-400">Unloading Start</label>
                                        <input
                                            type="datetime-local"
                                            value={container.actualUnloadingStart || ''}
                                            onChange={(e) => onUpdate(container.id, 'actualUnloadingStart', e.target.value)}
                                            disabled={!canEditLogistics}
                                            className="block w-full mt-1 p-1.5 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-brand-gray-500 dark:text-gray-400">Unloading End</label>
                                        <input
                                            type="datetime-local"
                                            value={container.actualUnloadingEnd || ''}
                                            onChange={(e) => onUpdate(container.id, 'actualUnloadingEnd', e.target.value)}
                                            disabled={!canEditLogistics}
                                            className="block w-full mt-1 p-1.5 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-brand-gray-500 dark:text-gray-400">Customs Release</label>
                                        <input
                                            type="date"
                                            value={(container.customsReleaseDate || '').split('T')[0]}
                                            onChange={(e) => onUpdate(container.id, 'customsReleaseDate', e.target.value)}
                                            disabled={!canEditLogistics}
                                            className="block w-full mt-1 p-1.5 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    <DemurrageCalculator imp={imp} />
                </div>
            )}
        </div>
    );
};


const ImportDetail: React.FC<ImportDetailProps> = ({ imports, users, updateImport, currentUser, exchangeRates }) => {
    const { id } = useParams<{ id: string }>();
    const currentImport = imports.find(imp => imp.id === id);
    
    const [localImport, setLocalImport] = useState(currentImport);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isEditingHistory, setIsEditingHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [ncmSuggestions, setNcmSuggestions] = useState<{[key: string]: string}>({});
    const [leadTimePrediction, setLeadTimePrediction] = useState<{clearance: string, delivery: string} | null>(null);
    const [loadingStates, setLoadingStates] = useState<{[key:string]: boolean}>({});
    const [error, setError] = useState<string | null>(null);

    const [containerTrackingDetails, setContainerTrackingDetails] = useState<{[containerId: string]: { milestones: ContainerMilestone[], lastSync?: string } }>({});
    const [newEmail, setNewEmail] = useState('');
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

    const canEditLogistics = currentUser.role === 'Admin' || currentUser.role === 'Logistics';
    const canEditFinance = currentUser.role === 'Admin' || currentUser.role === 'Finance';
    const canEditAll = currentUser.role === 'Admin';
    const canEditAnything = canEditLogistics || canEditFinance || canEditAll;

    const creator = useMemo(() => {
        if (!localImport) return null;
        return users.find(u => u.id === localImport.createdById);
    }, [localImport, users]);

    useEffect(() => {
        if(currentImport && JSON.stringify(currentImport) !== JSON.stringify(localImport)){
            setIsSaving(true);
        } else {
            setIsSaving(false);
        }
    }, [localImport, currentImport])

     const showNotification = (message: string) => {
        setNotificationMessage(message);
        setTimeout(() => setNotificationMessage(null), 5000);
    };

    const triggerNotification = useCallback(async (subject: string, body: string) => {
        if(localImport && localImport.notificationEmails.length > 0) {
            try {
                const confirmation = await geminiSendEmailNotification(localImport.notificationEmails, subject, body);
                showNotification(confirmation);
            } catch (err) {
                 showNotification(err instanceof Error ? err.message : 'Failed to send notification.');
            }
        }
    }, [localImport]);

    const handleSaveAll = () => {
        if(localImport) {
            updateImport(localImport);
            showNotification("Changes saved successfully!");
        }
    }

    const updateLocalState = useCallback((updatedData: Partial<ImportProcess>, notification?: {subject: string, body: string}) => {
        setLocalImport(prev => {
            if (!prev) return prev;
            const newImport = { ...prev, ...updatedData };
            if(notification) {
                 triggerNotification(notification.subject, notification.body);
            }
            return newImport;
        });
    }, [triggerNotification]);
    
    const handleStatusUpdate = useCallback((newStatus: ImportStatus) => {
        if (localImport) {
            const newHistory: TrackingEvent = { stage: newStatus, date: new Date().toISOString() };
            updateLocalState(
                { trackingHistory: [...localImport.trackingHistory, newHistory] },
                {
                    subject: `Update on Import ${localImport.importNumber}`,
                    body: `The status for import ${localImport.importNumber} has been updated to: "${newStatus}".`
                }
            );
        }
    }, [localImport, updateLocalState]);

    const handleHistoryDateChange = (index: number, newDate: string) => {
        if (localImport) {
            const newHistory = [...localImport.trackingHistory];
            newHistory[index].date = new Date(newDate).toISOString();
            setLocalImport({ ...localImport, trackingHistory: newHistory });
        }
    };
    
    const handleSaveHistory = () => {
        setIsEditingHistory(false);
        handleSaveAll();
    };
    
    const handleContainerUpdate = useCallback((containerId: string, field: keyof Container, value: any) => {
         if(localImport) {
            const updatedContainers = localImport.containers.map(c => 
                c.id === containerId ? { ...c, [field]: value } : c
            );
            
            const oldContainer = localImport.containers.find(c => c.id === containerId);
            let notification;
            if(oldContainer && field === 'currentStatus' && oldContainer.currentStatus !== value) {
                notification = {
                    subject: `Container Update for Import ${localImport.importNumber}`,
                    body: `The status of container ${oldContainer.containerNumber} has been updated to "${value}".`
                }
            }
            updateLocalState({containers: updatedContainers}, notification);
        }
    }, [localImport, updateLocalState]);

    const handleObservationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if(localImport) {
            setLocalImport({...localImport, observationNotes: e.target.value});
        }
    }

    const handleCostItemUpdate = useCallback((costId: string, field: keyof CostItem, value: any) => {
         if(localImport) {
            const updatedCosts = localImport.costs.map(c => 
                c.id === costId ? { ...c, [field]: value } : c
            );
            updateLocalState({costs: updatedCosts});
        }
    }, [localImport, updateLocalState]);

    const handleAddEmail = () => {
        if (newEmail && localImport && !localImport.notificationEmails.includes(newEmail)) {
            const updatedEmails = [...localImport.notificationEmails, newEmail];
            updateLocalState({ notificationEmails: updatedEmails });
            setNewEmail('');
        }
    };

    const handleRemoveEmail = (emailToRemove: string) => {
        if (localImport) {
            const updatedEmails = localImport.notificationEmails.filter(e => e !== emailToRemove);
            updateLocalState({ notificationEmails: updatedEmails });
        }
    };

    const handleNCMsugestion = useCallback(async (productId: string, description: string) => {
        setLoadingStates(prev => ({...prev, [`ncm_${productId}`]: true}));
        setError(null);
        try {
            const suggestion = await geminiSuggestNCM(description);
            setNcmSuggestions(prev => ({...prev, [productId]: suggestion}));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get NCM suggestion.');
        } finally {
            setLoadingStates(prev => ({...prev, [`ncm_${productId}`]: false}));
        }
    }, []);

    const handleLeadTimePrediction = useCallback(async () => {
        if (!localImport) return;
        setLoadingStates(prev => ({...prev, leadTime: true}));
        setError(null);
        try {
            const historicalData = imports.filter(i => i.id !== localImport.id);
            const prediction = await geminiPredictLeadTime(localImport, historicalData);
            setLeadTimePrediction(prediction);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to predict lead time.');
        } finally {
            setLoadingStates(prev => ({...prev, leadTime: false}));
        }
    }, [localImport, imports]);
    
    const handleFetchContainerTracking = useCallback(async (containerId: string, containerNumber: string) => {
        setLoadingStates(prev => ({...prev, [`tracking_${containerId}`]: true}));
        setError(null);
        try {
            const info = await geminiGetContainerTrackingInfo(containerNumber);
            setContainerTrackingDetails(prev => ({...prev, [containerId]: { milestones: info.milestones, lastSync: info.lastSync } }));
            if (localImport) {
                const oldContainer = localImport.containers.find(c => c.id === containerId);
                const updatedContainers = localImport.containers.map(c => 
                    c.id === containerId ? { ...c, etaFromCarrier: info.etaFromCarrier, currentStatus: info.currentStatus as ContainerStatus || c.currentStatus, lastSync: info.lastSync } : c
                );

                let notification;
                if(oldContainer && oldContainer.etaFromCarrier !== info.etaFromCarrier) {
                    notification = {
                        subject: `Carrier ETA Updated for Import ${localImport.importNumber}`,
                        body: `The carrier ETA for container ${containerNumber} has been updated to ${info.etaFromCarrier}.`
                    }
                }
                updateLocalState({ containers: updatedContainers }, notification);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get container tracking info.');
        } finally {
            setLoadingStates(prev => ({...prev, [`tracking_${containerId}`]: false}));
        }
    }, [localImport, updateLocalState]);
    

    const costSummary = useMemo(() => {
        if (!localImport || !exchangeRates) return { breakdown: {}, total: 0 };
        
        const convertToBRL = (value: number, currency: Currency): number => {
            switch(currency) {
                case 'USD': return value * exchangeRates.usd.venda;
                case 'EUR': return value * exchangeRates.eur.venda;
                case 'CNY': return value * exchangeRates.cny;
                default: return value;
            }
        };

        const breakdown = localImport.costs.reduce((acc, cost) => {
            const costInBRL = convertToBRL(cost.value, cost.currency);
            acc[cost.category] = (acc[cost.category] || 0) + costInBRL;
            return acc;
        }, {} as Record<string, number>);
        
        const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
        return { breakdown, total };

    }, [localImport, exchangeRates]);

    if (!localImport) {
        return (
            <div className="text-center text-brand-gray-500 dark:text-gray-400 p-8 bg-white dark:bg-brand-secondary rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-brand-gray-200" />
                <h2 className="mt-2 text-lg font-medium text-brand-gray-500 dark:text-white">Import not found</h2>
                <p className="mt-1 text-sm">The import process you are looking for does not exist or could not be loaded.</p>
                <Link to="/imports" className="mt-6 inline-block bg-brand-secondary text-white px-6 py-2 rounded-lg hover:bg-brand-accent transition-colors">
                    Back to All Imports
                </Link>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
             {isSaving && (
                <div className="fixed bottom-5 right-5 bg-brand-highlight text-brand-primary px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down flex items-center gap-3">
                    <AlertTriangle size={20} />
                    <span>You have unsaved changes.</span>
                     <button onClick={handleSaveAll} className="flex items-center gap-2 bg-brand-primary text-white px-3 py-1 rounded-lg text-sm font-semibold hover:opacity-90">
                        <Save size={16}/> Save Now
                    </button>
                </div>
            )}
    
            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-gray-500 dark:text-white">{localImport.importNumber}</h2>
                        <p className="text-brand-gray-500 dark:text-gray-400">Supplier: {localImport.supplier}</p>
                        <p className="text-brand-gray-500 dark:text-gray-400">Broker: {localImport.responsibleBroker}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getDiChannelChip(localImport.diChannel)}`}>{localImport.diChannel || 'No Channel'}</span>
                            <span className="text-sm text-brand-gray-500 dark:text-gray-300">{localImport.diStatusText || 'DI Status not set'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {creator && (
                             <div className="flex items-center gap-2 text-sm text-brand-gray-500 dark:text-gray-300">
                                 <UserIcon size={16} />
                                 <span>Responsible: <span className="font-semibold">{creator.name}</span></span>
                             </div>
                        )}
                        {canEditAnything && (
                            <Link to={`/imports/${localImport.id}/edit`} className="flex items-center gap-2 bg-brand-secondary text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-accent">
                                <Edit size={16} /> Edit
                            </Link>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
                    <InfoPill label="PO Number(s)" value={localImport.poNumbers} />
                    <InfoPill label="BL Number" value={localImport.blNumber} />
                    <InfoPill label="Vessel Name" value={localImport.vesselName} />
                    <InfoPill label="Incoterm" value={localImport.incoterm} />
                    <InfoPill label="Cargo Type" value={localImport.typeOfCargo} />
                    <InfoPill label="Est. Arrival" value={localImport.dates.estimatedArrival ? new Date(localImport.dates.estimatedArrival  + 'T00:00:00Z').toLocaleDateString() : ''} />
                    <InfoPill label="Landed Cost (BRL)" value={`R$${costSummary.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} />
                </div>
            </div>
    
            {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm">{error}</div>}
    
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Process Tracking */}
                    <Section title="Process Tracking" icon={<ListChecks size={22} className="text-brand-gray-500" />}>
                         <div className="flex justify-end mb-2">
                            {isEditingHistory ? (
                                <button onClick={handleSaveHistory} className="flex items-center gap-2 text-sm bg-emerald-500 text-white px-3 py-1 rounded-lg">
                                    <Save size={16}/> Save Dates
                                </button>
                            ) : ( canEditLogistics &&
                                <button onClick={() => setIsEditingHistory(true)} className="flex items-center gap-2 text-sm bg-slate-200 dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 px-3 py-1 rounded-lg">
                                    <Edit size={16}/> Adjust Dates
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <div className="border-l-2 border-dashed border-slate-300 dark:border-gray-600 absolute h-full top-0 left-4"></div>
                            <ul className="space-y-4">
                                {localImport.trackingHistory.map((event, index) => (
                                    <li key={index} className="flex items-center">
                                        <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-white z-10">
                                            <CheckCircle size={20} />
                                        </div>
                                        <div className="ml-4">
                                            <p className="font-semibold text-brand-gray-500 dark:text-white">{event.stage}</p>
                                            {isEditingHistory ? (
                                                <input
                                                    type="date"
                                                    value={event.date.split('T')[0]}
                                                    onChange={(e) => handleHistoryDateChange(index, e.target.value)}
                                                    className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-sm text-brand-gray-500 dark:text-gray-200"
                                                />
                                            ) : (
                                                <p className="text-sm text-brand-gray-500 dark:text-gray-400">{new Date(event.date).toLocaleString()}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {!isUpdatingStatus && canEditLogistics && localImport.trackingHistory[localImport.trackingHistory.length - 1].stage !== ImportStatus.Delivered && (
                                    <li className="flex items-center">
                                        <div className="bg-slate-300 dark:bg-gray-600 rounded-full w-8 h-8 flex items-center justify-center z-10"></div>
                                        <div className="ml-4">
                                            <select
                                                onChange={(e) => handleStatusUpdate(e.target.value as ImportStatus)}
                                                className="p-2 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-sm text-brand-gray-500 dark:text-gray-200"
                                                value=""
                                            >
                                                <option value="" disabled>Update to next status...</option>
                                                {Object.values(ImportStatus).map((status) => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </Section>
                    
                     {/* Container Control */}
                    <Section title="Container Control" icon={<Ship size={22} className="text-brand-gray-500"/>}>
                         <div className="space-y-2">
                             {localImport.containers.map(container => (
                                <ContainerItem
                                    key={container.id}
                                    imp={localImport}
                                    container={container}
                                    onFetchTracking={handleFetchContainerTracking}
                                    onUpdate={handleContainerUpdate}
                                    trackingInfo={containerTrackingDetails[container.id]}
                                    loadingStates={loadingStates}
                                    canEditLogistics={canEditLogistics}
                                />
                             ))}
                        </div>
                    </Section>
                </div>
                
                <div className="lg:col-span-1 space-y-6">
                    {/* AI Features */}
                    <Section title="AI Co-pilot" icon={<BrainCircuit size={22} className="text-brand-gray-500"/>}>
                        <div className="space-y-4">
                            <div>
                                <button onClick={handleLeadTimePrediction} disabled={loadingStates['leadTime']} className="w-full text-sm flex items-center justify-center gap-2 bg-brand-highlight text-brand-primary px-3 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">
                                    {loadingStates['leadTime'] ? <Loader size={16} className="animate-spin"/> : null} Predict Lead Time
                                </button>
                                {leadTimePrediction && (
                                    <div className="mt-2 p-3 bg-slate-100 dark:bg-brand-primary rounded-lg text-sm">
                                        <p><span className="font-semibold text-brand-gray-500 dark:text-gray-300">Predicted Clearance:</span> {new Date(leadTimePrediction.clearance  + 'T00:00:00Z').toLocaleDateString()}</p>
                                        <p><span className="font-semibold text-brand-gray-500 dark:text-gray-300">Predicted Delivery:</span> {new Date(leadTimePrediction.delivery  + 'T00:00:00Z').toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
    
             {/* Products */}
            <Section title="Products" icon={<Package size={22} className="text-brand-gray-500"/>}>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b dark:border-gray-700">
                            <tr>
                                <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300">Product Name</th>
                                <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300">NCM</th>
                                <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300 text-right">Quantity</th>
                                <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300 text-right">Unit Value</th>
                                <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300 text-right">Total Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localImport.products.map(p => (
                                <tr key={p.id} className="border-b dark:border-gray-800 last:border-b-0">
                                    <td className="p-2 text-brand-gray-500 dark:text-gray-200">{p.name}</td>
                                    <td className="p-2 text-brand-gray-500 dark:text-gray-300">
                                        <span>{p.ncm}</span>
                                        {!p.ncm && (
                                            <button onClick={() => handleNCMsugestion(p.id, p.name)} className="ml-2 text-xs text-brand-gray-500 hover:underline disabled:text-gray-500" disabled={loadingStates[`ncm_${p.id}`]}>
                                                {loadingStates[`ncm_${p.id}`] ? 'Loading...' : 'Suggest'}
                                            </button>
                                        )}
                                        {ncmSuggestions[p.id] && <span className="ml-2 text-xs text-emerald-500">({ncmSuggestions[p.id]})</span>}
                                    </td>
                                    <td className="p-2 text-right text-brand-gray-500 dark:text-gray-300">{p.quantity}</td>
                                    <td className="p-2 text-right text-brand-gray-500 dark:text-gray-300">${p.unitValue.toFixed(2)}</td>
                                    <td className="p-2 text-right font-semibold text-brand-gray-500 dark:text-gray-200">${(p.quantity * p.unitValue).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>
            
            {/* Costs & Payments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Section title="Cost Breakdown" icon={<DollarSign size={22} className="text-brand-gray-500"/>}>
                     <ul className="space-y-2 text-sm">
                        {Object.entries(costSummary.breakdown).map(([category, value]) => (
                             <li key={category} className="flex justify-between items-center text-brand-gray-500 dark:text-gray-300">
                                <span>{category}</span>
                                <span className="font-medium">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </li>
                        ))}
                         <li className="flex justify-between font-bold text-lg border-t dark:border-gray-700 pt-2 mt-2"><span className="text-brand-gray-500 dark:text-white">Total Landed Cost (BRL):</span> <span className="text-brand-gray-500 dark:text-white">R$ {costSummary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></li>
                     </ul>
                      {!exchangeRates && <p className="text-xs text-brand-gray-500 dark:text-gray-400 mt-2 italic">Loading exchange rates for conversion...</p>}
                 </Section>
                
                <Section title="Payment Schedule" icon={<Wallet size={22} className="text-brand-gray-500"/>}>
                    <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b dark:border-gray-700">
                                 <tr>
                                    <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300">Category</th>
                                    <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300 text-right">Value</th>
                                    <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300">Status</th>
                                     <th className="p-2 font-semibold text-brand-gray-500 dark:text-gray-300">OA#</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localImport.costs.map(cost => (
                                    <tr key={cost.id} className="border-b dark:border-gray-800 last:border-b-0">
                                        <td className="p-2 text-brand-gray-500 dark:text-gray-300">{cost.description}</td>
                                        <td className="p-2 text-right text-brand-gray-500 dark:text-gray-300">{cost.value.toFixed(2)} <span className="text-xs text-brand-gray-400">{cost.currency}</span></td>
                                        <td className="p-2">
                                             <select 
                                              value={cost.status} 
                                              onChange={(e) => handleCostItemUpdate(cost.id, 'status', e.target.value as PaymentStatus)}
                                              disabled={!canEditFinance}
                                              className={`text-xs p-1 border-0 rounded-md appearance-none ${getPaymentStatusChip(cost.status)} disabled:bg-slate-100 dark:disabled:bg-gray-800`}
                                            >
                                               {Object.values(PaymentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={cost.oaSystemNumber || ''}
                                                onChange={(e) => handleCostItemUpdate(cost.id, 'oaSystemNumber', e.target.value)}
                                                disabled={!canEditFinance}
                                                placeholder="N/A"
                                                className="w-24 p-1 text-xs border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Documents */}
                <Section title="Documents" icon={<FileArchive size={22} className="text-brand-gray-500"/>}>
                    <ul className="space-y-2">
                        {localImport.documents.map(doc => (
                            <li key={doc.id} className="flex items-center justify-between text-sm p-2 bg-slate-100 dark:bg-brand-primary rounded-md">
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-brand-gray-500 dark:text-brand-gray-300 hover:underline">
                                    <FileText size={16} />
                                    {doc.name}
                                </a>
                                <span className="text-xs text-brand-gray-500 dark:text-gray-400">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                            </li>
                        ))}
                        {localImport.documents.length === 0 && <p className="text-sm text-brand-gray-500 dark:text-gray-400">No documents uploaded.</p>}
                    </ul>
                </Section>
    
                {/* Notifications */}
                <Section title="Notifications" icon={<BellDot size={22} className="text-brand-gray-500"/>}>
                    <p className="text-sm text-brand-gray-500 dark:text-gray-400 mb-2">Email alerts for major status changes will be sent to:</p>
                    <ul className="space-y-2 mb-4">
                        {localImport.notificationEmails.map(email => (
                            <li key={email} className="flex items-center justify-between text-sm p-2 bg-slate-100 dark:bg-brand-primary rounded-md">
                               <span className="text-brand-gray-500 dark:text-gray-200">{email}</span>
                                {canEditAnything && (
                                    <button onClick={() => handleRemoveEmail(email)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-4"><X size={14}/></button>
                                )}
                            </li>
                        ))}
                    </ul>
                     {canEditAnything && (
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                value={newEmail} 
                                onChange={(e) => setNewEmail(e.target.value)} 
                                placeholder="Add new email address" 
                                className="flex-grow p-2 text-sm border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200"
                            />
                            <button onClick={handleAddEmail} className="px-3 py-2 bg-brand-secondary text-white rounded-lg text-sm font-semibold hover:bg-brand-accent"><Plus size={16}/></button>
                        </div>
                     )}
                </Section>
            </div>
    
            {/* Observations */}
            <Section title="Observations & Notes" icon={<MessageSquare size={22} className="text-brand-gray-500"/>}>
                 <textarea 
                    value={localImport.observationNotes} 
                    onChange={handleObservationChange}
                    disabled={!canEditAnything}
                    rows={4}
                    className="w-full p-2 text-sm border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200 disabled:bg-slate-100 dark:disabled:bg-gray-800"
                />
            </Section>
        </div>
    );
    
};

export default ImportDetail;