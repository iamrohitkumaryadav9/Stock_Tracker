'use client';
import { useEffect, useRef, useState } from "react";

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hasError, setHasError] = useState(false);
    const elementsRef = useRef<{ script?: HTMLScriptElement; widget?: HTMLDivElement; errorDiv?: HTMLDivElement }>({});

    useEffect(() => {
        if (!containerRef.current) return;
        
        // Validate script URL
        if (!scriptUrl || typeof scriptUrl !== 'string' || !scriptUrl.startsWith('http')) {
            console.error('Invalid TradingView script URL:', scriptUrl);
            setHasError(true);
            return;
        }
        
        const container = containerRef.current;
        
        // Clean up any existing elements first
        if (elementsRef.current.script && container.contains(elementsRef.current.script)) {
            try {
                container.removeChild(elementsRef.current.script);
            } catch (e) {
                // Element may have already been removed
            }
        }
        if (elementsRef.current.widget && container.contains(elementsRef.current.widget)) {
            try {
                container.removeChild(elementsRef.current.widget);
            } catch (e) {
                // Element may have already been removed
            }
        }
        if (elementsRef.current.errorDiv && container.contains(elementsRef.current.errorDiv)) {
            try {
                container.removeChild(elementsRef.current.errorDiv);
            } catch (e) {
                // Element may have already been removed
            }
        }
        
        // Reset refs
        elementsRef.current = {};
        setHasError(false);
        
        // Clear container and set up the structure TradingView expects
        container.innerHTML = '';
        
        // Create the widget container div - TradingView expects this structure
        // This MUST exist before the script runs
        const widgetContainer = document.createElement("div");
        widgetContainer.className = "tradingview-widget-container__widget";
        widgetContainer.style.width = "100%";
        widgetContainer.style.height = `${height}px`;
        container.appendChild(widgetContainer);
        elementsRef.current.widget = widgetContainer;

        // Create and configure the script
        // TradingView embed widgets expect the script as a child of the container
        // The script uses document.currentScript to find itself, so we need to ensure
        // it can access currentScript. Using async=false or defer helps, but
        // the script must be in the DOM before it executes.
        const script = document.createElement("script");
        script.src = scriptUrl;
        // Set async to false so document.currentScript works
        // TradingView scripts need currentScript to find their container
        script.async = false;
        script.type = "text/javascript";
        
        // TradingView embed widgets read config from script's innerHTML as JSON
        script.innerHTML = JSON.stringify(config);
        elementsRef.current.script = script;
        
        // Set a timeout to detect connection issues (declare before error handler)
        let timeoutId: NodeJS.Timeout;
        let scriptLoadStarted = false;
        
        // Global error listener to catch script errors that might not trigger onerror
        const globalErrorHandler = (event: ErrorEvent) => {
            // Only handle errors related to our script
            if (event.filename && event.filename.includes('tradingview.com')) {
                console.error('Global error handler caught TradingView script error:', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            }
        };
        
        // Add global error listener
        window.addEventListener('error', globalErrorHandler, true);
        
        // Handle script load errors (set up BEFORE appending to DOM)
        script.onerror = (event: ErrorEvent | Event) => {
            // Extract error details with safe property access (declare outside try for scope)
            let errorMessage = 'Script failed to load';
            let errorType = 'error';
            let errorTarget = scriptUrl;
            
            try {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                // Remove global error handler since we've caught the error
                window.removeEventListener('error', globalErrorHandler, true);
                
                try {
                    if (event instanceof ErrorEvent) {
                        errorMessage = event.message || errorMessage;
                        errorType = event.type || errorType;
                    }
                    if (event.target) {
                        const target = event.target as HTMLScriptElement;
                        errorTarget = target.src || scriptUrl;
                    }
                } catch (e) {
                    // Ignore property access errors
                }
                
                // Build error info with only serializable properties
                const errorInfo: Record<string, unknown> = {
                    scriptUrl: String(scriptUrl),
                    actualSrc: String(script.src),
                    errorMessage: String(errorMessage),
                    errorType: String(errorType),
                    errorTarget: String(errorTarget),
                    readyState: String(script.readyState || 'unknown'),
                    timestamp: new Date().toISOString(),
                };
                
                // Safely extract network error details
                if (event instanceof ErrorEvent) {
                    try {
                        errorInfo.filename = event.filename || null;
                        errorInfo.lineno = event.lineno || null;
                        errorInfo.colno = event.colno || null;
                    } catch (e) {
                        // Ignore
                    }
                }
                
                // Check if we're in development/localhost
                const isLocalhost = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' ||
                                   window.location.hostname === '0.0.0.0';
                
                // Log with JSON.stringify to ensure proper serialization
                if (isLocalhost) {
                    // In development, log a concise message since 403 is expected
                    console.warn('⚠️ TradingView widget blocked in development (403 Forbidden)');
                    console.warn('This is expected - TradingView blocks localhost requests for security.');
                    console.warn('Widgets will work correctly in production. Script URL:', scriptUrl);
                } else {
                    // In production, log detailed error information
                    console.error('TradingView widget script failed to load');
                    console.error('Error details:', JSON.stringify(errorInfo, null, 2));
                    console.error('Script URL:', scriptUrl);
                    console.error('Script src:', script.src);
                    console.error('Script readyState:', script.readyState);
                    console.error('Event type:', event?.type || 'unknown');
                    console.error('Event target:', event?.target || 'none');
                }
                
                // Try to fetch the script URL to diagnose the issue (only in production)
                if (!isLocalhost) {
                    // Use 'cors' mode to see the actual status code
                    fetch(scriptUrl, { method: 'HEAD', mode: 'cors', credentials: 'omit' })
                        .then((response) => {
                            if (response.status === 403) {
                                console.error('TradingView returned 403 Forbidden - This may be due to:');
                                console.error('1. Missing or incorrect Referer header');
                                console.error('2. CORS policy restrictions');
                                console.error('3. Rate limiting or IP blocking');
                                console.error('Response status:', response.status);
                                console.error('Response headers:', Object.fromEntries(response.headers.entries()));
                            } else if (response.ok) {
                                console.warn('Script URL is accessible, but script failed to execute');
                            } else {
                                console.error('Script URL returned status:', response.status);
                            }
                        })
                        .catch((fetchError) => {
                            console.error('Script URL fetch test failed:', String(fetchError));
                            // If it's a CORS error, that's expected for cross-origin requests
                            if (fetchError instanceof TypeError && fetchError.message.includes('CORS')) {
                                console.warn('CORS error is expected for cross-origin requests');
                            }
                        });
                }
            } catch (handlerError) {
                // Fallback error logging if the handler itself fails
                console.error('Error in TradingView widget error handler:', String(handlerError));
                console.error('Script URL:', scriptUrl);
            }
            
            // Set error state and show error UI (outside try-catch so it always runs)
            setHasError(true);
            if (container && elementsRef.current.widget) {
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const errorDiv = document.createElement("div");
                errorDiv.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: " + height + "px; padding: 20px; text-align: center; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;";
                errorDiv.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="color: #DBDBDB; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Unable to Load Widget</h3>
                    <p style="color: #9095A1; font-size: 14px; margin-bottom: 12px;">Failed to connect to TradingView servers (403 Forbidden).</p>
                    ${isLocalhost ? `
                        <p style="color: #FBBF24; font-size: 13px; margin-bottom: 8px; font-weight: 500;">⚠️ Development Environment Detected</p>
                        <p style="color: #9095A1; font-size: 12px; margin-bottom: 8px;">TradingView widgets often block requests from localhost/127.0.0.1 for security reasons.</p>
                        <p style="color: #9095A1; font-size: 12px; margin-bottom: 8px;">This is expected behavior and widgets should work correctly in production.</p>
                        <p style="color: #60A5FA; font-size: 11px; margin-top: 12px;">💡 Tip: Test with a production build or use a tool like ngrok to expose your local server.</p>
                    ` : `
                        <p style="color: #9095A1; font-size: 12px; margin-bottom: 8px;">This may be due to CORS restrictions, rate limiting, or IP blocking.</p>
                        <p style="color: #9095A1; font-size: 12px; margin-bottom: 8px;">Please check your network connection and try again later.</p>
                    `}
                    <p style="color: #60666E; font-size: 11px; font-family: monospace; word-break: break-all; max-width: 90%; margin-top: 12px;">URL: ${scriptUrl}</p>
                    <p style="color: #60666E; font-size: 10px; margin-top: 8px;">Error: ${errorMessage || '403 Forbidden'}</p>
                    <p style="color: #60666E; font-size: 10px; margin-top: 4px;">Check browser console (Network tab) for more details</p>
                `;
                
                try {
                    if (container.contains(elementsRef.current.widget)) {
                        container.replaceChild(errorDiv, elementsRef.current.widget);
                        elementsRef.current.errorDiv = errorDiv;
                        elementsRef.current.widget = undefined;
                    }
                } catch (e) {
                    // Ignore replacement errors
                }
            }
        };

        // Set a timeout to detect connection issues
        timeoutId = setTimeout(() => {
            if (script.readyState === 'loading' || !script.readyState) {
                setHasError(true);
                if (container && elementsRef.current.widget) {
                    const errorDiv = document.createElement("div");
                    errorDiv.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: " + height + "px; padding: 20px; text-align: center; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;";
                    errorDiv.innerHTML = `
                        <div style="font-size: 48px; margin-bottom: 16px;">⏱️</div>
                        <h3 style="color: #DBDBDB; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Connection Timeout</h3>
                        <p style="color: #9095A1; font-size: 14px; margin-bottom: 12px;">Unable to load TradingView widget. The request timed out.</p>
                        <p style="color: #9095A1; font-size: 12px;">This may be due to network issues or firewall restrictions.</p>
                    `;
                    
                    try {
                        if (container.contains(elementsRef.current.widget)) {
                            container.replaceChild(errorDiv, elementsRef.current.widget);
                            elementsRef.current.errorDiv = errorDiv;
                            elementsRef.current.widget = undefined;
                        }
                    } catch (e) {
                        // Ignore replacement errors
                    }
                }
            }
        }, 10000); // 10 second timeout

        // Cleanup timeout on successful load
        script.onload = () => {
            clearTimeout(timeoutId);
            window.removeEventListener('error', globalErrorHandler, true);
        };

        // Append script to container AFTER setting up all handlers
        // This ensures handlers are in place before the script starts loading
        scriptLoadStarted = true;
        container.appendChild(script);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('error', globalErrorHandler, true);
            if (container) {
                // Remove elements we created, checking if they still exist
                const elements = elementsRef.current;
                
                if (elements.script && container.contains(elements.script)) {
                    try {
                        container.removeChild(elements.script);
                    } catch (e) {
                        // Already removed
                    }
                }
                
                if (elements.widget && container.contains(elements.widget)) {
                    try {
                        container.removeChild(elements.widget);
                    } catch (e) {
                        // Already removed
                    }
                }
                
                if (elements.errorDiv && container.contains(elements.errorDiv)) {
                    try {
                        container.removeChild(elements.errorDiv);
                    } catch (e) {
                        // Already removed
                    }
                }
                
                elementsRef.current = {};
            }
        };
    }, [scriptUrl, config, height]);

    return { containerRef, hasError };
};

export default useTradingViewWidget;
