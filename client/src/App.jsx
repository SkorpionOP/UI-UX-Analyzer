import { useState, useCallback, useRef } from "react";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");
  const [warning, setWarning] = useState(null);
  const abortControllerRef = useRef(null);

  // Validate URL format
  const isValidUrl = useCallback((string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setProgress("");
    }
  }, []);

  async function handleAnalyze(e) {
    e.preventDefault();
    
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL (must include http:// or https://)");
      return;
    }

    // Cancel any existing request
    cancelRequest();

    setLoading(true);
    setError(null);
    setWarning(null);
    setHtml(null);
    setAnalysisResult(null);
    setProgress("Fetching website...");

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      // Step 1: Fetch HTML
      const fetchRes = await fetch(
        `https://ui-ux-analyzer.onrender.com/fetch-html?url=${encodeURIComponent(url)}`,
        { signal }
      );
      
      if (!fetchRes.ok) {
        const errorData = await fetchRes.json().catch(() => ({}));
        throw new Error(`Failed to fetch HTML: ${errorData.error || fetchRes.statusText}`);
      }
      
      const data = await fetchRes.json();
      
      if (!data.html || data.html.trim().length === 0) {
        throw new Error("Received empty HTML content from the website");
      }
      
      setHtml(data.html);
      setProgress("Analyzing and improving UI/UX...");

      // Step 2: Analyze and improve
      const analyzeRes = await fetch("https://ui-ux-analyzer.onrender.com/analyze-uiux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: data.html }),
        signal
      });

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json().catch(() => ({}));
        throw new Error(`Failed to analyze UI/UX: ${errorData.error || analyzeRes.statusText}`);
      }

      const analyzeData = await analyzeRes.json();

      if (!analyzeData.improvedHtml) {
        throw new Error("No improved HTML received from analysis");
      }

      // Check for warnings from backend
      if (analyzeData.warning) {
        setWarning(analyzeData.warning);
      }

      // Inject CSS to disable interactions and make it safer for iframe
      const improvedHtmlWithSafetyCSS = injectSafetyCSS(analyzeData.improvedHtml);

      setAnalysisResult(improvedHtmlWithSafetyCSS);
      setProgress("Complete!");
      
      // Clear progress after a delay
      setTimeout(() => setProgress(""), 2000);

    } catch (err) {
      if (err.name === 'AbortError') {
        setProgress("Cancelled");
        setTimeout(() => setProgress(""), 1000);
      } else {
        console.error("Analysis error:", err);
        setError(err.message || "An unexpected error occurred");
        setProgress("");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  // Enhanced safety CSS injection
  function injectSafetyCSS(html) {
    const safetyCSS = `
      <style>
        /* Disable all interactions and navigation */
        a, button, input, select, textarea, form { 
          pointer-events: none !important; 
          cursor: default !important; 
        }
        
        /* Prevent form submissions */
        form { 
          onsubmit: return false !important; 
        }
        
        /* Make videos and audio controllable but prevent autoplay */
        video, audio { 
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        
        /* Ensure responsive behavior */
        body {
          margin: 0 !important;
          padding: 8px !important;
          box-sizing: border-box !important;
        }
        
        /* Prevent horizontal overflow */
        * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Make images responsive */
        img {
          max-width: 100% !important;
          height: auto !important;
        }
        
        /* Handle fixed positioning that might break in iframe */
        [style*="position: fixed"], .fixed {
          position: absolute !important;
        }
      </style>
    `;

    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${safetyCSS}`);
    } else if (html.includes("<html>")) {
      return html.replace("<html>", `<html><head>${safetyCSS}</head>`);
    } else {
      return `${safetyCSS}${html}`;
    }
  }

  // Reset function
  const handleReset = () => {
    cancelRequest();
    setUrl("");
    setHtml(null);
    setAnalysisResult(null);
    setError(null);
    setWarning(null);
    setProgress("");
  };

  // Download improved HTML
  const downloadImprovedHtml = () => {
    if (!analysisResult) return;
    
    const blob = new Blob([analysisResult], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'improved-website.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6 flex flex-col items-center">
      <header className="w-full max-w-4xl text-center mb-12">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          UI/UX Analyzer & Enhancer
        </h1>
        <p className="text-lg text-gray-400 mt-3 font-light">
          Enter a website URL to see original and enhanced UI side by side.
        </p>
      </header>

      <form
        onSubmit={handleAnalyze}
        className="w-full max-w-2xl bg-gray-800 p-6 rounded-2xl shadow-xl mb-10 border border-gray-700"
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter website URL (e.g. https://example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
              className="w-full p-4 rounded-xl bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-400 disabled:opacity-50"
            />
            {url && !isValidUrl(url) && (
              <p className="text-yellow-400 text-sm mt-1">
                ⚠️ Please include http:// or https:// in your URL
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || (url && !isValidUrl(url))}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  {progress || "Processing..."}
                </>
              ) : (
                "Analyze UI/UX"
              )}
            </button>

            {loading && (
              <button
                type="button"
                onClick={cancelRequest}
                className="px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Cancel
              </button>
            )}

            {(html || analysisResult) && !loading && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <div className="text-red-400 bg-red-900/30 p-3 rounded-md text-center border border-red-800">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {warning && (
            <div className="text-yellow-400 bg-yellow-900/30 p-3 rounded-md text-center border border-yellow-800">
              <p className="font-semibold">Warning:</p>
              <p className="text-sm">{warning}</p>
            </div>
          )}
        </div>
      </form>

      {(html || analysisResult) && (
        <div className="w-full max-w-[1800px] mx-auto">
          {/* Action buttons */}
          {analysisResult && (
            <div className="flex justify-center mb-6">
              <button
                onClick={downloadImprovedHtml}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Improved HTML
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="flex min-w-[1200px] gap-6 px-4">
              {/* Original Website */}
              {html && (
                <div className="flex-1 bg-gray-800 rounded-2xl shadow-xl flex flex-col h-[75vh] overflow-hidden border border-gray-700">
                  <h2 className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center py-3 text-lg font-semibold rounded-t-2xl flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Original Website
                  </h2>
                  <div className="overflow-auto h-full relative">
                    <iframe
                      title="Original Site"
                      sandbox="allow-same-origin allow-scripts"
                      srcDoc={html}
                      className="w-full h-full bg-white"
                      scrolling="yes"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* Improved Website */}
              {analysisResult && (
                <div className="flex-1 bg-gray-800 rounded-2xl shadow-xl flex flex-col h-[75vh] overflow-hidden border border-gray-700">
                  <h2 className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-center py-3 text-lg font-semibold rounded-t-2xl flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Improved Website
                  </h2>
                  <div className="overflow-auto h-full relative">
                    <iframe
                      title="Improved Site"
                      sandbox="allow-same-origin allow-scripts"
                      srcDoc={analysisResult}
                      className="w-full h-full bg-white"
                      scrolling="yes"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl text-center max-w-md mx-4">
            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Processing Website</h3>
            <p className="text-gray-400">{progress}</p>
            <button
              onClick={cancelRequest}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
