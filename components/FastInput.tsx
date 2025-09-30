import React, { useState, useEffect, useMemo } from 'react';
import type { ImportProcess, User, DIChannel, Container } from '../types';
import { ImportStatus, ContainerStatus } from '../types';
import { FileUp, CheckCircle, AlertCircle, Loader, ShieldCheck, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface FastInputProps {
    onConfirm: (imports: Omit<ImportProcess, 'id'>[]) => void;
    currentUser: User;
}

type ValidatedRecord = {
    data: Partial<ImportProcess>;
    errors: string[];
    isValid: boolean;
    originalRow: Record<string, string>;
};

const parseCSV = (csvText: string): Record<string, string>[] => {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
        if (char === '"' && !inQuotes) {
            inQuotes = true;
        } else if (char === '"' && inQuotes) {
            inQuotes = false;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values.map(v => v.trim().replace(/^"|"$/g, ''));
  };
  
  const headers = parseLine(lines[0]);
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length >= headers.length) { 
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/"/g, '').trim();
        if(cleanHeader) {
            obj[cleanHeader] = values[index] || '';
        }
      });
      result.push(obj);
    }
  }
  return result;
};


const HEADER_MAPPING: Record<string, keyof ImportProcess> = {
    'processo': 'importNumber',
    'bl': 'blNumber',
    'invoice': 'additionalImportReference',
    'po sap': 'poNumbers',
    'unique di': 'diNumber',
    'status': 'overallStatus',
    'shipper': 'supplier',
    'broker': 'responsibleBroker',
    'freight forwader destination': 'freightForwarder',
    'shipowner': 'shipowner',
    'type of cargo': 'typeOfCargo',
    'cntr qty': 'totalContainers',
    'dg': 'dangerousGoods',
    'li': 'importLicenseNumber',
    'ex tariff': 'exTariff',
    'technician responsible in china': 'technicianResponsibleChina',
    'technician responsible brazil': 'technicianResponsibleBrazil',
    'departure vessel date': 'departureVesselDate',
    'arrival vessel date': 'arrivalVesselDate',
    'actual etd': 'actualETD',
    'actual eta': 'actualETA',
    'di registration date': 'diRegistrationDate',
    'parametrization': 'diChannel',
    'green channel date': 'greenChannelDate',
    'cargo presence date': 'cargoPresenceDate',
    'storage deadline': 'storageDeadline',
    'doc approval date': 'docApprovalDate',
    'nf issue date': 'nfIssueDate',
    'docs received date': 'docsReceivedDate',
    'observation': 'observationNotes',
    'kpi docs': 'kpiDocs',
    'kpi po sap': 'kpiPoSap',
    'kpi customs clearance': 'kpiCustomsClearance',
    'kpi ci x last delivery': 'kpiCiLastDelivery',
    'kpi ci x first delivery': 'kpiCiFirstDelivery',
    'kpi operation 2024': 'kpiOperation2024',
    'kpi operation 2025': 'kpiOperation2025',
    'kpi nf2': 'kpiNf2',
    'goal clearance': 'goalClearance',
    'goal delivery': 'goalDelivery',
    'goal operation': 'goalOperation',
    'goal nf': 'goalNf',
};


const FastInput: React.FC<FastInputProps> = ({ onConfirm, currentUser }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidatedRecord[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const robustParseDate = (dateStr: string): string => {
        if (!dateStr || dateStr.trim().length < 8) return '';
        try {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;

                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    const d = new Date(Date.UTC(year, month - 1, day));
                    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
                        return d.toISOString().split('T')[0];
                    }
                }
            }
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            return '';
        } catch {
            return '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setFileContent(content);
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        if (!fileContent) {
            setValidationResult([]);
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            const parsed = parseCSV(fileContent);
            const validated = parsed.map((row): ValidatedRecord => {
                const newImport: Partial<ImportProcess> = { dates: {} };
                const errors: string[] = [];
                
                for (const rawHeader in row) {
                    const key = rawHeader.toLowerCase().trim();
                    const mappedKey = HEADER_MAPPING[key];
                    let value: any = row[rawHeader];

                    if (mappedKey && value) {
                        const isDateField = mappedKey.toLowerCase().includes('date');
                        const isKPIField = mappedKey.toLowerCase().startsWith('kpi') || mappedKey.toLowerCase().startsWith('goal');
                        
                        if (isDateField) {
                            value = robustParseDate(value);
                        } else if (isKPIField || mappedKey === 'exTariff' || mappedKey === 'totalContainers') {
                            value = parseFloat(value.replace(',', '.'));
                            if (isNaN(value)) value = undefined;
                        } else if (mappedKey === 'diChannel') {
                            const chan = value.toLowerCase();
                            if (chan.includes('green')) value = 'Green';
                            else if (chan.includes('yellow')) value = 'Yellow';
                            else if (chan.includes('red')) value = 'Red';
                            else if (chan.includes('gray')) value = 'Gray';
                            else value = undefined;
                        }
                        (newImport as any)[mappedKey] = value;
                    }
                }
                
                if (newImport.departureVesselDate && !newImport.dates?.estimatedShipment) {
                    newImport.dates!.estimatedShipment = newImport.departureVesselDate;
                }
                 if (newImport.arrivalVesselDate && !newImport.dates?.estimatedArrival) {
                    newImport.dates!.estimatedArrival = newImport.arrivalVesselDate;
                }

                if (!newImport.importNumber) errors.push('Import Number (PROCESSO) is required.');
                if (!newImport.blNumber) errors.push('BL Number (BL) is required.');

                return { data: newImport, errors, isValid: errors.length === 0, originalRow: row };
            });

            setValidationResult(validated);
            setIsLoading(false);
        }, 500);

    }, [fileContent]);

    const handleConfirm = () => {
        const validImports = validationResult
            .filter(r => r.isValid)
            .map(r => {
                const data = r.data;
                const orderDate = data.dates?.orderPlaced || data.departureVesselDate || new Date().toISOString().split('T')[0];
                
                const newImport: Omit<ImportProcess, 'id'> = {
                    createdById: currentUser.id,
                    incoterm: 'FOB',
                    demurrageFreeTimeDays: 45,
                    products: [],
                    containers: [],
                    costs: [],
                    documents: [],
                    notificationEmails: [],
                    ...data,
                    importNumber: data.importNumber!,
                    blNumber: data.blNumber!,
                    supplier: data.supplier || 'N/A',
                    poNumbers: data.poNumbers || '',
                    responsibleBroker: data.responsibleBroker || 'N/A',
                    observationNotes: data.observationNotes || '',
                    exTariff: data.exTariff || 0,
                    totalContainers: data.totalContainers || 0,
                    dates: {
                        orderPlaced: orderDate,
                        estimatedShipment: data.dates?.estimatedShipment || data.departureVesselDate,
                        estimatedArrival: data.dates?.estimatedArrival || data.arrivalVesselDate
                    },
                    trackingHistory: data.trackingHistory || [{ stage: ImportStatus.OrderPlaced, date: orderDate }],
                };
                
                if(!newImport.containers || newImport.containers.length === 0) {
                     newImport.containers = Array.from({length: newImport.totalContainers || 1}).map((_, i) => ({
                         id: `cont-${Date.now()}-${i}`,
                         containerNumber: `PENDING-${i+1}`,
                         currentStatus: ContainerStatus.OnVessel,
                         demurrageFreeDays: newImport.demurrageFreeTimeDays,
                         log: [],
                         etaFactory: newImport.dates.estimatedArrival!,
                     }));
                }
                return newImport;
            })
            .filter((imp): imp is Omit<ImportProcess, 'id'> => imp !== null);
        
        onConfirm(validImports);
        alert(`${validImports.length} imports were successfully created!`);
        navigate('/imports');
    };

    const { validCount, invalidCount } = useMemo(() => {
        return validationResult.reduce(
            (acc, r) => {
                r.isValid ? acc.validCount++ : acc.invalidCount++;
                return acc;
            },
            { validCount: 0, invalidCount: 0 }
        );
    }, [validationResult]);

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md h-full flex flex-col">
            <h2 className="text-xl font-semibold text-brand-primary dark:text-white flex items-center gap-2 mb-2"><UploadCloud /> Fast Input</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Upload a spreadsheet (CSV) with FUP data to create multiple import processes at once.</p>

            {!fileContent ? (
                 <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed dark:border-gray-600 rounded-lg p-8">
                    <UploadCloud size={48} className="text-gray-400 dark:text-gray-500" />
                    <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">Drag and drop your FUP file here</p>
                    <p className="text-gray-500 dark:text-gray-400">or</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 bg-brand-highlight text-brand-primary px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                    >
                        Browse File
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                </div>
            ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                    <Loader size={40} className="animate-spin text-brand-accent"/>
                    <p className="mt-4 text-gray-600 dark:text-gray-300">Parsing and validating CSV...</p>
                </div>
            ) : (
                <div className="flex-grow flex flex-col">
                    <div className="flex flex-wrap gap-4 items-center mb-4 p-4 rounded-lg bg-gray-50 dark:bg-brand-primary/50">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400"><CheckCircle size={20}/> <span className="font-semibold">{validCount} Valid Records</span></div>
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400"><AlertCircle size={20}/> <span className="font-semibold">{invalidCount} Invalid Records</span></div>
                        <div className="flex-grow text-right text-sm text-gray-500 dark:text-gray-400">Total records found: {validationResult.length}</div>
                    </div>
                    <div className="flex-grow overflow-y-auto border dark:border-brand-accent rounded-lg">
                         <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-brand-accent/20 sticky top-0">
                                <tr>
                                    <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">#</th>
                                    <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Import #</th>
                                    <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">BL #</th>
                                    <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {validationResult.map((record, index) => (
                                    <tr key={index} className={record.isValid ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                                        <td className="p-2 text-gray-500 dark:text-gray-400">{index + 1}</td>
                                        <td className="p-2 font-medium text-brand-secondary dark:text-gray-200">{record.data.importNumber || '-'}</td>
                                        <td className="p-2 text-gray-700 dark:text-gray-300">{record.data.blNumber || '-'}</td>
                                        <td className="p-2">
                                            {record.isValid ? (
                                                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle size={14}/> Ready to Import</span>
                                            ) : (
                                                <div className="text-xs text-red-600 dark:text-red-400">
                                                    <div className="flex items-center gap-1 font-bold"><AlertCircle size={14}/> Errors Found</div>
                                                    <ul className="list-disc list-inside pl-2 mt-1">
                                                        {record.errors.map((e, i) => <li key={i}>{e}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <div className="p-4 bg-gray-50 dark:bg-brand-primary/50 border-t dark:border-gray-700 mt-4 flex justify-end items-center gap-4">
                        <button onClick={() => setFileContent(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-brand-accent">
                            Upload New File
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={isLoading || validCount === 0}
                            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ShieldCheck size={18} /> Confirm and Import {validCount} Records
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FastInput;