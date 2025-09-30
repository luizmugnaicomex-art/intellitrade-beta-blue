

import React, { useState, useEffect, useRef } from 'react';
import type { VesselScheduleEntry } from '../types';
import { Loader, Anchor, Ship, UploadCloud, AlertCircle } from 'lucide-react';

interface VesselScheduleProps {
    theme: 'light' | 'dark';
    globalDate: string;
}

const VesselSchedule: React.FC<VesselScheduleProps> = ({ theme, globalDate }) => {
    const [schedule, setSchedule] = useState<VesselScheduleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mock parsing of a file, in a real scenario a library like PapaParse for CSV would be used
    const parseAndSetSchedule = (fileContent: string) => {
        setLoading(true);
        setError(null);
        try {
            // This is a mock parser. It returns static data regardless of file content.
            const mockData: VesselScheduleEntry[] = [
                { vesselName: 'UPLOADED VESSEL A', voyage: 'V001', agency: 'Uploaded Agency', eta: new Date(globalDate + 'T10:00:00Z').toISOString(), etb: new Date(globalDate + 'T11:00:00Z').toISOString(), ets: new Date(globalDate + 'T23:00:00Z').toISOString(), berth: '3', status: 'Berthed', cargo: 'Containers' },
                { vesselName: 'UPLOADED VESSEL B', voyage: 'V002', agency: 'Uploaded Agency', eta: new Date(globalDate + 'T18:00:00Z').toISOString(), etb: new Date(globalDate + 'T19:00:00Z').toISOString(), ets: new Date(new Date(globalDate).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), berth: '4', status: 'Expected', cargo: 'Containers' },
            ];
            setSchedule(mockData);
        } catch (err) {
            setError("Failed to parse the uploaded file. Please ensure it's a valid CSV or Excel file.");
        } finally {
            setLoading(false);
        }
    }
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            parseAndSetSchedule(event.target?.result as string);
        };
        reader.readAsText(file);
    };

    const expectedVessels = schedule.filter(v => v.status === 'Expected');
    const berthedVessels = schedule.filter(v => v.status === 'Berthed');
    
    const ScheduleTable: React.FC<{title: string, data: VesselScheduleEntry[]}> = ({title, data}) => (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-brand-primary dark:text-white mb-4">{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b dark:border-gray-700">
                        <tr>
                            <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Vessel</th>
                            <th className="p-2 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Agency</th>
                            <th className="p-2 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Berth</th>
                            <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Arrival (ETA)</th>
                            <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Departure (ETS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? data.map(vessel => (
                            <tr key={`${vessel.vesselName}-${vessel.voyage}`} className="border-b dark:border-gray-800 last:border-b-0">
                                <td className="p-2 font-semibold text-brand-secondary dark:text-gray-200">{vessel.vesselName}</td>
                                <td className="p-2 text-gray-700 dark:text-gray-300 hidden lg:table-cell">{vessel.agency}</td>
                                <td className="p-2 text-gray-700 dark:text-gray-300 hidden md:table-cell">{vessel.berth}</td>
                                <td className="p-2 text-gray-700 dark:text-gray-300">{new Date(vessel.eta).toLocaleString()}</td>
                                <td className="p-2 text-gray-700 dark:text-gray-300">{new Date(vessel.ets).toLocaleString()}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center p-6 text-gray-500 dark:text-gray-400">No vessels to display.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                 <h2 className="text-2xl font-bold text-brand-primary dark:text-white">Vessel Schedule - Port of Salvador (SSA)</h2>
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="flex items-center gap-2 bg-brand-highlight text-brand-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    <UploadCloud size={16} />
                    {loading ? 'Processing...' : 'Upload Schedule File'}
                 </button>
            </div>
            
            {error && (
                <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-center gap-3">
                    <AlertCircle />
                    <p><span className="font-bold">Error:</span> {error}</p>
                </div>
            )}
            
            {schedule.length === 0 && !loading && !error && (
                <div className="text-center p-8 bg-gray-50 dark:bg-brand-primary/50 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">Please upload a schedule file to view vessel information.</p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader size={48} className="animate-spin text-brand-accent" />
                </div>
            ) : schedule.length > 0 && (
                <div className="space-y-6">
                    <ScheduleTable title="Berthed Vessels" data={berthedVessels} />
                    <ScheduleTable title="Expected Arrivals" data={expectedVessels} />
                </div>
            )}
        </div>
    );
};

export default VesselSchedule;