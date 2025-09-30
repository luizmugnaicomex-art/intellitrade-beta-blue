import React, { useState, useMemo } from 'react';
import type { ImportProcess, User, DIChannel } from '../types';
import { Link } from 'react-router-dom';
import { FileBadge, Search, Filter, X } from 'lucide-react';

interface DeclarationDIStatusManagementProps {
    imports: ImportProcess[];
    updateImport: (updatedImport: ImportProcess) => void;
    currentUser: User;
    globalDate: string;
}

const DI_CHANNELS: DIChannel[] = ['Green', 'Yellow', 'Red', 'Gray'];

const getDiChannelChip = (channel?: string) => {
    const baseClasses = "p-1.5 border rounded-md text-xs w-full appearance-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed";
    switch(channel) {
        case 'Green': return `${baseClasses} bg-green-500 text-white border-green-500`;
        case 'Yellow': return `${baseClasses} bg-yellow-500 text-white border-yellow-500`;
        case 'Red': return `${baseClasses} bg-red-500 text-white border-red-500`;
        case 'Gray': return `${baseClasses} bg-gray-500 text-white border-gray-500`;
        default: return `${baseClasses} bg-white dark:bg-brand-primary border-brand-accent`;
    }
};

const DeclarationDIStatusManagement: React.FC<DeclarationDIStatusManagementProps> = ({ imports, updateImport, currentUser, globalDate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const canEdit = currentUser.role === 'Admin' || currentUser.role === 'Logistics';

    const filteredImports = useMemo(() => {
        return imports.filter(imp => {
            const searchMatch = 
                imp.importNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                imp.blNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (imp.diNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

            const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00Z') : null;
            const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59Z') : null;
            
            const registrationDate = imp.diRegistrationDate ? new Date(imp.diRegistrationDate + 'T00:00:00Z') : null;
            const dateMatch = !registrationDate || (!startDate || registrationDate >= startDate) && (!endDate || registrationDate <= endDate);
            
            return searchMatch && dateMatch;
        });
    }, [imports, searchTerm, dateRange]);

    const handleUpdate = (importId: string, field: keyof ImportProcess, value: any) => {
        if (!canEdit) return;
        const targetImport = imports.find(imp => imp.id === importId);
        if (targetImport) {
            updateImport({ ...targetImport, [field]: value });
        }
    };

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-brand-primary dark:text-white flex items-center gap-2">
                        <FileBadge /> Declaration DI Status Management
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor and update the status of Import Declarations.</p>
                </div>
                 <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Import#, BL#, DI#..."
                        className="w-full md:w-72 pl-10 pr-4 py-2 border dark:border-brand-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent bg-transparent text-brand-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 dark:bg-brand-primary/50 rounded-lg flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Registration between:</span>
                 <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <span>and</span>
                 <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <button onClick={() => setDateRange({start: '', end: ''})} className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" title="Clear dates">
                    <X size={16} />
                </button>
             </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">Import #</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">DI #</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">DI Registration Date</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">Customs Channel</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">DI Status Text</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredImports.map(imp => (
                            <tr key={imp.id} className="hover:bg-gray-50 dark:hover:bg-brand-primary">
                                <td className="p-3 font-medium">
                                    <Link to={`/imports/${imp.id}`} className="hover:underline text-sky-600 dark:text-sky-400">{imp.importNumber}</Link>
                                    <p className="text-xs text-brand-gray-500 dark:text-gray-400">BL: {imp.blNumber}</p>
                                </td>
                                <td className="p-3">
                                    <span className="text-gray-800 dark:text-gray-300">{imp.diNumber || 'N/A'}</span>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="date"
                                        value={(imp.diRegistrationDate || '').split('T')[0]}
                                        onChange={e => handleUpdate(imp.id, 'diRegistrationDate', e.target.value)}
                                        disabled={!canEdit}
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-full disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <select
                                        value={imp.diChannel || ''}
                                        onChange={e => handleUpdate(imp.id, 'diChannel', e.target.value)}
                                        disabled={!canEdit}
                                        className={getDiChannelChip(imp.diChannel)}
                                    >
                                        <option value="" className="bg-white dark:bg-brand-secondary text-black dark:text-white">-- Select --</option>
                                        {DI_CHANNELS.map(ch => (
                                            <option key={ch} value={ch} className="bg-white dark:bg-brand-secondary text-black dark:text-white">{ch}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text"
                                        value={imp.diStatusText || ''}
                                        onChange={e => handleUpdate(imp.id, 'diStatusText', e.target.value)}
                                        disabled={!canEdit}
                                        placeholder="e.g. Desembaraçada"
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-full disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                            </tr>
                        ))}
                         {filteredImports.length === 0 && (
                             <tr>
                                <td colSpan={5} className="text-center p-8 text-gray-500 dark:text-gray-400">No imports match your search.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DeclarationDIStatusManagement;