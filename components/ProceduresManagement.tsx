
import React, { useState, useRef } from 'react';
import { BookText, BookUser, DollarSign, Truck, ChevronLeft, FileText, UploadCloud, Trash2, PlusCircle, Edit, Save, X } from 'lucide-react';
import type { Procedure, User, Document } from '../types';

type ProcedureCategory = 'broker' | 'logistics' | 'financial';

interface ProceduresManagementProps {
    procedures: Procedure[];
    onUpdateProcedures: (updatedProcedures: Procedure[]) => void;
    currentUser: User;
}

const ProcedureCategoryCard: React.FC<{title: string, icon: React.ReactNode, onClick: () => void}> = ({ title, icon, onClick }) => (
    <button onClick={onClick} className="w-full bg-white dark:bg-brand-primary p-8 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transform transition-all text-center group">
        <div className="w-16 h-16 bg-brand-highlight text-brand-primary rounded-full flex items-center justify-center mx-auto transition-colors group-hover:bg-brand-primary group-hover:text-white">
            {icon}
        </div>
        <h3 className="mt-4 text-xl font-bold text-brand-primary dark:text-white">{title}</h3>
    </button>
);


const ProcedureDetailsPage: React.FC<{
    category: ProcedureCategory, 
    procedures: Procedure[],
    onBack: () => void,
    onUpdateProcedures: (updatedProcedures: Procedure[]) => void
}> = ({ category, procedures, onBack, onUpdateProcedures }) => {
    const categoryInfo = {
        broker: { title: "Broker Procedures", icon: <BookUser size={32} /> },
        logistics: { title: "Logistics Procedures", icon: <Truck size={32} /> },
        financial: { title: "Financial Procedures", icon: <DollarSign size={32} /> },
    };
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
    const [editingProcedure, setEditingProcedure] = useState<Partial<Procedure> | null>(null);

    const currentCategory = categoryInfo[category];
    const procedureList = procedures.filter(p => p.category === category);
    
    const handleUploadClick = (procedureId: string) => {
        setSelectedProcedureId(procedureId);
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProcedureId) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const newDoc: Document = {
                id: `pop-doc-${Date.now()}`,
                name: file.name,
                type: 'POP',
                uploadDate: new Date().toISOString(),
                fileUrl: event.target?.result as string,
            };

            const updatedProcedures = procedures.map(p => {
                if (p.id === selectedProcedureId) {
                    return { ...p, documents: [...(p.documents || []), newDoc] };
                }
                return p;
            });
            onUpdateProcedures(updatedProcedures);
            setSelectedProcedureId(null);
        };
         e.target.value = ''; // Reset file input
    };
    
    const handleRemoveDocument = (procedureId: string, docId: string) => {
        const updatedProcedures = procedures.map(p => {
            if (p.id === procedureId) {
                return { ...p, documents: p.documents?.filter(d => d.id !== docId) };
            }
            return p;
        });
        onUpdateProcedures(updatedProcedures);
    };

    const handleSaveProcedure = () => {
        if (!editingProcedure || !editingProcedure.title || !editingProcedure.summary) return;

        if (editingProcedure.id) {
            // Update existing
            const updated = procedures.map(p => p.id === editingProcedure.id ? editingProcedure as Procedure : p);
            onUpdateProcedures(updated);
        } else {
            // Add new
            const newProcedure: Procedure = {
                id: `proc-${Date.now()}`,
                category: category,
                title: editingProcedure.title,
                summary: editingProcedure.summary,
                steps: editingProcedure.steps || [],
            };
            onUpdateProcedures([...procedures, newProcedure]);
        }
        setEditingProcedure(null);
    };

    const handleStepChange = (stepIndex: number, newText: string) => {
        if (!editingProcedure || !editingProcedure.steps) return;
        const newSteps = [...editingProcedure.steps];
        newSteps[stepIndex].text = newText;
        setEditingProcedure(prev => ({ ...prev, steps: newSteps }));
    };

    const addStep = () => {
        if (!editingProcedure) return;
        const newStep = { id: `step-${Date.now()}`, text: '' };
        setEditingProcedure(prev => ({ ...prev, steps: [...(prev?.steps || []), newStep] }));
    };

    const removeStep = (stepIndex: number) => {
        if (!editingProcedure) return;
        setEditingProcedure(prev => ({ ...prev, steps: prev?.steps?.filter((_, i) => i !== stepIndex) }));
    };
    
    const handleDeleteProcedure = (procedureId: string) => {
        if (window.confirm("Are you sure you want to delete this entire procedure?")) {
            onUpdateProcedures(procedures.filter(p => p.id !== procedureId));
        }
    }

    const renderEditView = () => (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingProcedure(null)}>
            <div className="bg-white dark:bg-brand-secondary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="p-4 font-semibold text-lg text-brand-primary dark:text-white border-b dark:border-gray-700">{editingProcedure?.id ? 'Edit' : 'Create'} Procedure</h3>
                <div className="p-4 space-y-4 overflow-y-auto">
                    <input type="text" placeholder="Procedure Title" value={editingProcedure?.title || ''} onChange={(e) => setEditingProcedure(p => ({...p, title: e.target.value}))} className="w-full p-2 border dark:border-brand-accent rounded text-brand-secondary dark:text-white bg-white dark:bg-brand-primary" />
                    <textarea placeholder="Procedure Summary" value={editingProcedure?.summary || ''} onChange={(e) => setEditingProcedure(p => ({...p, summary: e.target.value}))} className="w-full p-2 border dark:border-brand-accent rounded text-brand-secondary dark:text-white bg-white dark:bg-brand-primary" />
                    <h4 className="font-semibold text-brand-primary dark:text-white">Steps</h4>
                    <div className="space-y-2">
                        {editingProcedure?.steps?.map((step, i) => (
                            <div key={step.id} className="flex items-center gap-2">
                                <span className="text-gray-500">{i + 1}.</span>
                                <input type="text" value={step.text} onChange={e => handleStepChange(i, e.target.value)} className="flex-grow p-1 border dark:border-brand-accent rounded text-brand-secondary dark:text-white bg-white dark:bg-brand-primary" />
                                <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addStep} className="flex items-center gap-2 text-sm text-sky-600 font-semibold"><PlusCircle size={16}/> Add Step</button>
                </div>
                <div className="p-4 flex justify-end gap-2 bg-gray-50 dark:bg-brand-primary/50 border-t dark:border-gray-700">
                    <button onClick={() => setEditingProcedure(null)} className="px-4 py-2 border dark:border-gray-600 rounded">Cancel</button>
                    <button onClick={handleSaveProcedure} className="px-4 py-2 bg-brand-accent text-white rounded flex items-center gap-2"><Save size={16}/> Save</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in-down">
            {editingProcedure && renderEditView()}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 font-semibold hover:underline">
                    <ChevronLeft size={16}/> Back to Categories
                </button>
                <button onClick={() => setEditingProcedure({category: category, title: '', summary: '', steps: [{id: `step-${Date.now()}`, text: ''}]})} className="flex items-center gap-2 bg-brand-secondary text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-accent">
                    <PlusCircle size={16}/> Create POP on Page
                </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
                <div className="text-brand-accent">{currentCategory.icon}</div>
                <h2 className="text-2xl font-bold text-brand-primary dark:text-white">{currentCategory.title}</h2>
            </div>
            <div className="space-y-6">
                {procedureList.map(proc => (
                    <div key={proc.id} className="p-4 border dark:border-brand-accent rounded-lg bg-gray-50 dark:bg-brand-primary/50">
                        <div className="flex justify-between items-start">
                             <div>
                                <h4 className="text-lg font-semibold text-brand-secondary dark:text-gray-200">{proc.title}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">{proc.summary}</p>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setEditingProcedure(JSON.parse(JSON.stringify(proc)))} className="p-2 text-sky-600 hover:text-sky-800"><Edit size={16}/></button>
                                <button onClick={() => handleDeleteProcedure(proc.id)} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-800 dark:text-gray-300">
                            {proc.steps.map((step) => <li key={step.id}>{step.text}</li>)}
                        </ol>
                        <div className="mt-4 border-t dark:border-gray-700 pt-3">
                             <h5 className="text-sm font-semibold text-brand-secondary dark:text-gray-200 mb-2">Attached POPs & Documents</h5>
                             {proc.documents && proc.documents.length > 0 ? (
                                <ul className="space-y-2">
                                    {proc.documents.map(doc => (
                                         <li key={doc.id} className="flex items-center justify-between text-sm p-2 bg-gray-100 dark:bg-brand-primary rounded-md">
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sky-700 dark:text-sky-400 hover:underline">
                                                <FileText size={16} />
                                                {doc.name}
                                            </a>
                                            <button onClick={() => handleRemoveDocument(proc.id, doc.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-4"><Trash2 size={14}/></button>
                                        </li>
                                    ))}
                                </ul>
                             ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No documents attached.</p>
                             )}
                            <button onClick={() => handleUploadClick(proc.id)} className="mt-2 flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 font-medium hover:underline">
                                <UploadCloud size={16} /> Upload POP
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}


const ProceduresManagement: React.FC<ProceduresManagementProps> = ({ procedures, onUpdateProcedures, currentUser }) => {
    const [selectedCategory, setSelectedCategory] = useState<ProcedureCategory | null>(null);

    if (selectedCategory) {
        return <ProcedureDetailsPage category={selectedCategory} procedures={procedures} onBack={() => setSelectedCategory(null)} onUpdateProcedures={onUpdateProcedures} />;
    }

    return (
        <div className="bg-white dark:bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-md">
            <div className="flex items-center mb-4">
                <BookText size={24} className="text-brand-accent" />
                <h2 className="text-xl font-semibold text-brand-primary dark:text-white ml-3">Procedures Management</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Select a department to view its principal operational procedures and step-by-step guides for using the system.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ProcedureCategoryCard title="BYD - Broker" icon={<BookUser size={32}/>} onClick={() => setSelectedCategory('broker')} />
                <ProcedureCategoryCard title="BYD - Logistics" icon={<Truck size={32}/>} onClick={() => setSelectedCategory('logistics')} />
                <ProcedureCategoryCard title="BYD - Financial" icon={<DollarSign size={32}/>} onClick={() => setSelectedCategory('financial')} />
            </div>
        </div>
    );
};

export default ProceduresManagement;