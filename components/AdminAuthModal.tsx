// src/components/AdminAuthModal.tsx

import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert, LogIn, X, Loader2 } from 'lucide-react'; // Added Loader2 for a better spinner

interface AdminAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// WARNING: Hardcoded password for development only. Use a secure backend authentication system in production.
const ADMIN_PASSWORD = '123456'; 

const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // A slight delay ensures the modal is fully rendered before attempting to focus
            setTimeout(() => passwordInputRef.current?.focus(), 100); 
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleAuthenticate = async () => {
        setLoading(true);
        setError('');
        
        // Simulate network delay for a smoother user experience
        await new Promise(res => setTimeout(res, 700)); // Increased delay for more realistic feel

        if (password === ADMIN_PASSWORD) {
            setError('');
            setPassword(''); // Clear password on success
            onSuccess();
        } else {
            setError('Invalid administrator password. Please try again.');
        }
        
        setLoading(false);
    };
    
    const handleClose = () => {
        setError('');
        setPassword(''); // Clear password on close
        setLoading(false); // Ensure loading state is reset
        onClose();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !loading) {
            handleAuthenticate();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in-down"
            onClick={handleClose}
            role="dialog" // ARIA role for dialog
            aria-modal="true" // ARIA attribute for modal
            aria-labelledby="admin-auth-title" // Links to the h2 for accessibility
        >
            <div 
                className="bg-white dark:bg-brand-secondary rounded-xl shadow-2xl w-full max-w-md transform transition-all animate-scale-in"
                onClick={e => e.stopPropagation()} // Prevents closing when clicking inside the modal
            >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <ShieldAlert size={24} className="text-brand-accent" />
                        <h2 id="admin-auth-title" className="text-lg font-bold text-brand-primary dark:text-white">Admin Access Required</h2>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-accent transition-colors duration-200" 
                        disabled={loading} // Disable close button during authentication
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Please enter the administrator password to access this restricted area. 
                        {/* !!! REMOVE THIS HINT IN PRODUCTION !!! */}
                        <span className="text-xs text-brand-accent font-semibold ml-1">(Hint: '123456')</span> 
                    </p>
                    <div>
                        <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Administrator Password
                        </label>
                        <input
                            id="admin-password"
                            ref={passwordInputRef} // Attach ref for focus
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            className={`block w-full px-3 py-2 bg-white dark:bg-brand-primary border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent sm:text-sm text-gray-900 dark:text-gray-200 ${error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-brand-accent'}`}
                        />
                        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-gray-50 dark:bg-brand-primary/50 flex justify-end gap-3 rounded-b-xl"> {/* Added rounded-b-xl for consistency */}
                    <button 
                        onClick={handleClose} 
                        type="button" 
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-brand-accent transition-colors duration-200" 
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAuthenticate} 
                        type="button" 
                        className="px-4 py-2 bg-brand-secondary text-white rounded-lg flex items-center justify-center gap-2 hover:bg-brand-accent transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed w-36" 
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> 
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={16} /> 
                                <span>Authenticate</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminAuthModal;
