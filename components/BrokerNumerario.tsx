

import React, { useState, useMemo } from 'react';
import type { ImportProcess, BrokerNumerario, User, NumerarioApprovalStatus } from '../types';
import { Link } from 'react-router-dom';
import { Receipt, Filter, X } from 'lucide-react';

interface BrokerNumerarioProps {
    imports: ImportProcess[];
    updateImport: (updatedImport: ImportProcess) => void;
    currentUser: User;
}

const APPROVAL_STATUSES: NumerarioApprovalStatus[] = ['Pending Approval', 'Approved', 'Rejected'];

const getStatusChipColor = (status: NumerarioApprovalStatus) => {
    switch (status) {
        case 'Approved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-300';
        case 'Pending Approval': return 'bg-amber-100 text-amber-800 dark:bg-amber-800/50 dark:text-amber-300';
        case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700';
    }
};


const BrokerNumerario: React.FC<BrokerNumerarioProps> = ({ imports, updateImport, currentUser }) => {
    
    const [statusFilter, setStatusFilter] = useState<NumerarioApprovalStatus | 'all'>('all');
    const [monthFilter, setMonthFilter] = useState(''); // YYYY-MM format

    const canEdit = currentUser.role === 'Admin' || currentUser.role === 'Finance';

    const filteredImports = useMemo(() => {
        return imports.filter(imp => {
            const numerario = imp.brokerNumerario;
            if (statusFilter !== 'all' && numerario?.approvalStatus !== statusFilter) {
                return false;
            }
            if (monthFilter) {
                const transferDate = numerario?.transferConfirmedDate;
                if (!transferDate || !transferDate.startsWith(monthFilter)) {
                    return false;
                }
            }
            return true;
        });
    }, [imports, statusFilter, monthFilter]);

    const handleUpdate = (importId: string, field: keyof BrokerNumerario, value: any) => {
        if (!canEdit) return;
        const targetImport = imports.find(imp => imp.id === importId);
        if (!targetImport) return;
        
        const updatedNumerario = {
            ...(targetImport.brokerNumerario || { estimatedValue: 0, approvalStatus: 'Pending Approval', isPaid: false }),
            [field]: value
        };

        updateImport({ ...targetImport, brokerNumerario: updatedNumerario });
    };

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
            <div className="flex items-center mb-4">
                <Receipt size={24} className="text-brand-gray-500" />
                <h2 className="text-xl font-semibold text-brand-gray-500 dark:text-white ml-3">Broker Numerário Management</h2>
            </div>
            <p className="text-sm text-brand-gray-500 dark:text-gray-400 mb-4">Track advance payments and reconciliations with customs brokers for each import process.</p>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 bg-gray-50 dark:bg-brand-primary/50 rounded-lg">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-brand-gray-500 dark:text-gray-300">Status:</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="p-2 border dark:border-brand-accent rounded-lg text-sm bg-white dark:bg-brand-primary dark:text-gray-200">
                        <option value="all">All</option>
                        {APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                 <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-brand-gray-500 dark:text-gray-300">Transfer Month:</label>
                    <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="p-2 border dark:border-brand-accent rounded-lg text-sm bg-white dark:bg-brand-primary dark:text-gray-200" />
                </div>
                 <button onClick={() => {setStatusFilter('all'); setMonthFilter('');}} className="p-2 text-brand-gray-500 hover:text-red-500" title="Clear Filters"><X size={18} /></button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400">Import #</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-right">Estimated Value</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-right">Informed Value</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-center">Approval Status</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-center">Transfer Date</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-center">Reconciliation Date</th>
                            <th className="p-3 font-semibold text-brand-gray-500 dark:text-gray-400 text-center">Paid</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredImports.map(imp => (
                            <tr key={imp.id} className="hover:bg-gray-50 dark:hover:bg-brand-primary">
                                <td className="p-3 font-medium">
                                    <Link to={`/imports/${imp.id}`} className="hover:underline text-brand-gray-500 dark:text-brand-gray-300 hover:text-brand-gray-500">{imp.importNumber}</Link>
                                    <p className="text-xs text-brand-gray-500 dark:text-gray-500">BL: {imp.blNumber}</p>
                                </td>
                                <td className="p-3 text-right">
                                    <input 
                                        type="number" 
                                        value={imp.brokerNumerario?.estimatedValue || ''} 
                                        onChange={(e) => handleUpdate(imp.id, 'estimatedValue', parseFloat(e.target.value) || 0)}
                                        disabled={!canEdit}
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-28 text-right disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                                <td className="p-3 text-right">
                                     <input 
                                        type="number" 
                                        value={imp.brokerNumerario?.informedValue || ''} 
                                        onChange={(e) => handleUpdate(imp.id, 'informedValue', parseFloat(e.target.value) || 0)}
                                        disabled={!canEdit}
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-28 text-right disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <select
                                        value={imp.brokerNumerario?.approvalStatus || ''}
                                        onChange={(e) => handleUpdate(imp.id, 'approvalStatus', e.target.value)}
                                        disabled={!canEdit}
                                        className={`p-1.5 border-0 rounded-md text-xs w-full appearance-none disabled:opacity-70 ${getStatusChipColor(imp.brokerNumerario?.approvalStatus || 'Pending Approval')}`}
                                    >
                                        {APPROVAL_STATUSES.map(status => (
                                            <option key={status} value={status} className="bg-white dark:bg-brand-secondary text-black dark:text-white">{status}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-3 text-center">
                                     <input 
                                        type="date"
                                        value={imp.brokerNumerario?.transferConfirmedDate || ''}
                                        onChange={(e) => handleUpdate(imp.id, 'transferConfirmedDate', e.target.value)}
                                        disabled={!canEdit}
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-full disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                                 <td className="p-3 text-center">
                                     <input 
                                        type="date"
                                        value={imp.brokerNumerario?.reconciliationDate || ''}
                                        onChange={(e) => handleUpdate(imp.id, 'reconciliationDate', e.target.value)}
                                        disabled={!canEdit}
                                        className="p-1 border dark:border-brand-accent rounded-md bg-white dark:bg-brand-primary text-xs w-full disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={!!imp.brokerNumerario?.isPaid}
                                        onChange={(e) => handleUpdate(imp.id, 'isPaid', e.target.checked)}
                                        disabled={!canEdit}
                                        className="h-5 w-5 text-brand-accent border-gray-300 rounded focus:ring-brand-accent"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BrokerNumerario;