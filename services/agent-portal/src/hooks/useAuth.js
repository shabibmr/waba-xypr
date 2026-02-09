import { useContext } from 'react';
import AuthContext from '../contexts/AuthContext';

/**
 * Custom hook to access authentication context
 * @returns {Object} Auth context value with user, loading, error, and auth methods
 * @throws {Error} If used outside AuthProvider
 */
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};

export default useAuth;
