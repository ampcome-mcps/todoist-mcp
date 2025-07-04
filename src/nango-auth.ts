import fetch from 'node-fetch';

export interface NangoCredentials {
    credentials: {
        access_token: string;
        refresh_token?: string;
        expires_at?: string;
        [key: string]: any;
    };
    connectionId: string;
    providerConfigKey: string;
    [key: string]: any;
}

/**
 * Get credentials from Nango
 */
export async function getConnectionCredentials(): Promise<NangoCredentials> {
    const connectionId = process.env.NANGO_CONNECTION_ID;
    const integrationId = process.env.NANGO_INTEGRATION_ID;
    const baseUrl = process.env.NANGO_BASE_URL;
    const secretKey = process.env.NANGO_SECRET_KEY;

    if (!connectionId || !integrationId || !baseUrl || !secretKey) {
        throw new Error('Missing required Nango environment variables: NANGO_CONNECTION_ID, NANGO_INTEGRATION_ID, NANGO_BASE_URL, NANGO_SECRET_KEY');
    }

    const url = `${baseUrl}/connection/${connectionId}`;
    const params = new URLSearchParams({
        provider_config_key: integrationId,
        refresh_token: 'true',
    });

    const headers = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(`${url}?${params}`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get connection credentials: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const credentials = await response.json() as NangoCredentials;
        return credentials;
    } catch (error) {
        console.error('Error fetching Nango credentials:', error);
        throw error;
    }
}

/**
 * Get access token from Nango credentials
 */
export async function getAccessToken(): Promise<string> {
    try {
        const credentials = await getConnectionCredentials();
        const accessToken = credentials.credentials?.access_token;
        
        if (!accessToken) {
            throw new Error('Access token not found in Nango credentials');
        }
        
        return accessToken;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Check if the access token is valid and not expired
 */
export function isTokenExpired(credentials: NangoCredentials): boolean {
    if (!credentials.credentials?.expires_at) {
        return false; // If no expiration info, assume it's still valid
    }
    
    const expiresAt = new Date(credentials.credentials.expires_at);
    const now = new Date();
    
    // Add 5 minute buffer to refresh before actual expiration
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (expiresAt.getTime() - now.getTime()) < bufferTime;
}

/**
 * Refresh the access token if needed
 */
export async function refreshTokenIfNeeded(): Promise<string> {
    try {
        const credentials = await getConnectionCredentials();
        
        if (isTokenExpired(credentials)) {
            console.log('Token is expired or expiring soon, refreshing...');
            // The refresh_token: 'true' parameter in getConnectionCredentials
            // should handle the refresh automatically
            const newCredentials = await getConnectionCredentials();
            return newCredentials.credentials.access_token;
        }
        
        return credentials.credentials.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}
