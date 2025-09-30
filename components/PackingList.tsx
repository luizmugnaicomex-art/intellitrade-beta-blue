

import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { ImportProcess, Document, Container, Product } from '../types';
import { Link } from 'react-router-dom';
import { UploadCloud, FileText, Trash2, Search, X, FileDown, Database, List, Edit, Save, PlusCircle, AlertTriangle, Printer, Filter } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const downloadCSV = (data: (string | number)[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + data.map(e => e.map(i => `"${String(i).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const DataField: React.FC<{ label: string, value: React.ReactNode, isEditing?: boolean, onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, name?: string, type?: string, as?: 'input' | 'textarea'}> = ({ label, value, isEditing, onChange, name, type = 'text', as = 'input' }) => {
    const InputComponent = as;
    return (
        <div className="bg-gray-50 dark:bg-brand-primary p-3 rounded-lg print:border print:border-gray-300 print:bg-white print:p-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 print:text-gray-600">{label}</p>
            {isEditing ? (
                 <InputComponent 
                    name={name}
                    value={String(value || '')}
                    onChange={onChange}
                    type={type}
                    className="w-full bg-white dark:bg-gray-800 p-1 text-sm border-gray-300 dark:border-gray-600 rounded-md" 
                />
            ) : (
                <p className="font-semibold text-brand-secondary dark:text-gray-200 truncate print:text-black print:text-sm">{String(value || 'N/A')}</p>
            )}
        </div>
    );
};


const RomaneioModal: React.FC<{
    imp: ImportProcess,
    container: Container,
    onClose: () => void,
    onUpdateImport: (imp: ImportProcess) => void,
    companyLogo: string | null;
}> = ({ imp, container, onClose, onUpdateImport, companyLogo }) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editableImp, setEditableImp] = useState(() => JSON.parse(JSON.stringify(imp)));

    const editableContainer = useMemo(() => {
        return editableImp.containers.find((c: Container) => c.id === container.id);
    }, [editableImp, container.id]);

    const totalCIF = useMemo(() => {
        const fob = editableImp.costs.find((c: any) => c.category === 'FOB')?.value || 0;
        const freight = editableImp.costs.find((c: any) => c.category === 'International Freight')?.value || 0;
        const insurance = editableImp.costs.find((c: any) => c.category === 'Insurance')?.value || 0;
        return fob + freight + insurance;
    }, [editableImp.costs]);

    const { summaryData, transportData, itemData, summaryCSV, itemsCSV } = useMemo(() => {
        const currentContainer = editableContainer;
        if (!currentContainer) return { summaryData: {}, transportData: {}, itemData: [], summaryCSV: [], itemsCSV: []};

        const totalNetWeight = editableImp.products.reduce((sum: number, p: Product) => sum + (p.netWeight || 0) * p.quantity, 0);
        const totalGrossWeight = editableImp.products.reduce((sum: number, p: Product) => sum + (p.grossWeight || 0) * p.quantity, 0);
        const totalCBM = editableImp.products.reduce((sum: number, p: Product) => sum + (p.cbm || 0) * p.quantity, 0);
        const totalPackages = editableImp.products.reduce((sum: number, p: Product) => sum + p.quantity, 0);
        const uniqueNCMs = [...new Set(editableImp.products.map((p: Product) => p.ncm).filter(Boolean))].join(', ');
        
        const summaryData = {
            'BL Nº': editableImp.blNumber, Fatura: editableImp.importNumber, 'PO Nº': editableImp.poNumbers,
            'Container Nº': currentContainer.containerNumber, 'Selo Nº': currentContainer.sealNumber, NCM: uniqueNCMs,
            'Peso Líquido Total': `${totalNetWeight.toFixed(2)} KG`, 'Peso Bruto Total': `${totalGrossWeight.toFixed(2)} KG`, 'M³ Total': totalCBM.toFixed(3),
            'Volume Total': totalPackages, 'Total CIF': `$${totalCIF.toFixed(2)}`
        };

        const transportData = {
            'Transportadora': currentContainer.localCarrier, 'Placa Carreta': currentContainer.trailerPlate, 'Placa Cavalo': currentContainer.tractorPlate,
            'Data Carregamento': currentContainer.localLoadingDate, 'Tipo Veículo': currentContainer.vehicleType, 'Nome Condutor': currentContainer.driverName,
            'CPF Condutor': currentContainer.driverCpf, 'Previsão Chegada': currentContainer.estimatedLocalArrival, 'Local Descarga': currentContainer.finalDischargePlace
        };

        const itemData = editableImp.products.map((p: Product, index: number) => {
            const itemNetWeight = (p.netWeight || 0) * p.quantity;
            const itemGrossWeight = (p.grossWeight || 0) * p.quantity;
            const itemCBM = (p.cbm || 0) * p.quantity;
            return {
                id: p.id, number: p.itemNumber || index + 1, name: p.name, quantity: p.quantity, unit: 'PC',
                netWeight: itemNetWeight, grossWeight: itemGrossWeight, 'M³': itemCBM, volume: p.quantity
            };
        });

        const summaryCSVHeader = ['ROMANEIO','BL','FATURA','PO','CONTAINER','SELO','NCM','PESO LIQUIDO','PESO BRUTO','M3','VOLUME', 'Total CIF', ...Object.keys(transportData)];
        const summaryCSVData = [summaryCSVHeader, [
            editableImp.blNumber, editableImp.blNumber, editableImp.importNumber, editableImp.poNumbers,
            currentContainer.containerNumber, currentContainer.sealNumber || '', uniqueNCMs, totalNetWeight,
            totalGrossWeight, totalCBM, totalPackages, totalCIF, ...Object.values(transportData)
        ]];

        const itemsCSVHeader = ['Nº', 'PARTE', 'QUANTIDADE', 'UNID.', 'PESO LÍQUIDO', 'PESO BRUTO', 'M³', 'VOLUME'];
        const itemsCSVData = [itemsCSVHeader, ...itemData.map(i => [i.number, i.name, i.quantity, i.unit, i.netWeight.toFixed(2), i.grossWeight.toFixed(2), i['M³'].toFixed(3), i.volume])];

        return { summaryData, transportData, itemData, summaryCSV: summaryCSVData, itemsCSV: itemsCSVData };
    }, [editableImp, editableContainer, totalCIF]);

    const handleDownload = () => {
        downloadCSV(summaryCSV, `ROMANEIO - ${imp.blNumber} - Dados.csv`);
        downloadCSV(itemsCSV, `ROMANEIO - ${imp.blNumber} - ${container.containerNumber}.csv`);
    };
    
    const handlePrint = () => {
        const element = document.getElementById(`romaneio-modal-content-${container.id}`);
        if (!element) return;
        const options = {
            margin:       0.2,
            filename:     `ROMANEIO_${imp.blNumber}_${container.containerNumber}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        // Use html2pdf to generate a PDF and open it in a new tab for printing
        html2pdf().from(element).set(options).toPdf().get('pdf').then((pdf: any) => {
            window.open(pdf.output('bloburl'), '_blank');
        });
    };

    const handleSaveChanges = () => {
        onUpdateImport(editableImp);
        onClose();
    };

    const handleContainerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableImp((prev: ImportProcess) => ({
            ...prev,
            containers: prev.containers.map(c => c.id === container.id ? {...c, [name]: value} : c)
        }));
    };

    const handleItemChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableImp((prev: ImportProcess) => ({
            ...prev,
            products: prev.products.map(p => p.id === id ? {...p, [name]: (name === 'quantity' || name === 'unitValue' || name === 'netWeight' || name === 'grossWeight' || name === 'cbm' ? parseFloat(value) : value)} : p)
        }));
    };
    
    const addItem = () => {
        const newItem: Product = { id: `prod-${Date.now()}`, name: '', ncm: '', quantity: 1, unitValue: 0, netWeight: 0, grossWeight: 0, cbm: 0 };
        setEditableImp((prev: ImportProcess) => ({ ...prev, products: [...prev.products, newItem] }));
    };

    const removeItem = (id: string) => {
        setEditableImp((prev: ImportProcess) => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
    };
    
    const modalContentId = `romaneio-modal-content-${container.id}`;

    const transportFieldMap: Record<string, keyof Container> = {
        'Transportadora': 'localCarrier', 'Placa Carreta': 'trailerPlate', 'Placa Cavalo': 'tractorPlate',
        'Data Carregamento': 'localLoadingDate', 'Tipo Veículo': 'vehicleType', 'Nome Condutor': 'driverName',
        'CPF Condutor': 'driverCpf', 'Previsão Chegada': 'estimatedLocalArrival', 'Local Descarga': 'finalDischargePlace'
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center p-4 animate-fade-in-down print:hidden" onClick={onClose}>
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #${modalContentId}, #${modalContentId} * {
                        visibility: visible;
                    }
                    #${modalContentId} {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: auto;
                        padding: 20px;
                        margin: 0;
                        border: none;
                        font-size: 12px;
                        color: #000;
                    }
                }
                `}
            </style>
            <div className="bg-white dark:bg-brand-secondary rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col print:shadow-none print:max-h-full print:dark:bg-white" onClick={e => e.stopPropagation()}>
                 <div id={modalContentId} className="flex-grow overflow-y-auto">
                    <div className="p-6 space-y-6 print:p-0 print:overflow-visible">
                        <div className="flex justify-between items-center print:border-b-2 print:border-black print:p-0 print:mb-4">
                            <div className="flex items-center gap-4">
                                {companyLogo && <img src={companyLogo} alt="Company Logo" className="h-12 print:h-16" />}
                                <div>
                                    <h2 className="text-lg font-bold text-brand-primary dark:text-white print:text-xl print:text-black">Romaneio for Container: {container.containerNumber}</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 print:text-sm print:text-gray-700">Import: {imp.importNumber}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 print:hidden">
                                <button onClick={() => setIsEditing(!isEditing)} className="flex items-center gap-2 bg-gray-200 dark:bg-brand-primary text-brand-primary dark:text-gray-200 px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-80">
                                    {isEditing ? <X size={16}/> : <Edit size={16} />} {isEditing ? 'Cancel Edit' : 'Adjust Romaneio'}
                                </button>
                                <button onClick={onClose} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-accent">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        {/* Header */}
                        <div>
                            <h3 className="text-base font-semibold text-brand-primary dark:text-white mb-2 flex items-center gap-2 print:text-lg print:text-black print:border-t-2 print:border-b-2 print:border-black print:py-1"><Database size={18}/> Shipment Data</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-4">
                                {Object.entries(summaryData).map(([key, val]) => <DataField key={key} label={key} value={val} />)}
                            </div>
                        </div>
                        {/* Transport */}
                        <div>
                            <h3 className="text-base font-semibold text-brand-primary dark:text-white mb-2 flex items-center gap-2 print:text-lg print:text-black print:border-t-2 print:border-b-2 print:border-black print:py-1"><Database size={18}/> Local Transport & Discharge</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-4">
                            {Object.entries(transportData).map(([key, val]) => {
                                const fieldName = transportFieldMap[key];
                                const fieldType = (key.toLowerCase().includes('data') || key.toLowerCase().includes('previsão')) ? 'date' : 'text';
                                return (
                                    <DataField 
                                        key={key} 
                                        label={key} 
                                        value={val} 
                                        name={fieldName}
                                        isEditing={isEditing} 
                                        onChange={handleContainerChange} 
                                        type={fieldType}
                                    />
                                );
                            })}
                            </div>
                        </div>
                        {/* Items */}
                        <div>
                            <h3 className="text-base font-semibold text-brand-primary dark:text-white mb-2 flex items-center gap-2 print:text-lg print:text-black print:border-t-2 print:border-b-2 print:border-black print:py-1"><List size={18}/> Item Details</h3>
                            <div className="overflow-x-auto border dark:border-gray-700 rounded-lg print:border-none">
                                <table className="w-full text-left text-xs print:text-base">
                                    <thead className="bg-gray-100 dark:bg-brand-primary print:bg-gray-200">
                                        <tr>
                                            {['Nº', 'PARTE/DESCRIÇÃO', 'QTD', 'UNID.', 'PESO LÍQUIDO', 'PESO BRUTO', 'M³'].map(h => <th key={h} className="p-2 font-semibold text-gray-700 dark:text-gray-300 print:text-black">{h}</th>)}
                                            {isEditing && <th className="p-2 print:hidden"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700 print:divide-y print:divide-gray-400">
                                        {itemData.map(item => (
                                            <tr key={item.id}>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{item.number}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-200 print:text-black">{isEditing ? <input name="name" value={item.name} onChange={e => handleItemChange(item.id, e)} className="w-full bg-white dark:bg-gray-800 p-1 text-xs border-gray-300 dark:border-gray-600 rounded-md" /> : item.name}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{isEditing ? <input name="quantity" type="number" value={item.quantity} onChange={e => handleItemChange(item.id, e)} className="w-20 bg-white dark:bg-gray-800 p-1 text-xs border-gray-300 dark:border-gray-600 rounded-md" /> : item.quantity}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{item.unit}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{isEditing ? <input name="netWeight" type="number" step="0.01" value={(item.netWeight / item.quantity) || 0} onChange={e => handleItemChange(item.id, e)} className="w-20 bg-white dark:bg-gray-800 p-1 text-xs border-gray-300 dark:border-gray-600 rounded-md" /> : item.netWeight.toFixed(2)}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{isEditing ? <input name="grossWeight" type="number" step="0.01" value={(item.grossWeight / item.quantity) || 0} onChange={e => handleItemChange(item.id, e)} className="w-20 bg-white dark:bg-gray-800 p-1 text-xs border-gray-300 dark:border-gray-600 rounded-md" /> : item.grossWeight.toFixed(2)}</td>
                                                <td className="p-2 text-gray-800 dark:text-gray-300 print:text-black">{isEditing ? <input name="cbm" type="number" step="0.001" value={(item['M³'] / item.quantity) || 0} onChange={e => handleItemChange(item.id, e)} className="w-20 bg-white dark:bg-gray-800 p-1 text-xs border-gray-300 dark:border-gray-600 rounded-md" /> : item['M³'].toFixed(3)}</td>
                                                {isEditing && <td className="print:hidden"><button onClick={() => removeItem(item.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={14} /></button></td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {isEditing && <button onClick={addItem} className="m-2 flex items-center gap-2 text-sm text-sky-600 font-semibold print:hidden"><PlusCircle size={16}/> Add Item</button>}
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 p-3 rounded-lg flex items-center gap-2 print:hidden">
                            <AlertTriangle size={24} />
                            Note: Editing items here modifies the product list for the entire import process ({imp.importNumber}), not just for this container's Romaneio.
                        </div>
                    </div>
                 </div>
                <div className="p-4 bg-gray-50 dark:bg-brand-primary/50 border-t dark:border-gray-700 mt-auto flex justify-end items-center gap-4 print:hidden">
                     {isEditing && (
                        <button onClick={handleSaveChanges} className="flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-sky-700">
                            <Save size={18} /> Save Changes
                        </button>
                     )}
                    <button onClick={handleDownload} className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700">
                        <FileDown size={18} /> Download CSVs
                    </button>
                    <button onClick={handlePrint} className="flex items-center justify-center gap-2 bg-brand-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-secondary">
                        <Printer size={18} /> Print / PDF
                    </button>
                </div>
            </div>
        </div>
    )
}

interface PackingListProps {
    imports: ImportProcess[];
    updateImport: (imp: ImportProcess) => void;
    companyLogo: string | null;
    globalDate: string;
}

const PackingList: React.FC<PackingListProps> = ({ imports, updateImport, companyLogo, globalDate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'packingList' | 'romaneio'>('packingList');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
    const [romaneioModalData, setRomaneioModalData] = useState<{imp: ImportProcess, container: Container} | null>(null);

    const filteredImports = useMemo(() => imports.filter(imp => {
        const searchMatch = 
            imp.importNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            imp.blNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            imp.poNumbers.toLowerCase().includes(searchTerm.toLowerCase()) ||
            imp.containers.some(c => c.containerNumber.toLowerCase().includes(searchTerm.toLowerCase()));

        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        const endDate = dateRange.end ? new Date(dateRange.end) : null;
            
        if(startDate) startDate.setHours(0,0,0,0);
        if(endDate) endDate.setHours(23,59,59,999);

        const arrivalDate = new Date(imp.dates.estimatedArrival || 0);
        const dateMatch = (!startDate || arrivalDate >= startDate) && (!endDate || arrivalDate <= endDate);
            
        return searchMatch && dateMatch;
    }), [imports, searchTerm, dateRange]);
    
    const allContainers = useMemo(() => {
        return filteredImports.flatMap(imp => imp.containers.map(c => ({...c, import: imp})))
    }, [filteredImports])


    const handleFileSelect = (importId: string) => {
        setSelectedImportId(importId);
        fileInputRef.current?.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !selectedImportId) {
            return;
        }
        const file = e.target.files[0];
        const targetImport = imports.find(imp => imp.id === selectedImportId);
        if (!targetImport) return;

        const newDocument: Document = {
            id: `doc-pl-${Date.now()}`,
            name: file.name,
            type: 'Packing List',
            uploadDate: new Date().toISOString(),
            fileUrl: '#' // In a real app, this would be the URL after upload
        };
        
        const updatedImport = {
            ...targetImport,
            documents: [...targetImport.documents, newDocument]
        };

        updateImport(updatedImport);
        setSelectedImportId(null);
    };
    
    const handleDelete = (importId: string, docId: string) => {
         const targetImport = imports.find(imp => imp.id === importId);
         if (!targetImport) return;
         
         if(window.confirm(`Are you sure you want to delete the packing list "${targetImport.documents.find(d => d.id === docId)?.name}"?`)) {
            const updatedDocuments = targetImport.documents.filter(doc => doc.id !== docId);
            updateImport({...targetImport, documents: updatedDocuments});
         }
    }

    const renderPackingListView = () => (
         <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-left">
                <thead className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-brand-accent/20 sticky top-0">
                    <tr>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Import #</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">BL #</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Packing Lists</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                    {filteredImports.length > 0 ? filteredImports.map(imp => {
                        const packingLists = imp.documents.filter(doc => doc.type === 'Packing List');
                        return (
                            <tr key={imp.id} className="hover:bg-gray-50 dark:hover:bg-brand-primary">
                                <td className="p-3 font-medium text-brand-secondary dark:text-gray-200">
                                    <Link to={`/imports/${imp.id}`} className="hover:underline text-sky-600 dark:text-sky-400">{imp.importNumber}</Link>
                                </td>
                                <td className="p-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{imp.blNumber}</td>
                                <td className="p-3">
                                    {packingLists.length > 0 ? (
                                        <ul className="space-y-2">
                                            {packingLists.map(doc => (
                                                <li key={doc.id} className="flex items-center justify-between text-sm p-2 bg-gray-100 dark:bg-brand-primary rounded-md">
                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sky-700 dark:text-sky-400 hover:underline">
                                                        <FileText size={16} />
                                                        {doc.name}
                                                    </a>
                                                     <button onClick={() => handleDelete(imp.id, doc.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-4"><Trash2 size={14}/></button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-500 text-sm">No packing list uploaded.</p>
                                    )}
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => handleFileSelect(imp.id)}
                                        className="flex items-center gap-2 bg-brand-secondary text-white px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-brand-accent mx-auto"
                                    >
                                        <UploadCloud size={16} /> Upload
                                    </button>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr>
                            <td colSpan={4} className="text-center p-8 text-gray-500 dark:text-gray-400">No imports match your search.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
    
    const renderRomaneioView = () => (
         <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-left">
                <thead className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-brand-accent/20 sticky top-0">
                    <tr>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Import #</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">BL #</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Container #</th>
                        <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">Actions</th>
                    </tr>
                </thead>
                 <tbody className="divide-y dark:divide-gray-700">
                    {allContainers.length > 0 ? allContainers.map(container => (
                         <tr key={container.id} className="hover:bg-gray-50 dark:hover:bg-brand-primary">
                            <td className="p-3 font-medium text-brand-secondary dark:text-gray-200">
                                <Link to={`/imports/${container.import.id}`} className="hover:underline text-sky-600 dark:text-sky-400">{container.import.importNumber}</Link>
                            </td>
                            <td className="p-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{container.import.blNumber}</td>
                            <td className="p-3 font-medium text-brand-secondary dark:text-gray-200">{container.containerNumber}</td>
                            <td className="p-3 text-center">
                                <button 
                                    onClick={() => setRomaneioModalData({imp: container.import, container: container})}
                                    className="flex items-center gap-2 bg-brand-secondary text-white px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-brand-accent mx-auto"
                                >
                                    Generate Romaneio
                                </button>
                            </td>
                        </tr>
                    )) : (
                         <tr>
                            <td colSpan={4} className="text-center p-8 text-gray-500 dark:text-gray-400">No containers found for Romaneio generation.</td>
                        </tr>
                    )}
                 </tbody>
            </table>
        </div>
    );

    return (
        <>
        {romaneioModalData && <RomaneioModal imp={romaneioModalData.imp} container={romaneioModalData.container} onClose={() => setRomaneioModalData(null)} onUpdateImport={updateImport} companyLogo={companyLogo} />}
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-brand-primary dark:text-white">Packing List & Romaneio Management</h2>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Import#, BL#, Container#..."
                        className="w-full md:w-72 pl-10 pr-4 py-2 border dark:border-brand-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent bg-transparent dark:text-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('packingList')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'packingList' ? 'border-brand-highlight text-brand-primary dark:text-brand-highlight' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Packing Lists
                    </button>
                    <button
                        onClick={() => setActiveTab('romaneio')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'romaneio' ? 'border-brand-highlight text-brand-primary dark:text-brand-highlight' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Romaneio Automation
                    </button>
                </nav>
            </div>
            
             <div className="mb-4 p-3 bg-gray-50 dark:bg-brand-primary/50 rounded-lg flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Arrival between:</span>
                 <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <span>and</span>
                 <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <button onClick={() => setDateRange({start: '', end: ''})} className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" title="Clear dates">
                    <X size={16} />
                </button>
             </div>
            
            <div>
                {activeTab === 'packingList' ? renderPackingListView() : renderRomaneioView()}
            </div>
        </div>
        </>
    );
};

export default PackingList;