import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ImportProcess, User, Claim } from '../types';
import { ImportStatus } from '../types';
import { Eye, Trash2, ChevronRight, ChevronLeft, Search, Filter, X } from 'lucide-react';
import { isPast } from 'date-fns';

interface ImportListProps {
    imports: ImportProcess[];
    users: User[];
    deleteImport: (id: string) => void;
    currentUser: User;
    globalDate: string;
    claims: Claim[];
}

const ImportList: React.FC<ImportListProps> = ({ imports, users, deleteImport, currentUser, globalDate, claims }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const itemsPerPage = 10;
    const canDelete = currentUser.role === 'Admin';

    const openClaimIds = useMemo(() => new Set(claims.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected').map(c => c.importId)), [claims]);

    const importsWithCreator = useMemo(() => imports.map(imp => {
        const atRisk = (!imp.dates.estimatedArrival && isPast(new Date(imp.dates.orderPlaced || 0))) || 
                       (imp.dates.estimatedArrival && isPast(new Date(imp.dates.estimatedArrival)) && imp.overallStatus !== 'Delivered') ||
                       openClaimIds.has(imp.id);
        return {
            ...imp,
            creator: users.find(u => u.id === imp.createdById),
            isAtRisk: atRisk
        }
    }).sort((a, b) => new Date(b.dates.orderPlaced || 0).getTime() - new Date(a.dates.orderPlaced || 0).getTime()), [imports, users, openClaimIds]);

    const filteredImports = useMemo(() => {
        return importsWithCreator.filter(imp => {
            const lowerSearchTerm = searchTerm.toLowerCase();
            const searchMatch = (
                imp.importNumber.toLowerCase().includes(lowerSearchTerm) ||
                imp.blNumber.toLowerCase().includes(lowerSearchTerm) ||
                imp.supplier.toLowerCase().includes(lowerSearchTerm) ||
                (imp.typeOfCargo || '').toLowerCase().includes(lowerSearchTerm) ||
                (imp.creator && imp.creator.name.toLowerCase().includes(lowerSearchTerm))
            );

            const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00Z') : null;
            const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59Z') : null;
            
            const arrivalDate = imp.dates.estimatedArrival ? new Date(imp.dates.estimatedArrival + 'T00:00:00Z') : null;
            const dateMatch = !arrivalDate || ((!startDate || arrivalDate >= startDate) && (!endDate || arrivalDate <= endDate));

            return searchMatch && dateMatch;
        });
    }, [importsWithCreator, searchTerm, dateRange]);


    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentImports = filteredImports.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredImports.length / itemsPerPage);

    const getStatusChip = (status?: string) => {
        const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full text-white dark:text-opacity-90";
        switch (status) {
            case ImportStatus.OrderPlaced: return `${baseClasses} bg-gray-400 dark:bg-gray-600`;
            case ImportStatus.ShipmentConfirmed: return `${baseClasses} bg-blue-500 dark:bg-blue-600`;
            case ImportStatus.ArrivalAtPort: return `${baseClasses} bg-indigo-500 dark:bg-indigo-600`;
            case ImportStatus.CustomsClearance: return `${baseClasses} bg-purple-500 dark:bg-purple-600`;
            case ImportStatus.Delivered: return `${baseClasses} bg-emerald-500 dark:bg-emerald-600`;
            default: return `${baseClasses} bg-cyan-600 dark:bg-cyan-700`; // For custom overall statuses
        }
    };

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-card">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-brand-primary dark:text-white">All Imports</h2>
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search imports..."
                        className="w-full sm:w-64 pl-10 pr-4 py-2 border dark:border-brand-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent bg-transparent text-brand-gray-500 dark:text-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
             <div className="mb-4 p-3 bg-gray-50 dark:bg-brand-primary/50 rounded-lg flex flex-wrap items-center gap-2">
                <Filter size={16} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Arrival between:</span>
                 <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <span className="text-sm text-gray-700 dark:text-gray-300">and</span>
                 <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="p-1 border dark:border-brand-accent rounded-md text-sm bg-transparent dark:text-gray-200" />
                 <button onClick={() => setDateRange({start: '', end: ''})} className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" title="Clear dates">
                    <X size={16} />
                </button>
             </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Import #</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Supplier</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Cargo Type</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Est. Arrival</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentImports.length > 0 ? currentImports.map(imp => (
                            <tr key={imp.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-brand-primary ${imp.isAtRisk ? 'border-l-4 border-amber-500' : ''}`}>
                                <td className="p-3 font-medium text-brand-secondary dark:text-gray-200">
                                    {imp.importNumber}
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">BL: {imp.blNumber}</p>
                                </td>
                                <td className="p-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{imp.supplier}</td>
                                <td className="p-3 text-gray-700 dark:text-gray-300 hidden md:table-cell">{imp.typeOfCargo || 'N/A'}</td>
                                <td className="p-3 text-gray-700 dark:text-gray-300 hidden lg:table-cell">{imp.dates.estimatedArrival ? new Date(imp.dates.estimatedArrival  + 'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
                                <td className="p-3"><span className={getStatusChip(imp.overallStatus || imp.trackingHistory[imp.trackingHistory.length-1]?.stage)}>{imp.overallStatus || imp.trackingHistory[imp.trackingHistory.length-1]?.stage}</span></td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        <Link to={`/imports/${imp.id}`} className="p-2 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-brand-accent rounded-md"><Eye size={18} /></Link>
                                        {canDelete && (
                                            <button onClick={() => deleteImport(imp.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-brand-accent/50 rounded-md"><Trash2 size={18} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center p-8 text-gray-500 dark:text-gray-400">No imports match your search criteria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-4 py-2 border dark:border-brand-accent rounded-lg text-sm disabled:opacity-50 text-brand-gray-500 dark:text-gray-300">
                        <ChevronLeft size={16} /> Previous
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 px-4 py-2 border dark:border-brand-accent rounded-lg text-sm disabled:opacity-50 text-brand-gray-500 dark:text-gray-300">
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImportList;