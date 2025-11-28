'use client';
import { useEffect, useRef, useState } from "react";

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hasError, setHasError] = useState(false);
    const elementsRef = useRef<{ script?: HTMLScriptElement; widget?: HTMLDivElement; errorDiv?: HTMLDivElement }>({});

    useEffect(() => {
        if (!containerRef.current) return;
        
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
        
        // Create the widget container div - TradingView expects this structure
        const widgetContainer = document.createElement("div");
        widgetContainer.className = "tradingview-widget-container__widget";
        widgetContainer.style.width = "100%";
        widgetContainer.style.height = `${height}px`;
        container.appendChild(widgetContainer);
        elementsRef.current.widget = widgetContainer;

        // Create and configure the script
        // TradingView embed widgets expect the script as a sibling to the widget container
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.type = "text/javascript";
        // TradingView embed widgets read config from script's innerHTML
        script.innerHTML = JSON.stringify(config);
        elementsRef.current.script = script;

        // Handle script load errors
        script.onerror = (error) => {
            console.error('TradingView widget script failed to load:', {
                scriptUrl,
                error,
                readyState: script.readyState
            });
            setHasError(true);
            if (container && elementsRef.current.widget) {
                const errorDiv = document.createElement("div");
                errorDiv.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: " + height + "px; padding: 20px; text-align: center; background-color: #141414; border-radius: 8px; border: 1px solid #30333A;";
                errorDiv.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="color: #DBDBDB; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Unable to Load Widget</h3>
                    <p style="color: #9095A1; font-size: 14px; margin-bottom: 12px;">Failed to connect to TradingView servers.</p>
                    <p style="color: #9095A1; font-size: 12px; margin-bottom: 8px;">Please check your internet connection or try again later.</p>
                    <p style="color: #60666E; font-size: 11px; font-family: monospace; word-break: break-all; max-width: 90%;">URL: ${scriptUrl}</p>
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
        const timeoutId = setTimeout(() => {
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

        // Append script after the widget container
        container.appendChild(script);

        // Cleanup timeout on successful load
        script.onload = () => {
            clearTimeout(timeoutId);
        };

        return () => {
            clearTimeout(timeoutId);
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
