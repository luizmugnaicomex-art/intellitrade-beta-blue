import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ImportProcess, Product, CostItem, CostCategory, Container, User, Currency } from '../types';
import { ImportStatus, ContainerStatus, PaymentStatus } from '../types';
import { geminiExtractDataFromDocument, geminiExtractItemDetails, geminiExtractContainerDetails, geminiSuggestNCM } from '../services/geminiService';
import { Save, Plus, Trash2, UploadCloud, Loader, AlertCircle, Ship, BrainCircuit, FileUp } from 'lucide-react';
import BulkProductModal from './BulkProductModal';

interface ImportFormProps {
    imports?: ImportProcess[];
    onSave: (importData: ImportProcess | Omit<ImportProcess, 'id'>) => Promise<any>;
    currentUser: User;
}

const ALL_COST_CATEGORIES: CostCategory[] = [ 'FOB', 'International Freight', 'Insurance', 'II', 'IPI', 'PIS/COFINS', 'ICMS', 'Broker Fees', 'Stevedoring', 'Warehousing', 'Port Fees', 'Domestic Transport', 'Bonded Warehouse', 'Demurrage' ];
const CURRENCIES: Currency[] = ['USD', 'BRL', 'EUR', 'CNY'];

const emptyImport: Omit<ImportProcess, 'id'> = {
    importNumber: '',
    supplier: '',
    responsibleBroker: '',
    poNumbers: '',
    blNumber: '',
    vesselName: '',
    voyageNumber: '',
    portOfLoading: '',
    portOfDischarge: '',
    diNumber: '',
    createdById: '',
    typeOfCargo: '',
    exTariff: 0,
    totalContainers: 1,
    demurrageFreeTimeDays: 45,
    incoterm: 'FOB',
    products: [{ id: `prod-${Date.now()}`, name: '', ncm: '', quantity: 1, unitValue: 0, itemNumber: '01' }],
    containers: [],
    observationNotes: '',
    notificationEmails: [],
    dates: {
        orderPlaced: new Date().toISOString().split('T')[0],
        estimatedShipment: '',
        estimatedArrival: '',
    },
    costs: [],
    trackingHistory: [{ stage: ImportStatus.OrderPlaced, date: new Date().toISOString() }],
    documents: [],
    dangerousGoods: '',
    importLicenseNumber: '',
    importLicenseStatus: '',
    freightForwarder: '',
    shipowner: '',
    additionalImportReference: '',
    pendingBrazilianNF: false,
    technicianResponsibleBrazil: '',
    technicianResponsibleChina: '',
    overallStatus: 'Order Placed',
    docsReceivedDate: new Date().toISOString().split('T')[0],
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & {label: string}> = ({label, ...props}) => (
    <div>
        <label className="block text-sm font-medium text-brand-gray-500 dark:text-gray-300 mb-1">{label}</label>
        <input {...props} className="block w-full px-3 py-2 bg-white dark:bg-brand-primary border border-gray-300 dark:border-brand-accent rounded-md shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800" />
    </div>
);
const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & {label: string}> = ({label, ...props}) => (
    <div className="flex items-center">
        <input {...props} type="checkbox" className="h-4 w-4 text-brand-accent border-gray-300 dark:border-brand-accent rounded focus:ring-brand-accent disabled:bg-gray-100 dark:disabled:bg-gray-800" />
        <label className="ml-2 block text-sm text-brand-gray-500 dark:text-gray-200">{label}</label>
    </div>
);

const ImportForm: React.FC<ImportFormProps> = ({ imports, onSave, currentUser }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isReadOnly = currentUser.role === 'View-Only';

    const [formData, setFormData] = useState<Omit<ImportProcess, 'id'>>(() => {
        const existingImport = id && imports ? imports.find(imp => imp.id === id) : null;
        if (existingImport) return { ...existingImport };
        
        const initialContainers = Array.from({ length: emptyImport.totalContainers }, (_, i) => ({
            id: `cont-${Date.now()}-${i}`,
            containerNumber: '',
            sealNumber: '',
            currentStatus: ContainerStatus.OnVessel,
            etaFactory: '',
            demurrageFreeDays: emptyImport.demurrageFreeTimeDays,
            log: [],
        }));
        return {...emptyImport, createdById: currentUser.id, containers: initialContainers};
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExtractingItems, setIsExtractingItems] = useState(false);
    const [isExtractingContainers, setIsExtractingContainers] = useState(false);
    const [isBulkProductModalOpen, setIsBulkProductModalOpen] = useState(false);
    const [bulkProductFileContent, setBulkProductFileContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkProductFileInputRef = useRef<HTMLInputElement>(null);
    const [analyzedDocument, setAnalyzedDocument] = useState<{base64: string; mimeType: string} | null>(null);
    const [ncmSuggestions, setNcmSuggestions] = useState<{ [key: string]: string }>({});
    const [ncmLoading, setNcmLoading] = useState<{ [key: string]: boolean }>({});


    const handleCostChange = (category: CostCategory, field: keyof Omit<CostItem, 'id' | 'category'>, value: any, isOtherCostIndex?: number) => {
        setFormData(prev => {
            const newCosts = [...prev.costs];
            let costIndex: number;

            if (category === 'Other' && isOtherCostIndex !== undefined) {
                 const otherCosts = newCosts.filter(c => c.category === 'Other');
                 const targetCostId = otherCosts[isOtherCostIndex]?.id;
                 costIndex = newCosts.findIndex(c => c.id === targetCostId);

            } else {
                 costIndex = newCosts.findIndex(c => c.category === category);
            }

            if (costIndex > -1) {
                (newCosts[costIndex] as any)[field] = value;
                 if (field === 'value' && !value && category === 'Other') {
                    return {...prev, costs: newCosts.filter((_, i) => i !== costIndex)};
                 }

            } else if (value) {
                newCosts.push({
                    id: `cost-${Date.now()}-${Math.random()}`,
                    category,
                    description: category === 'Other' ? '' : category,
                    status: PaymentStatus.PendingApproval,
                    value: 0,
                    currency: 'USD',
                    [field]: value
                });
            }
            return {...prev, costs: newCosts};
        });
    };

    useEffect(() => {
        const totalFob = formData.products.reduce((acc, p) => acc + (p.quantity * p.unitValue), 0);
        handleCostChange('FOB', 'value', totalFob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.products]);
    
     useEffect(() => {
        if (id) return; // Only adjust on new forms
        const currentCount = formData.containers.length;
        const targetCount = formData.totalContainers;
        if (currentCount < targetCount) {
            const newContainers: Container[] = Array.from({ length: targetCount - currentCount }, (_, i) => ({
                 id: `cont-${Date.now()}-${currentCount + i}`,
                 containerNumber: '',
                 sealNumber: '',
                 currentStatus: ContainerStatus.OnVessel,
                 demurrageFreeDays: formData.demurrageFreeTimeDays,
                 log: [],
                 etaFactory: formData.dates.estimatedArrival ? new Date(new Date(formData.dates.estimatedArrival).getTime() + 7 * 24*60*60*1000).toISOString().split('T')[0] : '',
            }));
            setFormData(prev => ({ ...prev, containers: [...prev.containers, ...newContainers] }));
        } else if (currentCount > targetCount) {
            setFormData(prev => ({ ...prev, containers: prev.containers.slice(0, targetCount) }));
        }
    }, [formData.totalContainers, id, formData.dates.estimatedArrival, formData.demurrageFreeTimeDays]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        if (name === 'notificationEmails') {
            setFormData(prev => ({ ...prev, [name]: value.split(',').map(e => e.trim()).filter(Boolean) }));
        } else {
             const finalValue = (name === 'totalContainers' || name === 'exTariff' || name === 'demurrageFreeTimeDays') ? parseInt(value) || 0 : isCheckbox ? checked : value;
             setFormData(prev => ({ ...prev, [name]: finalValue }));
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, dates: { ...prev.dates, [name]: value } }));
    };

    const handleProductChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newProducts = [...formData.products];
        const fieldType = e.target.type;

        if (fieldType === 'number') {
            (newProducts[index] as any)[name] = parseFloat(value) || 0;
        } else {
            (newProducts[index] as any)[name] = value;
        }
        setFormData(prev => ({ ...prev, products: newProducts }));
    };
    
    const handleContainerChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newContainers = [...formData.containers];
        const val = name === 'valueForInsurance' ? parseFloat(value) : value;
        (newContainers[index] as any)[name] = val;
        setFormData(prev => ({...prev, containers: newContainers}));
    }
    
    const handleNcmSuggestion = async (productId: string, description: string) => {
        if (!description) {
            setError('Please provide a product name to suggest an NCM code.');
            return;
        }
        setNcmLoading(prev => ({ ...prev, [productId]: true }));
        setError(null);
        try {
            const suggestion = await geminiSuggestNCM(description);
            setNcmSuggestions(prev => ({ ...prev, [productId]: suggestion }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get NCM suggestion.');
        } finally {
            setNcmLoading(prev => ({ ...prev, [productId]: false }));
        }
    };

    const applyNcmSuggestion = (productIndex: number, suggestion: string) => {
        const newProducts = [...formData.products];
        newProducts[productIndex].ncm = suggestion;
        setFormData(prev => ({ ...prev, products: newProducts }));
    };

    const addProduct = () => setFormData(prev => ({ ...prev, products: [...prev.products, { id: `prod-${Date.now()}`, name: '', ncm: '', quantity: 1, unitValue: 0, itemNumber: String(prev.products.length + 1).padStart(2, '0') }]}));
    const removeProduct = (index: number) => setFormData(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) }));
    
    const removeContainer = (index: number) => {
        setFormData(prev => {
            const newTotal = prev.totalContainers > 1 ? prev.totalContainers - 1 : 1;
            return {
                ...prev,
                containers: prev.containers.filter((_, i) => i !== index),
                totalContainers: newTotal
            };
        });
    };

    const addOtherCost = () => handleCostChange('Other', 'value', 0.01, formData.costs.filter(c => c.category === 'Other').length);


    const handleFileAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setError(null);

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const base64Image = (reader.result as string).split(',')[1];
                const mimeType = file.type;
                setAnalyzedDocument({ base64: base64Image, mimeType: mimeType });
                const extractedData = await geminiExtractDataFromDocument(base64Image, mimeType);
                
                setFormData(prev => ({
                    ...prev,
                    importNumber: extractedData.importNumber || prev.importNumber,
                    poNumbers: extractedData.poNumbers || prev.poNumbers,
                    blNumber: extractedData.blNumber || prev.blNumber,
                    supplier: extractedData.supplier || prev.supplier,
                    vesselName: extractedData.vesselName || prev.vesselName,
                    voyageNumber: extractedData.voyageNumber || prev.voyageNumber,
                    portOfLoading: extractedData.portOfLoading || prev.portOfLoading,
                    portOfDischarge: extractedData.portOfDischarge || prev.portOfDischarge,
                    incoterm: extractedData.incoterm || prev.incoterm,
                    dates: { ...prev.dates, orderPlaced: extractedData.dates?.orderPlaced || prev.dates.orderPlaced },
                }));
                 if (extractedData.fobValue) {
                    handleCostChange('FOB', 'value', extractedData.fobValue);
                }

            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
            } finally {
                setIsAnalyzing(false);
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
             setError("Failed to read the file.");
             setIsAnalyzing(false);
        }
    };

    const handleExtractItems = async () => {
        if (!analyzedDocument) {
            setError("Please upload and analyze a document first.");
            return;
        }

        setIsExtractingItems(true);
        setError(null);
        try {
            const items = await geminiExtractItemDetails(analyzedDocument.base64, analyzedDocument.mimeType);
            
            if (items && items.length > 0) {
                const newProducts: Product[] = items.map((item, index) => ({
                    id: `prod-${Date.now()}-${index}`,
                    itemNumber: String(index + 1).padStart(2, '0'),
                    name: item.name,
                    ncm: '',
                    quantity: item.quantity,
                    unitValue: item.unitValue,
                    vin: item.vin,
                    model: item.model,
                    color: item.color,
                    frontEngineNo: item.frontEngineNo,
                    engineDisplacement: item.engineDisplacement,
                    batterySerialNo: item.batterySerialNo
                }));
                setFormData(prev => ({ ...prev, products: newProducts }));
            } else {
                setError("Could not find any items in the document to extract.");
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during item extraction.');
        } finally {
            setIsExtractingItems(false);
        }
    };
    
    const handleBulkProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setBulkProductFileContent(event.target?.result as string);
            setIsBulkProductModalOpen(true);
        };
        reader.readAsText(file);
    };

    const handleConfirmBulkProducts = (newProducts: Product[]) => {
        setFormData(prev => ({...prev, products: [...prev.products, ...newProducts]}));
        setIsBulkProductModalOpen(false);
        setBulkProductFileContent(null);
    }

    const handleExtractContainers = async () => {
        if (!analyzedDocument) {
            setError("Please upload and analyze a document first.");
            return;
        }

        setIsExtractingContainers(true);
        setError(null);
        try {
            const containers = await geminiExtractContainerDetails(analyzedDocument.base64, analyzedDocument.mimeType);
            
            if (containers && containers.length > 0) {
                const newContainers: Container[] = containers.map((container, i) => ({
                    id: `cont-${Date.now()}-${i}`,
                    containerNumber: container.containerNumber,
                    sealNumber: container.sealNumber || '',
                    currentStatus: ContainerStatus.OnVessel,
                    log: [],
                    demurrageFreeDays: formData.demurrageFreeTimeDays,
                    etaFactory: formData.dates.estimatedArrival ? new Date(new Date(formData.dates.estimatedArrival).getTime() + 7 * 24*60*60*1000).toISOString().split('T')[0] : '',
                }));
                setFormData(prev => ({ ...prev, containers: newContainers, totalContainers: newContainers.length }));
            } else {
                setError("Could not find any container details in the document to extract.");
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during container extraction.');
        } finally {
            setIsExtractingContainers(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(isReadOnly) return;
        
        const dataToSave = id 
            ? { ...formData, id, costs: formData.costs.filter(c => c.value > 0) }
            : { ...formData, costs: formData.costs.filter(c => c.value > 0) };

        try {
            const savedData = await onSave(dataToSave);
            // The onSave prop now comes from App.tsx and returns a promise
            // that resolves with the created item (if new) or void (if updated).
            const finalId = id || savedData.id;
            if (finalId) {
                navigate(`/imports/${finalId}`);
            } else {
                navigate('/imports');
            }
        } catch (error) {
            console.error("Failed to save import:", error);
            setError("Failed to save import. Please try again.");
        }
    };
    
    const getCost = (category: CostCategory, index?: number): Partial<CostItem> => {
        if (category === 'Other' && index !== undefined) {
            return formData.costs.filter(c => c.category === 'Other')[index] || {};
        }
        return formData.costs.find(c => c.category === category) || {};
    }
    const getCostDescription = (index: number): string => {
        return formData.costs.filter(c => c.category === 'Other')[index]?.description || '';
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <input type="file" ref={bulkProductFileInputRef} onChange={handleBulkProductFileChange} className="hidden" accept=".csv" />
            <BulkProductModal 
                isOpen={isBulkProductModalOpen}
                onClose={() => setIsBulkProductModalOpen(false)}
                onConfirm={handleConfirmBulkProducts}
                fileContent={bulkProductFileContent}
            />
            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
                 <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-brand-gray-500 dark:text-white">{id ? 'Edit Import' : 'Register New Import'}</h2>
                    <div className="flex items-center gap-4">
                        <button type="submit" className="px-6 py-2 bg-brand-secondary text-white rounded-lg flex items-center gap-2 hover:bg-brand-accent disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" disabled={isReadOnly}>
                            <Save size={18} /> {id ? 'Save Changes' : 'Create Import'}
                        </button>
                         <div className="relative">
                             <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing || isReadOnly} className="flex items-center justify-center w-full sm:w-auto gap-2 bg-brand-highlight text-brand-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-wait">
                                {isAnalyzing ? <Loader size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                                {isAnalyzing ? 'Analyzing Document...' : 'Extract from Document'}
                             </button>
                             <input type="file" ref={fileInputRef} onChange={handleFileAnalyze} className="hidden" accept="image/*,application/pdf" />
                         </div>
                    </div>
                </div>
                {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4"><AlertCircle size={16} className="inline mr-1" />{error}</p>}
                
                <div className="border-t dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white mb-4">General Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Import Number" name="importNumber" value={formData.importNumber} onChange={handleChange} required disabled={isReadOnly} />
                        <Input label="Supplier" name="supplier" value={formData.supplier} onChange={handleChange} required disabled={isReadOnly} />
                        <Input label="Responsible Customs Broker" name="responsibleBroker" value={formData.responsibleBroker} onChange={handleChange} required disabled={isReadOnly} />
                        
                        <Input label="PO Number(s)" name="poNumbers" value={formData.poNumbers} onChange={handleChange} placeholder="e.g. PO-123, PO-456" disabled={isReadOnly} />
                        <Input label="BL Number" name="blNumber" value={formData.blNumber} onChange={handleChange} required disabled={isReadOnly} />
                        <Input label="Vessel Name" name="vesselName" value={formData.vesselName || ''} onChange={handleChange} placeholder="e.g. MSC GULSUN" disabled={isReadOnly} />

                        <Input label="Voyage Number" name="voyageNumber" value={formData.voyageNumber || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Port of Loading" name="portOfLoading" value={formData.portOfLoading || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Port of Discharge" name="portOfDischarge" value={formData.portOfDischarge || ''} onChange={handleChange} disabled={isReadOnly} />
                        
                        <Input label="DI Number" name="diNumber" value={formData.diNumber || ''} onChange={handleChange} placeholder="(Optional)" disabled={isReadOnly} />
                        <Input label="Type of Cargo" name="typeOfCargo" value={formData.typeOfCargo || ''} onChange={handleChange} placeholder="e.g. General Cargo, Bulk" disabled={isReadOnly} />

                        <div>
                            <label className="block text-sm font-medium text-brand-gray-500 dark:text-gray-300 mb-1">Incoterm</label>
                            <select name="incoterm" value={formData.incoterm} onChange={handleChange} className="block w-full px-3 py-2 bg-white dark:bg-brand-primary border border-gray-300 dark:border-brand-accent rounded-md shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800" disabled={isReadOnly}>
                                <option>FOB</option> <option>CIF</option> <option>EXW</option> <option>DDP</option>
                            </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                        <Input label="Total Containers" name="totalContainers" type="number" min="0" value={formData.totalContainers} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Order Placed Date" name="orderPlaced" type="date" value={formData.dates.orderPlaced} onChange={handleDateChange} required disabled={isReadOnly} />
                        <Input label="Estimated Shipment Date" name="estimatedShipment" type="date" value={formData.dates.estimatedShipment} onChange={handleDateChange} disabled={isReadOnly} />
                        <Input label="Estimated Arrival Date" name="estimatedArrival" type="date" value={formData.dates.estimatedArrival} onChange={handleDateChange} disabled={isReadOnly} />
                    </div>
                </div>
                
                <div className="border-t dark:border-gray-700 pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white mb-4">Additional Details</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Freight Forwarder" name="freightForwarder" value={formData.freightForwarder || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Shipowner" name="shipowner" value={formData.shipowner || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Dangerous Goods (DG)" name="dangerousGoods" value={formData.dangerousGoods || ''} onChange={handleChange} placeholder="e.g., Yes, Class 9" disabled={isReadOnly} />
                        
                        <Input label="Import License (LI) #" name="importLicenseNumber" value={formData.importLicenseNumber || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Import License (LI) Status" name="importLicenseStatus" value={formData.importLicenseStatus || ''} onChange={handleChange} placeholder="e.g., Approved" disabled={isReadOnly} />
                        <Input label="Additional Reference" name="additionalImportReference" value={formData.additionalImportReference || ''} onChange={handleChange} placeholder="Any other ref number" disabled={isReadOnly} />
                        <Input label="Technician Responsible (China)" name="technicianResponsibleChina" value={formData.technicianResponsibleChina || ''} onChange={handleChange} disabled={isReadOnly} />
                        <Input label="Technician Responsible (Brazil)" name="technicianResponsibleBrazil" value={formData.technicianResponsibleBrazil || ''} onChange={handleChange} disabled={isReadOnly} />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 items-end">
                     <Input label="Demurrage Free Days" name="demurrageFreeTimeDays" type="number" min="0" value={formData.demurrageFreeTimeDays} onChange={handleChange} disabled={isReadOnly} />
                     <Input label="EX Tariff Reduction (%)" name="exTariff" type="number" min="0" max="100" value={formData.exTariff} onChange={handleChange} disabled={isReadOnly} />
                    <div>
                        <Checkbox label="Pending Brazilian NF" name="pendingBrazilianNF" checked={!!formData.pendingBrazilianNF} onChange={handleChange} disabled={isReadOnly} />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white">Products</h3>
                     <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={() => bulkProductFileInputRef.current?.click()}
                            disabled={isReadOnly}
                            className="flex items-center justify-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-700 disabled:opacity-50"
                        >
                            <FileUp size={18} /> Add Items from File
                        </button>
                        <button 
                            type="button" 
                            onClick={handleExtractItems}
                            disabled={!analyzedDocument || isExtractingItems || isReadOnly}
                            className="flex items-center justify-center gap-2 bg-brand-gray-400 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-brand-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExtractingItems ? <Loader size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                            {isExtractingItems ? 'Extracting Items...' : 'Extract Items from Invoice'}
                        </button>
                     </div>
                </div>
                {formData.products.map((product, index) => (
                    <div key={product.id} className="grid grid-cols-12 gap-x-4 gap-y-2 mb-4 p-4 border dark:border-brand-accent rounded-lg">
                        <div className="col-span-12 font-semibold text-brand-gray-500 dark:text-gray-300">Item #{product.itemNumber || index + 1}</div>
                        <div className="col-span-12 md:col-span-6"><Input label="Product Name" name="name" value={product.name} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        
                        <div className="col-span-6 md:col-span-3">
                            <Input label="NCM Code" name="ncm" value={product.ncm} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} />
                            <div className="flex items-center justify-between mt-1 text-xs">
                                <button 
                                    type="button" 
                                    onClick={() => handleNcmSuggestion(product.id, product.name)}
                                    disabled={ncmLoading[product.id] || isReadOnly}
                                    className="text-brand-gray-500 dark:text-brand-gray-300 hover:underline disabled:text-gray-500 flex items-center gap-1"
                                >
                                    <BrainCircuit size={12} />
                                    {ncmLoading[product.id] ? 'Suggesting...' : 'AI Suggest'}
                                </button>
                                {ncmSuggestions[product.id] && (
                                    <span 
                                        className="text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer hover:underline" 
                                        title="Click to apply"
                                        onClick={() => !isReadOnly && applyNcmSuggestion(index, ncmSuggestions[product.id])}
                                    >
                                        {ncmSuggestions[product.id]}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="col-span-6 md:col-span-3"><Input label="Model" name="model" value={product.model || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        
                        <div className="col-span-6 md:col-span-2"><Input label="Quantity" name="quantity" type="number" value={product.quantity} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        <div className="col-span-6 md:col-span-2"><Input label="Unit Value (FOB)" name="unitValue" type="number" step="0.01" value={product.unitValue} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        <div className="col-span-12 md:col-span-4"><Input label="VIN" name="vin" value={product.vin || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        <div className="col-span-6 md:col-span-2"><Input label="Color" name="color" value={product.color || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        
                        <div className="col-span-12 md:col-span-4"><Input label="Front Engine No." name="frontEngineNo" value={product.frontEngineNo || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        <div className="col-span-12 md:col-span-4"><Input label="Battery Serial No." name="batterySerialNo" value={product.batterySerialNo || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>
                        <div className="col-span-6 md:col-span-3"><Input label="Engine Displacement" name="engineDisplacement" value={product.engineDisplacement || ''} onChange={e => handleProductChange(index, e)} disabled={isReadOnly} /></div>

                        <div className="col-span-12 flex justify-end">
                            <button type="button" onClick={() => removeProduct(index)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md flex items-center justify-center disabled:text-gray-400 dark:disabled:text-gray-600" disabled={isReadOnly || formData.products.length <= 1}>
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={addProduct} className="flex items-center gap-2 text-brand-gray-500 dark:text-brand-gray-300 font-medium hover:underline disabled:text-gray-500 dark:disabled:text-gray-600" disabled={isReadOnly}>
                    <Plus size={18} /> Add Product
                </button>
            </div>
            
            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white flex items-center gap-2"><Ship size={20} /> Container Details</h3>
                    <button 
                        type="button" 
                        onClick={handleExtractContainers}
                        disabled={!analyzedDocument || isExtractingContainers || isReadOnly}
                        className="flex items-center justify-center gap-2 bg-brand-gray-400 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-brand-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExtractingContainers ? <Loader size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                        {isExtractingContainers ? 'Extracting Containers...' : 'Extract Containers from BL'}
                    </button>
                </div>
                {formData.containers.map((container, index) => (
                    <div key={container.id} className="flex items-center gap-2 mb-2">
                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border dark:border-brand-accent rounded-lg">
                            <Input label={`Container #${index + 1} Number`} name="containerNumber" value={container.containerNumber} onChange={e => handleContainerChange(index, e)} disabled={isReadOnly} />
                            <Input label="Seal Number" name="sealNumber" value={container.sealNumber || ''} onChange={e => handleContainerChange(index, e)} placeholder="(Optional)" disabled={isReadOnly} />
                            <Input label="Value for Insurance" name="valueForInsurance" type="number" value={container.valueForInsurance || ''} onChange={e => handleContainerChange(index, e)} placeholder="e.g. 150000" disabled={isReadOnly} />
                            <Input label="ETA at Factory" name="etaFactory" type="date" value={container.etaFactory} onChange={e => handleContainerChange(index, e)} disabled={isReadOnly} />
                        </div>
                         <button
                            type="button"
                            onClick={() => removeContainer(index)}
                            className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md flex items-center justify-center disabled:text-gray-400 dark:disabled:text-gray-600 self-center"
                            disabled={isReadOnly || formData.containers.length <= 1}
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-brand-gray-500 dark:text-white mb-4">Costs</h3>
                <div className="space-y-4">
                    <div className="p-4 border dark:border-brand-accent rounded-lg">
                        <h4 className="font-medium text-brand-gray-500 dark:text-gray-200 mb-2">Standard Costs</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {ALL_COST_CATEGORIES.map(cat => (
                                <div key={cat} className="flex gap-2 items-end">
                                    <div className="flex-grow">
                                        <label className="block text-sm font-medium text-brand-gray-500 dark:text-gray-300 mb-1">{cat}</label>
                                        <input type="number" step="0.01" value={getCost(cat).value || ''} onChange={e => handleCostChange(cat, 'value', parseFloat(e.target.value) || 0)} disabled={isReadOnly || cat === 'FOB'} className="block w-full px-3 py-2 bg-white dark:bg-brand-primary border border-gray-300 dark:border-brand-accent rounded-md shadow-sm sm:text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                    </div>
                                    <select value={getCost(cat).currency || 'USD'} onChange={e => handleCostChange(cat, 'currency', e.target.value as Currency)} disabled={isReadOnly || cat === 'FOB'} className="w-20 h-[42px] px-2 py-2 bg-white dark:bg-brand-primary border border-gray-300 dark:border-brand-accent rounded-md shadow-sm sm:text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="p-4 border dark:border-brand-accent rounded-lg">
                        <h4 className="font-medium text-brand-gray-500 dark:text-gray-200 mb-2">Other Costs</h4>
                        {formData.costs.filter(c => c.category === 'Other').map((cost, index) => (
                             <div key={cost.id} className="grid grid-cols-12 gap-4 items-end mb-2">
                                <div className="col-span-12 sm:col-span-5"><Input label="Description" value={getCostDescription(index)} onChange={e => handleCostChange('Other', 'description', e.target.value, index)} disabled={isReadOnly} /></div>
                                <div className="col-span-6 sm:col-span-3"><Input label="Value" type="number" step="0.01" value={getCost('Other', index).value || ''} onChange={e => handleCostChange('Other', 'value', parseFloat(e.target.value) || 0, index)} disabled={isReadOnly} /></div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-brand-gray-500 dark:text-gray-300 mb-1">Currency</label>
                                    <select value={getCost('Other', index).currency || 'USD'} onChange={e => handleCostChange('Other', 'currency', e.target.value as Currency, index)} disabled={isReadOnly} className="w-full h-[42px] px-2 py-2 bg-white dark:bg-brand-primary border border-gray-300 dark:border-brand-accent rounded-md shadow-sm sm:text-sm text-brand-gray-500 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-12 sm:col-span-2">
                                     <button type="button" onClick={() => handleCostChange('Other', 'value', 0, index)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md w-full h-[42px] flex items-center justify-center disabled:text-gray-400 dark:disabled:text-gray-600" disabled={isReadOnly}>
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addOtherCost} className="mt-2 flex items-center gap-2 text-brand-gray-500 dark:text-brand-gray-300 font-medium hover:underline disabled:text-gray-500 dark:disabled:text-gray-600" disabled={isReadOnly}>
                            <Plus size={18} /> Add Other Cost
                        </button>
                     </div>
                </div>
            </div>
            
             <div className="flex justify-end gap-4">
                <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-brand-gray-300 dark:border-gray-600 rounded-lg text-brand-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-brand-accent">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-brand-secondary text-white rounded-lg flex items-center gap-2 hover:bg-brand-accent disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" disabled={isReadOnly}>
                    <Save size={18} /> {id ? 'Save Changes' : 'Create Import'}
                </button>
            </div>
        </form>
    );
}

export default ImportForm;