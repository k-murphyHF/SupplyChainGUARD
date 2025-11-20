import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, MessageSquare, Send, ShieldAlert, X, ChevronRight, ChevronDown, Loader2, File, Mail, Copy, Check } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Constants & Configurations ---

// UPDATED: Health Future Specific Standards based on uploaded template
const STANDARD_TERMS = `
1. Payment Terms: Net 30 days from delivery and receipt of undisputed invoice.
2. Shipping: FOB Destination (Vendor pays freight & insurance). No "Handling" or "Shipping & Handling" fees permitted.
3. Termination: 
   - For Convenience: 90 days prior written notice.
   - For Cause: 30 days cure period.
   - Immediate: For insurance failure, excluded provider status (OIG), or confidentiality breach.
4. Indemnification: Mutual indemnification for breach, violation of law, negligence, or willful misconduct.
5. Warranty: Products must be free from defects, fit for purpose, and meet industry standards.
6. Pricing: Fixed/Firm for the entire Term. Includes GPO alignment option (Health Future may align price if GPO rate is lower).
7. Insurance Requirements:
   - Commercial General & Professional Liability: $1M per occurrence / $3M aggregate.
   - Cyber/Data Breach Liability: Minimum $10,000,000 per occurrence.
   - Tail Coverage: 7 years required if policy is claims-made.
8. Product Discontinuance: Minimum 90 days advance notice required.
9. Governing Law: State of Oregon.
10. Compliance: Vendor must comply with Safe Harbor regulations regarding discounts/rebates.
`;

// System instruction to guide Gemini's persona
const SYSTEM_PROMPT = `
You are an expert Healthcare Supply Chain Legal Analyst for "Health Future". 
Your job is to review vendor contracts against a defined set of "Standard Terms" (Health Future Gold Standard).
You must ignore patient privacy/HIPAA concerns unless they violate the specific BAA/Confidentiality terms (though PHI is generally not expected).

Your analysis should focus on:
1. **Inconsistencies:** Where does the uploaded contract differ from the Health Future Standard Terms?
2. **Risk Assessment:** Highlight "Red Flags". 
   - CRITICAL RED FLAGS: Any Cyber Liability limit under $10M, FOB Origin, Missing "No Handling Fees" clause, or Governing Law other than Oregon.
   - GENERAL RED FLAGS: Auto-renewals without notice, payment terms < Net 30.
3. **Summary:** A concise summary of the deal.

Structure your initial response in JSON format (without markdown code blocks) with the following keys: 
"summary" (string), "inconsistencies" (array of strings), "redFlags" (array of strings), "overallScore" (number 1-100).
After the initial JSON analysis, answer subsequent user questions normally in plain text.
`;

// --- Components ---

const APIKeyModal = ({ onSave }) => {
  const [key, setKey] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-200">
        <h2 className="text-2xl font-bold mb-4 text-slate-800">Enter Gemini API Key</h2>
        <p className="text-sm text-slate-600 mb-6">
          To analyze contracts, we need a Gemini API key. The key is stored only in your browser's memory.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your API key here..."
          className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        <button
          onClick={() => key && onSave(key)}
          disabled={!key}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Start Analyzing
        </button>
      </div>
    </div>
  );
};

const EmailDraftModal = ({ isOpen, onClose, draft }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 flex flex-col h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Negotiation Email Draft</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Preview</p>
            <textarea 
                className="flex-1 w-full bg-transparent font-mono text-sm resize-none outline-none text-slate-700 leading-relaxed"
                value={draft}
                readOnly
            />
        </div>

        <div className="mt-4 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
                Close
            </button>
            <button 
                onClick={handleCopy}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
        </div>
      </div>
    </div>
  );
};

const AnalysisCard = ({ title, items, type }) => {
  const [isOpen, setIsOpen] = useState(true);

  const getIcon = () => {
    switch (type) {
      case 'danger': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-red-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      case 'success': return 'bg-emerald-50 border-emerald-100';
      default: return 'bg-white border-slate-200';
    }
  };

  return (
    <div className={`rounded-lg border mb-4 overflow-hidden ${getBgColor()}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {getIcon()}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 text-sm text-slate-700 leading-relaxed">
          {Array.isArray(items) ? (
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{items}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [genAI, setGenAI] = useState(null);
  const [chatSession, setChatSession] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const chatEndRef = useRef(null);

  // Initialize Gemini Client
  useEffect(() => {
    if (apiKey) {
      const genAIInstance = new GoogleGenerativeAI(apiKey);
      setGenAI(genAIInstance);
    }
  }, [apiKey]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Helper: Convert File to Base64
  const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const generateEmailDraft = () => {
    if (!analysis) return "";
    
    const issuesList = analysis.inconsistencies && analysis.inconsistencies.length > 0 
        ? analysis.inconsistencies.map(i => `• ${i}`).join('\n') 
        : "None identified.";
    
    const redFlagsList = analysis.redFlags && analysis.redFlags.length > 0
        ? analysis.redFlags.map(r => `• ${r}`).join('\n')
        : "None identified.";

    return `Subject: Contract Review - ${file?.name || 'Agreement'} - Health Future Findings

Dear Vendor Team,

Thank you for providing the draft agreement. We have completed our initial review against Health Future's standard supply chain terms.

While much of the agreement looks acceptable, we have identified specific areas where the terms deviate from our required standards (Net 30 payment, FOB Destination, Cyber Liability Limits, etc.) or require clarification.

EXECUTIVE SUMMARY:
${analysis.summary}

CRITICAL ITEMS FOR RESOLUTION (Red Flags):
${redFlagsList}

STANDARD TERMS ALIGNMENT NEEDED:
${issuesList}

Please review these points and let us know if you can update the draft to align with our standard requirements.

Best regards,

Health Future Supply Chain Team`;
  };

  // Handle File Drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.type === 'text/plain') {
        setFile(droppedFile);
        // Reset state for new file
        setAnalysis(null);
        setChatHistory([]);
        setChatSession(null);
      } else {
        alert("Please upload a PDF or Text file.");
      }
    }
  };

  // Start Analysis
  const startAnalysis = async () => {
    if (!file || !genAI) return;
    setAnalyzing(true);

    try {
      // Using the specific preview model that supports the required features
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });
      const filePart = await fileToGenerativePart(file);

      // Prompt for initial analysis
      const prompt = `
        Here is the uploaded supply chain contract. 
        Compare it strictly against these STANDARD TERMS (derived from Health Future Template):
        ${STANDARD_TERMS}
        
        Provide the analysis in the requested JSON format.
      `;

      // Start chat session with history
      const history = [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }, filePart, { text: prompt }],
        },
      ];

      const session = model.startChat({ history: [] });
      
      // We send the first message with the file and prompt
      const result = await session.sendMessage([
        { text: SYSTEM_PROMPT },
        filePart, 
        { text: prompt }
      ]);
      
      const responseText = result.response.text();
      
      // Try to parse JSON from the response (handle potential markdown wrapping)
      let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysisData = JSON.parse(jsonStr);

      setAnalysis(analysisData);
      setChatSession(session);
      
      // Add initial AI greeting to chat
      setChatHistory([{
        role: 'model',
        text: `I've analyzed ${file.name} against the Health Future standards. I found ${analysisData.inconsistencies.length} inconsistencies and ${analysisData.redFlags.length} red flags.`
      }]);

    } catch (error) {
      console.error("Error analyzing contract:", error);
      alert("Failed to analyze the contract. Please check the console for details or try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle Chat Message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !chatSession) return;

    const userMsg = inputMessage;
    setInputMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);

    try {
      const result = await chatSession.sendMessage(userMsg);
      const responseText = result.response.text();
      setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error processing that request." }]);
    }
  };

  if (!apiKey) return <APIKeyModal onSave={setApiKey} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col h-screen">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md shrink-0 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SupplyChain<span className="text-blue-400">Guard</span></h1>
            <p className="text-xs text-slate-400">Health Future • AI Contract Reviewer</p>
          </div>
        </div>
        <div className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          Secure Environment • No Patient Data
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Panel: File & Analysis */}
        <div className="w-1/3 min-w-[400px] border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
          
          {/* Upload Zone */}
          <div className="p-6 border-b border-slate-100">
            <div 
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
                ${file ? 'bg-blue-50/50 border-blue-200' : ''}
              `}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                    <File className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-slate-700 truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-slate-500 mb-4">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFile(null)} 
                      className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                    {!analysis && (
                      <button 
                        onClick={startAnalysis}
                        disabled={analyzing}
                        className="px-4 py-1 text-xs font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        {analyzing && <Loader2 className="w-3 h-3 animate-spin" />}
                        {analyzing ? "Analyzing..." : "Run Analysis"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-slate-700 mb-1">Upload Contract</h3>
                  <p className="text-sm text-slate-500 mb-4">Drag PDF here or click to browse</p>
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept=".pdf,.txt"
                    onChange={(e) => {
                      if(e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        setAnalysis(null);
                        setChatHistory([]);
                      }
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          <div className="p-6 flex-1">
            {!analysis ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <ShieldAlert className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-sm">Upload a contract to see analysis against Health Future standards.</p>
                <div className="mt-8 text-xs text-left bg-slate-50 p-4 rounded border border-slate-100 w-full max-w-xs">
                  <p className="font-semibold mb-2 text-slate-600">Checking against:</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-70">
                    <li>Payment: Net 30</li>
                    <li>FOB: Destination (No fees)</li>
                    <li>Term: 90 days convenience</li>
                    <li>Cyber Ins: $10M Limit</li>
                    <li>Gov Law: Oregon</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                {/* Score & Email Action */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Analysis Report</h3>
                    <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md font-bold text-xs mt-1 ${
                        analysis.overallScore > 80 ? 'bg-emerald-100 text-emerald-700' : 
                        analysis.overallScore > 50 ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                    }`}>
                        Score: {analysis.overallScore}/100
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Draft Email
                  </button>
                </div>

                <div className="space-y-4">
                  <AnalysisCard 
                    title="Executive Summary" 
                    items={analysis.summary} 
                    type="info" 
                  />
                  
                  {analysis.redFlags.length > 0 && (
                    <AnalysisCard 
                      title={`Red Flags (${analysis.redFlags.length})`} 
                      items={analysis.redFlags} 
                      type="danger" 
                    />
                  )}

                  {analysis.inconsistencies.length > 0 && (
                    <AnalysisCard 
                      title={`Standard Deviations (${analysis.inconsistencies.length})`} 
                      items={analysis.inconsistencies} 
                      type="warning" 
                    />
                  )}

                  <AnalysisCard 
                    title="Standard Terms Compliance" 
                    items="The remaining terms appear to align with standard healthcare supply chain provisions." 
                    type="success" 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="flex-1 flex flex-col bg-slate-50 h-full">
          {/* Chat Feed */}
          <div className="flex-1 p-6 overflow-y-auto">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <MessageSquare className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Contract Assistant</p>
                <p className="text-sm">Ask specific questions about clauses, dates, or penalties.</p>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}>
                      {msg.role === 'user' ? <span className="text-white text-xs">Me</span> : <span className="text-white text-xs">AI</span>}
                    </div>
                    <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={analysis ? "Ask a question about this contract..." : "Upload a contract to start chatting..."}
                disabled={!analysis}
                className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || !analysis}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-0 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-2">
               <p className="text-[10px] text-slate-400">AI can make mistakes. Verify important terms with Legal Counsel.</p>
            </div>
          </div>
        </div>

        {/* Email Modal */}
        <EmailDraftModal 
            isOpen={showEmailModal} 
            onClose={() => setShowEmailModal(false)} 
            draft={generateEmailDraft()} 
        />
      </main>
    </div>
  );
}
