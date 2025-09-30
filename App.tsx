// src/App.tsx

import React, { useState, useEffect, createContext, useContext, useCallback, memo } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import { translations } from './translations';
import { ImportProcess, User, Claim, NCMEntry, Task, DeliverySlot, CostItem, ContainerBufferItem, Procedure, ExchangeRates, PaymentStatus, Contract, PDCAItem, Supplier, Project, Invoice, Payment, InvoiceStatus } from './types';
import { Home, FileText, BarChart2, PlusCircle, ChevronsLeft, ChevronsRight, Search, Bell, DollarSign, TrendingUp, Users, PackageCheck, Building2, Menu, X, Anchor, FileWarning, Receipt, TimerOff, FileBadge, BookCopy, History, CalendarClock, BookText, ShieldAlert, HandPlatter, Calculator, UploadCloud, Container, GanttChartSquare, CalendarIcon, Languages, Sun, Moon, Sparkles, Star, Trello, BarChartHorizontal, ClipboardCheck, RefreshCw, Handshake, FolderOpen, GanttChart, Brain, HardDrive, AlertCircle, CheckCircle as CheckCircleIcon } from 'lucide-react';

// Mock data for initial local setup
import { mockImports, mockUsers, mockClaims, mockNCMs, mockTasks, mockBuffer, mockProcedures, mockContracts, mockPDCAItems, mockSuppliers, mockProjects, mockInvoices, mockPayments } from './data/mockData';

// Centralized data service
import * as dataService from './services/dataService';
import { STORAGE_KEYS } from './services/dataService';

// Component Imports (following default export convention)
import Dashboard from './components/Dashboard';
import ImportList from './components/ImportList'; 
import ImportDetail from './components/ImportDetail';
import ImportForm from './components/ImportForm';
import Reports from './components/Reports';
import InvoiceManagement from './components/PaymentManagement';
import CashFlow from './components/CashFlow';
import LoginScreen from './components/LoginScreen';
import UserManagement from './components/UserManagement';
import PackingList from './components/PackingList';
import CompanyProfile from './components/CompanyProfile';
import VesselSchedule from './components/VesselSchedule';
import Claims from './components/Claims'; 
import BrokerNumerario from './components/BrokerNumerario';
import DemurrageControl from './components/DemurrageControl';
import DeclarationDIStatusManagement from './components/DeclarationDIStatusManagement'; 
import NCMManagement from './components/NCMManagement';
import SystemBackup from './components/SystemBackup';
import ContainerDeliveryWindow from './components/ContainerDeliveryWindow';
import ProceduresManagement from './components/ProceduresManagement';
import AdminAuthModal from './components/AdminAuthModal';
import ContainerBuffer from './components/ContainerBuffer';
import Calculations from './components/Calculations';
import FastInput from './components/FastInput';
import ProcessTracking from './components/ProcessTracking';
import ContainerControl from './components/ContainerControl';
import SmartSummary from './components/SmartSummary';
import Alerts from './components/Alerts';
import SupplierEvaluation from './components/SupplierEvaluation';
import WorkflowCRM from './components/WorkflowCRM';
import Contracts from './components/Contracts';
import PDCA from './components/PDCA';
import Projects from './components/Projects';
import SupplierManagement from './components/SupplierManagement';
import MachineLearn from './components/MachineLearn';

// --- Translation Context ---
type Language = 'en' | 'zh';
type TranslationContextType = {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: keyof typeof translations.en) => string;
};
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [language, setLanguage] = useLocalStorage<Language>('language', 'en');
    
    const t = (key: keyof typeof translations.en) => {
        return translations[language][key] || translations['en'][key];
    };

    return (
        <TranslationContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </TranslationContext.Provider>
    );
};
export const useTranslation = () => {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within a TranslationProvider');
    }
    return context;
};

export const App: React.FC = () => {
    // --- Data is now managed via state, populated from dataService ---
    const [imports, setImports] = useState<ImportProcess[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [ncms, setNcms] = useState<NCMEntry[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [deliverySchedule, setDeliverySchedule] = useState<DeliverySlot[]>([]);
    const [buffer, setBuffer] = useState<ContainerBufferItem[]>([]);
    const [procedures, setProcedures] = useState<Procedure[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [pdcaItems, setPdcaItems] = useState<PDCAItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // --- User, company, and UI settings still using localStorage for convenience ---
    const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [companyLogo, setCompanyLogo] = useLocalStorage<string | null>('companyLogo', null);
    const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
    const [globalDate, setGlobalDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const { t, setLanguage, language } = useTranslation();
    const [exchangeRates, setExchangeRates] = useLocalStorage<ExchangeRates | null>('exchangeRates', null);
    const [ratesLoading, setRatesLoading] = useState(true);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Admin Auth State
    const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
    const [adminAuthCallback, setAdminAuthCallback] = useState<(() => void) | null>(null);
    const navigate = useNavigate();

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // --- Load initial data from dataService ---
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoadingData(true);
            try {
                const [
                    importsData, usersData, claimsData, ncmData, tasksData, deliveryData,
                    bufferData, proceduresData, contractsData, pdcaData, suppliersData, 
                    projectsData, invoicesData, paymentsData
                ] = await Promise.all([
                    dataService.getData(STORAGE_KEYS.IMPORTS, mockImports),
                    dataService.getData(STORAGE_KEYS.USERS, mockUsers),
                    dataService.getData(STORAGE_KEYS.CLAIMS, mockClaims),
                    dataService.getData(STORAGE_KEYS.NCMS, mockNCMs),
                    dataService.getData(STORAGE_KEYS.TASKS, mockTasks),
                    dataService.getData(STORAGE_KEYS.DELIVERY_SCHEDULE, []),
                    dataService.getData(STORAGE_KEYS.CONTAINER_BUFFER, mockBuffer),
                    dataService.getData(STORAGE_KEYS.PROCEDURES, mockProcedures),
                    dataService.getData(STORAGE_KEYS.CONTRACTS, mockContracts),
                    dataService.getData(STORAGE_KEYS.PDCA_ITEMS, mockPDCAItems),
                    dataService.getData(STORAGE_KEYS.SUPPLIERS, mockSuppliers),
                    dataService.getData(STORAGE_KEYS.PROJECTS, mockProjects),
                    dataService.getData(STORAGE_KEYS.INVOICES, mockInvoices),
                    dataService.getData(STORAGE_KEYS.PAYMENTS, mockPayments),
                ]);
                setImports(importsData);
                setUsers(usersData);
                setClaims(claimsData);
                setNcms(ncmData);
                setTasks(tasksData);
                setDeliverySchedule(deliveryData);
                setBuffer(bufferData);
                setProcedures(proceduresData);
                setContracts(contractsData);
                setPdcaItems(pdcaData);
                setSuppliers(suppliersData);
                setProjects(projectsData);
                setInvoices(invoicesData);
                setPayments(paymentsData);
            } catch (err) {
                console.error("Failed to load initial data", err);
                showNotification("Failed to load application data. Please refresh.", "error");
            } finally {
                setIsLoadingData(false);
            }
        };
        loadInitialData();
    }, [showNotification]);


    // --- Theme Logic ---
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
    }, [theme]);

    // --- Exchange Rates Logic (Simplified) ---
    useEffect(() => {
        setRatesLoading(true);
        if (!exchangeRates) {
            // Provide a default or mock exchange rate if none is stored
            setExchangeRates({
                date: new Date().toISOString().split('T')[0],
                time: "10:00 (Default)",
                usd: { compra: 5.25, venda: 5.26 },
                eur: { compra: 5.68, venda: 5.69 },
                cny: 0.725
            });
        }
        setRatesLoading(false);
    }, [exchangeRates, setExchangeRates]);
    
    // --- Data Manipulation Functions (now async and calling dataService) ---
    // All these functions are wrapped in useCallback for performance and stability
    const addImport = useCallback(async (newImport: Omit<ImportProcess, 'id'>) => {
        const createdImport = await dataService.addDataItem<ImportProcess>(STORAGE_KEYS.IMPORTS, newImport);
        setImports(prev => [...prev, createdImport]);
        showNotification('Import created successfully!');
        return createdImport;
    }, [showNotification]);
    
    const addMultipleImports = useCallback(async (newImports: Omit<ImportProcess, 'id'>[]) => {
        const created = await dataService.addMultipleDataItems<ImportProcess>(STORAGE_KEYS.IMPORTS, newImports);
        setImports(prev => [...prev, ...created]);
        showNotification(`${created.length} imports created successfully!`);
    }, [showNotification]);

    const updateImport = useCallback(async (updatedImport: ImportProcess) => {
        await dataService.updateDataItem<ImportProcess>(STORAGE_KEYS.IMPORTS, updatedImport);
        setImports(prev => prev.map(imp => imp.id === updatedImport.id ? updatedImport : imp));
        showNotification('Import updated successfully!');
        return updatedImport;
    }, [showNotification]);

    const deleteImport = useCallback(async (importId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.IMPORTS, importId);
        setImports(prev => prev.filter(imp => imp.id !== importId));
        showNotification('Import deleted successfully!', 'error');
    }, [showNotification]);

    const login = (user: User) => setCurrentUser(user);
    const logout = () => setCurrentUser(null);
    
    const updateUser = useCallback(async (updatedUser: User) => {
        await dataService.updateDataItem<User>(STORAGE_KEYS.USERS, updatedUser);
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        showNotification('User updated!');
    }, [showNotification]);

    const addUser = useCallback(async (newUser: Omit<User, 'id'>) => {
        const createdUser = await dataService.addDataItem<User>(STORAGE_KEYS.USERS, newUser);
        setUsers(prev => [...prev, createdUser]);
        showNotification('User added!');
        return createdUser;
    }, [showNotification]);

    const addMultipleUsers = useCallback(async (newUsers: Omit<User, 'id'>[]) => {
        const created = await dataService.addMultipleDataItems<User>(STORAGE_KEYS.USERS, newUsers);
        setUsers(prev => [...prev, ...created]);
        showNotification(`${created.length} users created!`);
    }, [showNotification]);

    const addClaim = useCallback(async (newClaim: Omit<Claim, 'id'>) => {
        const created = await dataService.addDataItem<Claim>(STORAGE_KEYS.CLAIMS, newClaim);
        setClaims(prev => [...prev, created]);
        showNotification('Claim added!');
    }, [showNotification]);
    
    const addMultipleClaims = useCallback(async (newClaims: Omit<Claim, 'id'>[]) => {
        const created = await dataService.addMultipleDataItems<Claim>(STORAGE_KEYS.CLAIMS, newClaims);
        setClaims(prev => [...prev, ...created]);
        showNotification(`${created.length} claims created!`);
    }, [showNotification]);

    const updateClaim = useCallback(async (updatedClaim: Claim) => {
        await dataService.updateDataItem<Claim>(STORAGE_KEYS.CLAIMS, updatedClaim);
        setClaims(prev => prev.map(c => c.id === updatedClaim.id ? updatedClaim : c));
        showNotification('Claim updated!');
    }, [showNotification]);

    const addNcm = useCallback(async (newNcm: Omit<NCMEntry, 'id'>) => {
        const created = await dataService.addDataItem<NCMEntry>(STORAGE_KEYS.NCMS, newNcm);
        setNcms(prev => [...prev, created]);
        showNotification('NCM added!');
    }, [showNotification]);

    const updateNcm = useCallback(async (updatedNcm: NCMEntry) => {
        await dataService.updateDataItem<NCMEntry>(STORAGE_KEYS.NCMS, updatedNcm);
        setNcms(prev => prev.map(n => n.id === updatedNcm.id ? updatedNcm : n));
        showNotification('NCM updated!');
    }, [showNotification]);

    const deleteNcm = useCallback(async (ncmId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.NCMS, ncmId);
        setNcms(prev => prev.filter(n => n.id !== ncmId));
        showNotification('NCM deleted!', 'error');
    }, [showNotification]);
    
    const addTask = useCallback(async (newTask: Omit<Task, 'id'>) => {
        const created = await dataService.addDataItem<Task>(STORAGE_KEYS.TASKS, newTask);
        setTasks(prev => [...prev, created]);
        showNotification('Task added!');
    }, [showNotification]);

    const updateTask = useCallback(async (updatedTask: Task) => {
        await dataService.updateDataItem<Task>(STORAGE_KEYS.TASKS, updatedTask);
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        showNotification('Task updated!');
    }, [showNotification]);
    
    const deleteTask = useCallback(async (taskId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.TASKS, taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        showNotification('Task deleted!', 'error');
    }, [showNotification]);

    const addDeliverySlot = useCallback(async (newSlot: Omit<DeliverySlot, 'id'>) => {
        const created = await dataService.addDataItem<DeliverySlot>(STORAGE_KEYS.DELIVERY_SCHEDULE, newSlot);
        setDeliverySchedule(prev => [...prev, created]);
        showNotification('Delivery slot added!'); // Added notification
    }, [showNotification]);

    const updateDeliverySlot = useCallback(async (updatedSlot: DeliverySlot) => {
        await dataService.updateDataItem<DeliverySlot>(STORAGE_KEYS.DELIVERY_SCHEDULE, updatedSlot);
        setDeliverySchedule(prev => prev.map(slot => slot.id === updatedSlot.id ? updatedSlot : slot));
        showNotification('Delivery slot updated!'); // Added notification
    }, [showNotification]);

    const deleteDeliverySlot = useCallback(async (slotId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.DELIVERY_SCHEDULE, slotId);
        setDeliverySchedule(prev => prev.filter(slot => slot.id !== slotId));
        showNotification('Delivery slot removed!', 'error'); // Added notification
    }, [showNotification]);
    
    const addBufferItem = useCallback(async (newItem: Omit<ContainerBufferItem, 'id'>) => {
        const created = await dataService.addDataItem<ContainerBufferItem>(STORAGE_KEYS.CONTAINER_BUFFER, newItem);
        setBuffer(prev => [...prev, created]);
        showNotification('Container added to buffer!');
    }, [showNotification]);

    const updateBufferItem = useCallback(async (updatedItem: ContainerBufferItem) => {
        await dataService.updateDataItem<ContainerBufferItem>(STORAGE_KEYS.CONTAINER_BUFFER, updatedItem);
        setBuffer(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        showNotification('Buffer item updated!');
    }, [showNotification]);
    
    const deleteBufferItem = useCallback(async (itemId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.CONTAINER_BUFFER, itemId);
        setBuffer(prev => prev.filter(item => item.id !== itemId));
        showNotification('Buffer item removed!', 'error');
    }, [showNotification]);

    const addSupplier = useCallback(async (newSupplier: Omit<Supplier, 'id'>) => {
        const created = await dataService.addDataItem<Supplier>(STORAGE_KEYS.SUPPLIERS, newSupplier);
        setSuppliers(prev => [...prev, created]);
        showNotification('Supplier added!');
    }, [showNotification]);

    const updateSupplier = useCallback(async (updatedSupplier: Supplier) => {
        await dataService.updateDataItem<Supplier>(STORAGE_KEYS.SUPPLIERS, updatedSupplier);
        setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
        showNotification('Supplier updated!');
    }, [showNotification]);
    
    const deleteSupplier = useCallback(async (supplierId: string) => {
        await dataService.deleteDataItem(STORAGE_KEYS.SUPPLIERS, supplierId);
        setSuppliers(prev => prev.filter(s => s.id !== supplierId));
        showNotification('Supplier deleted!', 'error');
    }, [showNotification]);
    
    const addInvoice = useCallback(async (newInvoice: Omit<Invoice, 'id'>) => {
        const created = await dataService.addDataItem<Invoice>(STORAGE_KEYS.INVOICES, newInvoice);
        setInvoices(prev => [...prev, created]);
        showNotification('Invoice created successfully!');
        return created; // Return created invoice for potential chaining
    }, [showNotification]);

    const updateInvoice = useCallback(async (updatedInvoice: Invoice) => {
        await dataService.updateDataItem<Invoice>(STORAGE_KEYS.INVOICES, updatedInvoice);
        setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
        showNotification('Invoice updated!');
    }, [showNotification]);

    const addPayment = useCallback(async (newPayment: Omit<Payment, 'id'>) => {
        const created = await dataService.addDataItem<Payment>(STORAGE_KEYS.PAYMENTS, newPayment);
        setPayments(prev => [...prev, created]);
        showNotification('Payment recorded!');

        // Optional: Update the linked invoice's paid/outstanding amounts
        if (newPayment.invoiceId) {
            const linkedInvoice = invoices.find(inv => inv.id === newPayment.invoiceId);
            if (linkedInvoice) {
                const updatedInvoice = {
                    ...linkedInvoice,
                    paidAmount: (linkedInvoice.paidAmount || 0) + newPayment.amountPaid,
                    outstandingAmount: (linkedInvoice.totalAmount || 0) - ((linkedInvoice.paidAmount || 0) + newPayment.amountPaid), // Corrected calculation
                    paymentIds: [...(linkedInvoice.paymentIds || []), created.id], // Add new payment ID
                    status: (linkedInvoice.totalAmount <= ((linkedInvoice.paidAmount || 0) + newPayment.amountPaid)) ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid
                };
                await dataService.updateDataItem<Invoice>(STORAGE_KEYS.INVOICES, updatedInvoice);
                setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
            }
        }
        return created;
    }, [showNotification, invoices]); // Dependency on invoices to update linked data
    
    // --- Contract Handlers ---
    const addContract = useCallback(async (newContract: Omit<Contract, 'id'>): Promise<Contract> => {
        const created = await dataService.addDataItem<Contract>(STORAGE_KEYS.CONTRACTS, newContract);
        setContracts(prev => [...prev, created]);
        return created;
    }, []);

    const updateContract = useCallback(async (updatedContract: Contract): Promise<void> => {
        await dataService.updateDataItem<Contract>(STORAGE_KEYS.CONTRACTS, updatedContract);
        setContracts(prev => prev.map(c => c.id === updatedContract.id ? updatedContract : c));
    }, []);

    const deleteContract = useCallback(async (id: string): Promise<void> => {
        await dataService.deleteDataItem(STORAGE_KEYS.CONTRACTS, id);
        setContracts(prev => prev.filter(c => c.id !== id));
    }, []);

    // --- PDCA Handlers ---
    const addPdcaItem = useCallback(async (newItem: Omit<PDCAItem, 'id'>): Promise<PDCAItem> => {
        const created = await dataService.addDataItem<PDCAItem>(STORAGE_KEYS.PDCA_ITEMS, newItem);
        setPdcaItems(prev => [...prev, created]);
        return created;
    }, []);

    const updatePdcaItem = useCallback(async (updatedItem: PDCAItem): Promise<void> => {
        await dataService.updateDataItem<PDCAItem>(STORAGE_KEYS.PDCA_ITEMS, updatedItem);
        setPdcaItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }, []);

    const deletePdcaItem = useCallback(async (id: string): Promise<void> => {
        await dataService.deleteDataItem(STORAGE_KEYS.PDCA_ITEMS, id);
        setPdcaItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const handleAdminAuthSuccess = () => {
        setIsAdminAuthOpen(false);
        if(adminAuthCallback) adminAuthCallback();
    };
    
    const updateProcedures = useCallback(async (updatedProcedures: Procedure[]) => {
      await dataService.updateData<Procedure[]>(STORAGE_KEYS.PROCEDURES, updatedProcedures);
      setProcedures(updatedProcedures);
      showNotification('Procedures updated!');
    }, [showNotification]);

    const handleUpdateLogo = (logoDataUrl: string | null) => setCompanyLogo(logoDataUrl);

    if (isLoadingData) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-brand-light dark:bg-brand-primary">
                <div className="text-center">
                    {companyLogo && <img src={companyLogo} alt="Company Logo" className="max-h-20 mx-auto mb-6" />}
                    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto"></div>
                    <p className="mt-4 text-lg font-semibold text-brand-gray-500 dark:text-white">Loading IntelliTrade BR...</p>
                </div>
            </div>
        );
    }
    
    if (!currentUser) {
        return <LoginScreen users={users} onLogin={login} theme={theme} setTheme={setTheme} companyLogo={companyLogo} />;
    }

    // NavItem component memoized for performance and Dreamweaver-style polish
    const NavItem: React.FC<{ to: string; icon: React.ReactNode; tKey: keyof typeof translations.en; onClick?: (e: React.MouseEvent) => void; isSub?: boolean; }> = memo(({ to, icon, tKey, onClick, isSub }) => (
        <NavLink
            to={to}
            end={to === "/"}
            onClick={(e) => {
                if(onClick) { e.preventDefault(); onClick(e); }
                setMobileSidebarOpen(false); // Close mobile sidebar on navigation
            }}
            className={({ isActive }) =>
                `flex items-center p-3 my-1 rounded-lg transition-all duration-200 ease-in-out hover:translate-x-1 ${ isSub ? 'pl-10' : '' } ${
                isActive
                    ? 'bg-brand-highlight text-brand-primary font-bold shadow-inner' // Active state with inner shadow
                    : 'text-gray-200 hover:bg-brand-accent hover:text-white'
                }`
            }
        >
            {icon}
            {(sidebarOpen || isMobileSidebarOpen) && <span className="ml-4">{t(tKey)}</span>}
        </NavLink>
    ));
    
    // NavGroup component for sector organization
    const NavGroup: React.FC<{ titleKey: keyof typeof translations.en; sidebarOpen: boolean; isMobile: boolean; icon: React.ReactNode; children: React.ReactNode; }> = ({ titleKey, sidebarOpen, isMobile, icon, children }) => (
        <div>
            {(sidebarOpen || isMobile) ? (
                <div className="flex items-center gap-2 px-3 pt-4 pb-1 text-xs font-semibold text-brand-gray-200 uppercase tracking-wider">
                    {icon}
                    <span>{t(titleKey)}</span>
                </div>
            ) : (
                <hr className="my-2 border-brand-accent/30" /> // Separator when sidebar is collapsed
            )}
            {children}
        </div>
    );

    // Header component for top navigation and global controls
    const Header: React.FC<{globalDate: string, setGlobalDate: (date: string) => void, theme: 'light' | 'dark', setTheme: (theme: 'light' | 'dark') => void}> = ({ globalDate, setGlobalDate, theme, setTheme }) => {
        const location = useLocation();
        const navigate = useNavigate();
        const [dropdownOpen, setDropdownOpen] = useState(false);
        const { t, language, setLanguage } = useTranslation();

        // Function to get the current page title based on route
        const getTitle = () => {
            const path = location.pathname.toLowerCase();
            if (path === '/') return t('dashboard');
            if (path.startsWith('/imports/new')) return t('newImport');
            if (path.startsWith('/imports/edit')) return t('editImport');
            if (path.startsWith('/imports/')) return t('importDetails');
            if (path.startsWith('/imports')) return t('allImports');
            if (path.startsWith('/fast-input')) return t('fastInput');
            if (path.startsWith('/di-status')) return t('diStatus');
            if (path.startsWith('/process-tracking')) return t('processTracking');
            if (path.startsWith('/projects')) return t('projects');
            if (path.startsWith('/container-control')) return t('containerControl');
            if (path.startsWith('/delivery-schedule')) return t('deliveryWindow');
            if (path.startsWith('/buffer')) return t('containerBuffer');
            if (path.startsWith('/vessel-schedule')) return t('shipSchedule');
            if (path.startsWith('/demurrage-control')) return t('demurrageControl');
            if (path.startsWith('/packing-list')) return t('packingList');
            if (path.startsWith('/payments')) return t('payments');
            if (path.startsWith('/contracts')) return t('contracts');
            if (path.startsWith('/cashflow')) return t('cashflow');
            if (path.startsWith('/calculations')) return t('calculations');
            if (path.startsWith('/broker-numerario')) return t('brokerNumerario');
            if (path.startsWith('/claims')) return t('claims');
            if (path.startsWith('/supplier-evaluation')) return t('supplierEvaluation');
            if (path.startsWith('/supplier-management')) return t('supplierManagement');
            if (path.startsWith('/reports')) return t('reports');
            if (path.startsWith('/ncm-management')) return t('ncmManagement');
            if (path.startsWith('/workflow')) return t('workflow');
            if (path.startsWith('/procedures')) return t('procedures');
            if (path.startsWith('/pdca')) return t('pdca');
            if (path.startsWith('/alerts')) return t('alerts');
            if (path.startsWith('/summary')) return t('smartSummary');
            if (path.startsWith('/users')) return t('userManagement');
            if (path.startsWith('/machine-learn')) return t('machineLearning');
            if (path.startsWith('/profile')) return t('companyProfile');
            if (path.startsWith('/backup')) return t('systemBackup');
            return 'IntelliTrade BR'; // Default title
        };

        // Effect to close dropdown when clicking outside
        useEffect(() => {
            const closeDropdown = () => setDropdownOpen(false);
            if (dropdownOpen) window.addEventListener('click', closeDropdown);
            return () => window.removeEventListener('click', closeDropdown);
        }, [dropdownOpen]);

        // Function to toggle language
        const handleLanguageToggle = () => {
            setLanguage(language === 'en' ? 'zh' : 'en');
        };

        return (
            <header className="bg-white dark:bg-brand-secondary shadow-sm p-4 flex justify-between items-center text-brand-gray-500 dark:text-gray-200">
                <div className="flex items-center">
                    {/* Mobile sidebar toggle button */}
                    <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden mr-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-accent">
                        <Menu size={24} />
                    </button>
                    {/* Page Title */}
                    <h1 className="text-2xl font-bold text-brand-gray-500 dark:text-white">{getTitle()}</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* Global Date Picker */}
                    <div className="items-center gap-2 hidden lg:flex">
                        <CalendarIcon size={16} className="text-brand-gray-500 dark:text-gray-400"/>
                        <label htmlFor="global-date-picker" className="text-sm font-medium text-brand-gray-500 dark:text-gray-400">Global Date:</label>
                        <input
                            id="global-date-picker"
                            type="date"
                            value={globalDate}
                            onChange={(e) => setGlobalDate(e.target.value)}
                            className="p-1 border dark:border-brand-accent rounded-md text-sm bg-white dark:bg-brand-primary text-brand-gray-500 dark:text-gray-200"
                        />
                    </div>

                    {/* Language Toggle */}
                    <button onClick={handleLanguageToggle} className="hidden md:flex items-center gap-1.5 text-brand-gray-500 dark:text-gray-400 hover:text-brand-gray-500 dark:hover:text-white text-sm font-semibold p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-accent">
                        <Languages size={20} />
                        EN / 中文
                    </button>
                    
                    {/* Theme Toggle */}
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full text-brand-gray-500 dark:text-gray-400 hover:text-brand-gray-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-accent">
                        {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
                    </button>

                    {/* Alerts/Notifications Button */}
                    <button onClick={() => navigate('/alerts')} className="relative text-brand-gray-500 dark:text-gray-400 hover:text-brand-gray-500 dark:hover:text-white">
                        <Bell size={24} />
                        {/* Notification indicator - replace with actual count from state later */}
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                    </button>
                    {/* User Profile Dropdown */}
                    <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen);}} className="w-10 h-10 rounded-full bg-brand-secondary flex items-center justify-center text-white font-bold">
                            {currentUser.initials}
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-brand-secondary rounded-md shadow-lg py-1 z-20 border dark:border-brand-accent">
                                <div className="px-4 py-2 text-sm text-brand-gray-500 dark:text-gray-300 border-b dark:border-brand-accent">
                                    <p className="font-semibold">{currentUser.name}</p>
                                    <p className="text-xs text-brand-gray-400 dark:text-gray-400">{currentUser.role}</p>
                                </div>
                                <a href="#" onClick={logout} className="block px-4 py-2 text-sm text-brand-gray-500 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-brand-accent">Logout</a>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        );
    }

    // AdminWrapper component for routes requiring admin authentication
    const AdminWrapper: React.FC<{children: React.ReactNode; to: string; icon: React.ReactNode;}> = ({children, to, icon}) => {
        const navigate = useNavigate();
        const handleAdminAccess = () => {
            setAdminAuthCallback(() => () => navigate(to)); // Set callback to navigate after auth success
            setIsAdminAuthOpen(true); // Open admin auth modal
        };
        return (
            <NavItem to={to} icon={icon} onClick={handleAdminAccess} tKey={children as keyof typeof translations.en} />
        )
    }

    return (
        <>
            {/* Admin Authentication Modal */}
            <AdminAuthModal 
                isOpen={isAdminAuthOpen}
                onClose={() => setIsAdminAuthOpen(false)}
                onSuccess={handleAdminAuthSuccess}
            />
            {/* Main Application Layout */}
            <div className="flex h-screen bg-brand-light dark:bg-brand-gray-500 text-brand-secondary dark:text-brand-light">
                {/* Mobile Sidebar Overlay */}
                <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden ${isMobileSidebarOpen ? 'block' : 'hidden'}`} onClick={() => setMobileSidebarOpen(false)}></div>
                {/* Sidebar */}
                <aside className={`fixed lg:relative inset-y-0 left-0 bg-brand-primary text-white w-64 transform ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-40 flex flex-col`}>
                    <div className="flex items-center justify-between p-4 border-b border-brand-accent/30">
                        {/* Company Logo or App Title */}
                        {companyLogo ? (
                            <img src={companyLogo} alt="Company Logo" className="max-h-12" />
                        ) : (
                            <h1 className="text-2xl font-bold">IntelliTrade</h1>
                        )}
                        {/* Mobile sidebar close button */}
                        <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-2 text-white rounded-lg hover:bg-brand-accent">
                            <X size={24} />
                        </button>
                    </div>
                    {/* Navigation Menu */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        <NavItem to="/" icon={<Home size={20} />} tKey="dashboard" />
                        
                        {/* Broker Operations Sector */}
                        <NavGroup titleKey="broker" icon={<Receipt size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/imports" icon={<FileText size={20} />} tKey="allImports" />
                            <NavItem to="/imports/new" icon={<PlusCircle size={20} />} tKey="newImport" />
                            <NavItem to="/fast-input" icon={<UploadCloud size={20} />} tKey="fastInput" />
                            <NavItem to="/di-status" icon={<FileBadge size={20} />} tKey="diStatus" />
                            <NavItem to="/broker-numerario" icon={<Receipt size={20} />} tKey="brokerNumerario" />
                        </NavGroup>

                        {/* Logistics & Supply Chain Sector */}
                        <NavGroup titleKey="logistics" icon={<Container size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/process-tracking" icon={<GanttChartSquare size={20} />} tKey="processTracking" />
                            <NavItem to="/container-control" icon={<Container size={20} />} tKey="containerControl" />
                            <NavItem to="/delivery-schedule" icon={<CalendarClock size={20} />} tKey="deliveryWindow" />
                            <NavItem to="/buffer" icon={<HandPlatter size={20} />} tKey="containerBuffer" />
                            <NavItem to="/vessel-schedule" icon={<Anchor size={20} />} tKey="shipSchedule" />
                            <NavItem to="/demurrage-control" icon={<TimerOff size={20} />} tKey="demurrageControl" />
                            <NavItem to="/packing-list" icon={<PackageCheck size={20} />} tKey="packingList" />
                            <NavItem to="/supplier-management" icon={<Users size={20} />} tKey="supplierManagement" /> {/* Often shared with logistics */}
                        </NavGroup>

                        {/* Financial Operations Sector */}
                        <NavGroup titleKey="financial" icon={<DollarSign size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/payments" icon={<DollarSign size={20} />} tKey="payments" /> {/* Now Invoices & Payments */}
                            <NavItem to="/contracts" icon={<ClipboardCheck size={20} />} tKey="contracts" />
                            <NavItem to="/cashflow" icon={<TrendingUp size={20} />} tKey="cashflow" />
                            <NavItem to="/calculations" icon={<Calculator size={20} />} tKey="calculations" />
                            <NavItem to="/supplier-evaluation" icon={<Handshake size={20} />} tKey="supplierEvaluation" />
                        </NavGroup>
                        
                        {/* Claims Management Sector */}
                        <NavGroup titleKey="claims" icon={<FileWarning size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/claims" icon={<FileWarning size={20} />} tKey="claims" />
                        </NavGroup>

                        {/* Projects Sector (Can remain cross-functional) */}
                        <NavGroup titleKey="projects" icon={<FolderOpen size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/projects" icon={<GanttChart size={20} />} tKey="projects" />
                        </NavGroup>

                        {/* Tools & Administration Sector */}
                        <NavGroup titleKey="tools" icon={<BarChart2 size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                            <NavItem to="/reports" icon={<BarChart2 size={20} />} tKey="reports" />
                            <NavItem to="/ncm-management" icon={<BookCopy size={20} />} tKey="ncmManagement" />
                            <NavItem to="/workflow" icon={<Trello size={20} />} tKey="workflow" />
                            <NavItem to="/procedures" icon={<BookText size={20} />} tKey="procedures" />
                            <NavItem to="/pdca" icon={<RefreshCw size={20} />} tKey="pdca" />
                            <NavItem to="/alerts" icon={<ShieldAlert size={20} />} tKey="alerts" />
                        </NavGroup>

                        {/* Admin Sector (Conditional Rendering) */}
                        {currentUser.role === 'Admin' && (
                            <NavGroup titleKey="admin" icon={<Users size={14} />} sidebarOpen={sidebarOpen} isMobile={isMobileSidebarOpen}>
                                <AdminWrapper to="/summary" icon={<Sparkles size={20} />}>smartSummary</AdminWrapper>
                                <AdminWrapper to="/users" icon={<Users size={20} />}>userManagement</AdminWrapper>
                                <AdminWrapper to="/machine-learn" icon={<Brain size={20} />}>machineLearning</AdminWrapper>
                                <AdminWrapper to="/profile" icon={<Building2 size={20} />}>companyProfile</AdminWrapper>
                                <AdminWrapper to="/backup" icon={<History size={20} />}>systemBackup</AdminWrapper>
                            </NavGroup>
                        )}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Header globalDate={globalDate} setGlobalDate={setGlobalDate} theme={theme} setTheme={setTheme} />
                    <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-y-auto bg-brand-light dark:bg-brand-gray-500">
                        <Routes>
                            {/* Dashboard */}
                            <Route path="/" element={<Dashboard imports={imports} claims={claims} exchangeRates={exchangeRates} setExchangeRates={setExchangeRates} ratesLoading={ratesLoading} ratesError={ratesError} theme={theme} companyLogo={companyLogo} tasks={tasks} currentUser={currentUser} />} />
                            
                            {/* Broker Operations Routes */}
                            <Route path="/imports" element={<ImportList imports={imports} users={users} deleteImport={deleteImport} currentUser={currentUser} globalDate={globalDate} claims={claims} />} />
                            <Route path="/imports/new" element={<ImportForm onSave={addImport} currentUser={currentUser} />} />
                            <Route path="/imports/:id/edit" element={<ImportForm imports={imports} onSave={updateImport} currentUser={currentUser}/>} />
                            <Route path="/imports/:id" element={<ImportDetail imports={imports} users={users} updateImport={updateImport} currentUser={currentUser} exchangeRates={exchangeRates} />} />
                            <Route path="/fast-input" element={<FastInput onConfirm={addMultipleImports} currentUser={currentUser} />} />
                            <Route path="/di-status" element={<DeclarationDIStatusManagement imports={imports} updateImport={updateImport} currentUser={currentUser} globalDate={globalDate} />} />
                            <Route path="/broker-numerario" element={<BrokerNumerario imports={imports} updateImport={updateImport} currentUser={currentUser}/>} />
                            
                            {/* Logistics & Supply Chain Routes */}
                            <Route path="/process-tracking" element={<ProcessTracking imports={imports} updateImport={updateImport} currentUser={currentUser} />} />
                            <Route path="/container-control" element={<ContainerControl imports={imports} />} />
                            <Route path="/delivery-schedule" element={<ContainerDeliveryWindow imports={imports} schedule={deliverySchedule} onAddSlot={addDeliverySlot} onUpdateSlot={updateDeliverySlot} onDeleteSlot={deleteDeliverySlot} />} />
                            <Route path="/buffer" element={<ContainerBuffer imports={imports} buffer={buffer} onAddBuffer={addBufferItem} onUpdateBuffer={updateBufferItem} onDeleteBuffer={deleteBufferItem} currentUser={currentUser} />} />
                            <Route path="/vessel-schedule" element={<VesselSchedule theme={theme} globalDate={globalDate} />} />
                            <Route path="/demurrage-control" element={<DemurrageControl imports={imports} updateImport={updateImport} />} />
                            <Route path="/packing-list" element={<PackingList imports={imports} updateImport={updateImport} companyLogo={companyLogo} globalDate={globalDate} />} />
                            <Route path="/supplier-management" element={<SupplierManagement suppliers={suppliers} onAdd={addSupplier} onUpdate={updateSupplier} onDelete={deleteSupplier} />} />
                            
                            {/* Financial Operations Routes */}
                            <Route path="/payments" element={<InvoiceManagement suppliers={suppliers} invoices={invoices} payments={payments} onAddInvoice={addInvoice} onUpdateInvoice={updateInvoice} onAddPayment={addPayment} currentUser={currentUser} />} />
                            <Route path="/contracts" element={<Contracts contracts={contracts} imports={imports} suppliers={suppliers} onAddContract={addContract} onUpdateContract={updateContract} onDeleteContract={deleteContract} showNotification={showNotification} />} />
                            <Route path="/cashflow" element={<CashFlow imports={imports} theme={theme} exchangeRates={exchangeRates} />} />
                            <Route path="/calculations" element={<Calculations imports={imports} ncms={ncms} exchangeRates={exchangeRates} ratesLoading={ratesLoading} />} />
                            <Route path="/supplier-evaluation" element={<SupplierEvaluation imports={imports} claims={claims} exchangeRates={exchangeRates} />} />

                            {/* Claims Management Routes */}
                            <Route path="/claims" element={<Claims claims={claims} imports={imports} onAddClaim={addClaim} onUpdateClaim={updateClaim} currentUser={currentUser} onAddMultipleClaims={addMultipleClaims} />} />

                            {/* Projects Routes */}
                            <Route path="/projects" element={<Projects projects={projects} setProjects={(data) => { setProjects(data); dataService.updateData(STORAGE_KEYS.PROJECTS, data); }} />} />
                            
                            {/* Tools & Administration Routes */}
                            <Route path="/reports" element={<Reports imports={imports} claims={claims} ncms={ncms} tasks={tasks} deliverySchedule={deliverySchedule} buffer={buffer} users={users} />} />
                            <Route path="/ncm-management" element={<NCMManagement ncms={ncms} onAddNcm={addNcm} onUpdateNcm={updateNcm} onDeleteNcm={deleteNcm} currentUser={currentUser} />} />
                            <Route path="/workflow" element={<WorkflowCRM tasks={tasks} users={users} imports={imports} onAddTask={addTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} />} />
                            <Route path="/procedures" element={<ProceduresManagement procedures={procedures} onUpdateProcedures={updateProcedures} currentUser={currentUser} />} />
                            <Route path="/pdca" element={<PDCA pdcaItems={pdcaItems} imports={imports} users={users} onAddPdcaItem={addPdcaItem} onUpdatePdcaItem={updatePdcaItem} onDeletePdcaItem={deletePdcaItem} showNotification={showNotification} />} />
                            <Route path="/alerts" element={<Alerts imports={imports} invoices={invoices} tasks={tasks} users={users} />} />
                            
                            {/* Admin Routes */}
                            <Route path="/summary" element={<SmartSummary imports={imports} claims={claims} tasks={tasks} />} />
                            <Route path="/users" element={<UserManagement users={users} onAddUser={addUser} onAddMultipleUsers={addMultipleUsers} onSaveUser={updateUser} />} />
                            <Route path="/machine-learn" element={<MachineLearn />} />
                            <Route path="/profile" element={<CompanyProfile companyLogo={companyLogo} onLogoUpload={handleUpdateLogo} />} />
                            <Route path="/backup" element={<SystemBackup currentUser={currentUser} dataToBackup={{imports, users, claims, ncms, tasks, deliverySchedule, buffer, procedures, companyLogo, suppliers, projects, invoices, payments}} />} />
                        </Routes>
                    </div>
                </main>
            </div>
            {/* Global Notification Display */}
            {notification && (
                <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-lg animate-fade-in-down flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
                    {notification.type === 'success' ? <CheckCircleIcon size={20} /> : <AlertCircle size={20} />}
                    <span>{notification.message}</span>
                </div>
            )}
        </>
    );
};