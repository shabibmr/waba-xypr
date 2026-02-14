# Authentication Context

Global authentication state management for the XYPR Agent Portal.

## Overview

The `AuthContext` provides centralized authentication state and actions throughout the React application. It handles user login, logout, profile management, and token validation.

## Usage

### 1. Setup (Already Done)

The `AuthProvider` wraps the entire application in `App.jsx`:

```jsx
import { AuthProvider } from './contexts/AuthContext';

function App() {
    return (
        <AuthProvider>
            {/* Your app routes */}
        </AuthProvider>
    );
}
```

### 2. Using the Hook

Import the `useAuth` hook in any component:

```jsx
import useAuth from '../hooks/useAuth';

function MyComponent() {
    const { user, loading, error, isAuthenticated, login, logout } = useAuth();

    if (loading) return <Loader />;
    if (!isAuthenticated) return <Redirect to="/login" />;

    return <div>Hello, {user.name}!</div>;
}
```

## API Reference

### State

- **`user`** (Object | null): Current authenticated user profile
  ```javascript
  {
      user_id: 'uuid',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'agent',
      tenant_id: 'tenant-uuid',
      organization: {
          tenant_name: 'Acme Corp',
          whatsapp: {
              connected: true,
              phone_number: '+1234567890',
              waba_id: 'waba-id'
          }
      }
  }
  ```

- **`loading`** (boolean): True when auth operations are in progress
- **`error`** (string | null): Error message from last auth operation
- **`isAuthenticated`** (boolean): True if user is logged in

### Actions

- **`login()`**: Initiate Genesys OAuth login flow
  ```javascript
  const handleLogin = async () => {
      try {
          await login();
          navigate('/dashboard');
      } catch (err) {
          console.error('Login failed:', err);
      }
  };
  ```

- **`logout()`**: Logout user and clear session
  ```javascript
  const handleLogout = async () => {
      await logout();
      navigate('/login');
  };
  ```

- **`refreshProfile()`**: Reload user profile from server
  ```javascript
  const handleRefresh = async () => {
      try {
          const updatedProfile = await refreshProfile();
          console.log('Profile refreshed:', updatedProfile);
      } catch (err) {
          console.error('Refresh failed:', err);
      }
  };
  ```

- **`updateUser(updates)`**: Update user data in context (optimistic updates)
  ```javascript
  // After updating profile on server
  updateUser({ name: 'New Name' });
  ```

- **`clearError()`**: Clear error state
  ```javascript
  useEffect(() => {
      if (error) {
          // Show error toast
          clearError();
      }
  }, [error, clearError]);
  ```

## Examples

### Protected Component

```jsx
import useAuth from '../hooks/useAuth';

function Dashboard() {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    return (
        <div>
            <h1>Welcome, {user.name}!</h1>
            <p>Organization: {user.organization?.tenant_name}</p>
        </div>
    );
}
```

### Login Page

```jsx
import useAuth from '../hooks/useAuth';

function Login() {
    const { login, loading, error, clearError } = useAuth();

    const handleLogin = async () => {
        clearError();
        try {
            await login();
            navigate('/dashboard');
        } catch (err) {
            // Error is available in context
        }
    };

    return (
        <div>
            {error && <Alert>{error}</Alert>}
            <button onClick={handleLogin} disabled={loading}>
                {loading ? 'Logging in...' : 'Login with Genesys'}
            </button>
        </div>
    );
}
```

### Profile Update

```jsx
import useAuth from '../hooks/useAuth';

function ProfileSettings() {
    const { user, updateUser, refreshProfile } = useAuth();

    const handleSave = async (newData) => {
        // Optimistic update
        updateUser(newData);

        try {
            await api.updateProfile(newData);
            // Refresh to get server state
            await refreshProfile();
        } catch (err) {
            // Revert on error
            await refreshProfile();
        }
    };

    return <form onSubmit={handleSave}>...</form>;
}
```

## Features

### Auto-initialization

On app load, the context automatically:
1. Checks localStorage for existing token
2. Validates token by fetching profile
3. Sets user state if valid
4. Clears auth if invalid

### Token Validation

The context validates tokens on initialization by calling the `/api/agents/profile` endpoint. Invalid tokens are automatically cleared.

### Error Handling

All auth operations handle errors gracefully:
- Network failures
- Invalid credentials
- Token expiry
- Server errors

Errors are stored in the `error` state for UI display.

## Best Practices

1. **Always use `useAuth` hook** instead of importing `authService` directly
2. **Check `loading` state** before rendering auth-dependent UI
3. **Clear errors** after displaying them to users
4. **Use `refreshProfile`** after profile updates on the server
5. **Handle logout** in a user-initiated way (button click, not automatic)

## Future Enhancements

- Auto token refresh before expiry (Task #3)
- Multi-device session management
- Remember me functionality
- Session timeout warnings
