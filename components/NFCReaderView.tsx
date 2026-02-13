
import React, { useState, useEffect } from 'react';
import { User, ScanResult, Language, RenewalRecord, NFCLog, Fisher } from '../types';
import { backend } from '../services/backend';
import { t } from '../utils/translations';
import { Wifi, SearchX, CheckCircle, XCircle, LogOut, Globe, Search, RefreshCw, FileText, Printer, CreditCard, X, AlertTriangle, History, ArrowRight, ArrowLeft, Users, Pencil, Trash2, Plus } from 'lucide-react';

interface NFCReaderViewProps {
  user: User;
  onLogout: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

type ViewMode = 'scan' | 'fishers';

export const NFCReaderView: React.FC<NFCReaderViewProps> = ({ user, onLogout, lang, setLang }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('scan');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [nfcLogs, setNfcLogs] = useState<NFCLog[]>([]);
  const [renewalLogs, setRenewalLogs] = useState<RenewalRecord[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalStep, setRenewalStep] = useState<1 | 2 | 3>(1);
  const [renewalAmount, setRenewalAmount] = useState('');
  const [ssnInput, setSsnInput] = useState('');
  const [processingRenewal, setProcessingRenewal] = useState(false);
  const [renewalResult, setRenewalResult] = useState<RenewalRecord | null>(null);
  const [fishersList, setFishersList] = useState<Fisher[]>([]);
  const [isEditingFisher, setIsEditingFisher] = useState(false);
  const [fisherForm, setFisherForm] = useState<Fisher>({ fisher_id: '', name: '', boat: '', card_uid: '', insurance_expiry: '' });
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (showLogs) refreshLogs();
    if (viewMode === 'fishers') refreshFishers();
  }, [showLogs, viewMode]);

  const refreshLogs = async () => {
    if (user.role === 'CSNS_OPERATOR') {
      setRenewalLogs(await backend.getRenewals());
    } else {
      setNfcLogs(await backend.getNFCLogs());
    }
  };

  const refreshFishers = async () => {
    setFishersList(await backend.getAllFishers());
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setResult(null);
    setManualInput(''); 
    setErrorMsg('');

    try {
      const scanResult = await backend.scanNFC(user.email);
      setResult(scanResult);
      if (scanResult.data?.fisher_id) {
        setManualInput(scanResult.data.fisher_id);
      } else if (scanResult.status === 'error' && scanResult.message === 'device_error') {
         setErrorMsg(t('device_error', lang));
      }
      if (showLogs) refreshLogs();
    } catch (error) {
      setResult({ status: 'error', message: t('status_error', lang) });
    } finally {
      setScanning(false);
    }
  };

  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualInput.trim() || scanning) return;
    setScanning(true);
    setResult(null);
    setErrorMsg('');
    try {
      const searchResult = await backend.manualSearch(manualInput, user.email);
      setResult(searchResult);
      if (searchResult.data?.fisher_id && searchResult.status !== 'not_found') {
        setManualInput(searchResult.data.fisher_id);
      }
      if (showLogs) refreshLogs();
    } catch (error) {
      setResult({ status: 'error', message: t('status_error', lang) });
    } finally {
      setScanning(false);
    }
  };

  const handleReset = () => {
    setManualInput('');
    setResult(null);
    setScanning(false);
    setErrorMsg('');
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'fr' : 'ar');
  };

  const startRenewal = () => {
    setRenewalStep(1);
    setShowRenewalModal(true);
    setRenewalResult(null);
    setRenewalAmount('');
    setSsnInput('');
  };

  const handleGenerateAuthorization = async () => {
    if (!ssnInput.trim()) return;
    setProcessingRenewal(true);
    if (result?.data?.fisher_id) {
      await backend.generateAuthorization(result.data.fisher_id, user.email);
      setProcessingRenewal(false);
      setRenewalStep(2);
    }
  };

  const handleProcessPayment = async () => {
    if (!result?.data?.fisher_id || !renewalAmount) return;
    setProcessingRenewal(true);
    try {
      const rec = await backend.renewInsurance(result.data.fisher_id, parseFloat(renewalAmount), user.email, ssnInput);
      if (rec) {
        setRenewalResult(rec);
        setResult(prev => prev ? ({ ...prev, status: 'active', message: 'مفعل', data: { ...prev.data!, insurance_expiry: rec.new_expiry_date } }) : null);
        setRenewalStep(3);
        if (showLogs) refreshLogs();
      }
    } catch (e: any) {
      alert("Error processing renewal");
    } finally {
      setProcessingRenewal(false);
    }
  };

  const printReceipt = () => window.print();

  const handleFisherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let success = false;
      if (isEditingFisher) {
        success = await backend.updateFisher(fisherForm);
        setStatusMessage(t('update_success', lang));
      } else {
        success = await backend.addFisher(fisherForm);
        setStatusMessage(t('save_success', lang));
      }
      
      if (!success) throw new Error("Operation failed");

      setIsError(false);
      refreshFishers();
      resetFisherForm();
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      setIsError(true);
      setStatusMessage(t('save_error', lang));
    }
  };

  const resetFisherForm = () => {
    setFisherForm({ fisher_id: '', name: '', boat: '', card_uid: '', insurance_expiry: '' });
    setIsEditingFisher(false);
  };

  const editFisher = (fisher: Fisher) => {
    setFisherForm(fisher);
    setIsEditingFisher(true);
  };

  const deleteFisher = async (id: string) => {
    if (window.confirm(t('confirm_delete', lang))) {
      await backend.deleteFisher(id);
      refreshFishers();
    }
  };

  // ... (Render methods identical to original file, omitted for brevity as they don't change logic, only the state references updated above)
  
  const renderResultCard = () => {
    if (errorMsg) return (
      <div className="flex flex-col items-center justify-center h-[280px] text-red-500 border-4 border-dashed border-red-200 rounded-3xl bg-red-50/50 w-full transition-all">
        <AlertTriangle size={64} className="mb-3" />
        <p className="text-2xl font-bold">{errorMsg}</p>
        <p className="text-lg mt-2 opacity-80">{t('connect_reader', lang)}</p>
      </div>
    );

    if (!result) return (
      <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 border-4 border-dashed border-gray-200 rounded-3xl bg-white/50 w-full transition-all">
        <Wifi size={64} className={`mb-3 ${scanning ? 'animate-ping text-ocean-500' : 'opacity-50'}`} />
        <p className="text-2xl font-bold">{scanning ? t('scan_simulating', lang) : t('scan_ready', lang)}</p>
        <p className="text-lg mt-2 opacity-70">{t('scan_instruction', lang)}</p>
      </div>
    );

    let bgColor = '';
    let icon = null;
    let title = '';
    let message = '';

    const translateStatus = (status: string) => {
       if (status === 'مفعل') return t('status_active', lang);
       if (status === 'غير مفعل') return t('status_expired', lang);
       if (status === 'غير موجود') return t('status_not_found', lang);
       return status;
    };

    switch (result.status) {
      case 'active':
        bgColor = 'bg-green-50 border-green-500 text-green-900';
        icon = <CheckCircle size={64} className="text-green-600" />;
        title = t('status_active', lang);
        message = translateStatus(result.message);
        break;
      case 'expired':
        bgColor = 'bg-red-50 border-red-500 text-red-900';
        icon = <XCircle size={64} className="text-red-600" />;
        title = t('status_expired', lang);
        message = translateStatus(result.message);
        break;
      case 'not_found':
        bgColor = 'bg-gray-100 border-gray-400 text-gray-800';
        icon = <SearchX size={64} className="text-gray-500" />;
        title = t('status_not_found', lang);
        message = translateStatus(result.message);
        break;
      default:
        bgColor = 'bg-yellow-50 border-yellow-500 text-yellow-900';
        icon = <XCircle size={64} className="text-yellow-600" />;
        title = t('status_error', lang);
        message = result.message;
    }

    return (
      <div className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-4 ${bgColor} shadow-xl transition-all animate-in fade-in zoom-in duration-300 w-full min-h-[280px]`}>
        <div className="mb-2">{icon}</div>
        <h2 className="text-3xl font-extrabold mb-1 text-center tracking-tight">{title}</h2>
        <p className="text-lg opacity-80 mb-4 text-center font-medium">{message}</p>
        
        {result.data && (
          <div className="bg-white/70 w-full rounded-2xl p-4 backdrop-blur-sm border border-white/60 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 rtl:text-right ltr:text-left text-base">
              <div className="flex flex-col">
                <span className="text-xs uppercase opacity-60 font-bold mb-0.5">{t('name', lang)}</span>
                <span className="font-bold text-lg truncate text-gray-900">{result.data.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase opacity-60 font-bold mb-0.5">{t('boat', lang)}</span>
                <span className="font-bold text-lg truncate text-ocean-700">{result.data.boat}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase opacity-60 font-bold mb-0.5">{t('fisher_id', lang)}</span>
                <span className="font-mono font-semibold text-gray-700 text-lg">{result.data.fisher_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase opacity-60 font-bold mb-0.5">{t('insurance_expiry', lang)}</span>
                <span className="font-mono font-semibold text-gray-700 text-lg">{result.data.insurance_expiry}</span>
              </div>
            </div>
          </div>
        )}

        {result.status === 'expired' && user.role === 'CSNS_OPERATOR' && (
          <button 
            onClick={startRenewal}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold animate-bounce text-lg hover:scale-105 transition-transform active:scale-95"
          >
            <RefreshCw size={20} />
            {t('renew_insurance', lang)}
          </button>
        )}
      </div>
    );
  };

  const renderSidebar = () => {
    if (user.role === 'CSNS_OPERATOR') {
      const filteredRenewals = renewalLogs.filter(log => 
        log.transaction_id.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        log.fisher_name.toLowerCase().includes(sidebarSearch.toLowerCase())
      );

      return (
        <div className="h-full flex flex-col">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <History size={20} />
              {t('renewals_history', lang)}
            </h3>
            <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-red-500">
               <X size={20} />
            </button>
          </div>
          
          <div className="p-3 border-b bg-white">
             <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2">
               <Search size={16} className="text-gray-400" />
               <input 
                 className="bg-transparent border-none outline-none text-sm w-full mx-2"
                 placeholder={t('search_transaction', lang)}
                 value={sidebarSearch}
                 onChange={e => setSidebarSearch(e.target.value)}
               />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredRenewals.length === 0 ? (
              <div className="text-center text-gray-400 mt-10 text-sm">{t('no_logs', lang)}</div>
            ) : (
              filteredRenewals.map((log) => (
                <div key={log.transaction_id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:border-green-200 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-800 text-sm">{log.fisher_name}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono">
                      {log.amount} DA
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono mb-1 truncate" title={log.transaction_id}>
                    {log.transaction_id}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>{log.renewal_date}</span>
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{log.operator_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <History size={20} />
            {t('history', lang)}
          </h3>
          <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-red-500">
             <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {nfcLogs.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm">{t('no_logs', lang)}</div>
          ) : (
            nfcLogs.map((log) => (
              <div key={log.log_id} className={`p-3 rounded-xl border ${log.match_status === 'موجود' ? (log.activation_status === 'مفعل' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200') : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-gray-800 text-sm">{log.name_from_card || 'Unknown'}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs text-gray-500">{log.boat_from_card}</span>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                     log.activation_status === 'مفعل' ? 'bg-green-200 text-green-800' : 
                     log.activation_status === 'غير مفعل' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'
                   }`}>
                     {log.activation_status === 'مفعل' ? t('status_active', lang) : 
                      log.activation_status === 'غير مفعل' ? t('status_expired', lang) : t('status_not_found', lang)}
                   </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden print:overflow-visible print:h-auto">
      <header className="bg-ocean-900 text-white p-3 md:p-4 shadow-lg flex justify-between items-center z-30 print:hidden shrink-0 h-[64px] md:h-[72px]">
        <div className="flex items-center gap-4">
          <div className="bg-ocean-700 p-2 rounded-xl">
            <Wifi className="text-white" size={28} />
          </div>
          <div>
            <h1 className="font-bold text-xl md:text-2xl leading-tight">{t('nfc_title', lang)}</h1>
            <p className="text-sm text-ocean-200 font-medium">
              {user.name}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
           {user.role === 'CSNS_OPERATOR' && (
              <div className="flex bg-ocean-800 rounded-lg p-1 mr-2 ml-2">
                <button onClick={() => setViewMode('scan')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${viewMode === 'scan' ? 'bg-white text-ocean-900 shadow-sm' : 'text-ocean-200 hover:text-white'}`}>
                  <Wifi size={16} /> <span>{t('scan_btn', lang)}</span>
                </button>
                <button onClick={() => setViewMode('fishers')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${viewMode === 'fishers' ? 'bg-white text-ocean-900 shadow-sm' : 'text-ocean-200 hover:text-white'}`}>
                  <Users size={16} /> <span>{t('manage_fishers', lang)}</span>
                </button>
              </div>
           )}
           {viewMode === 'scan' && (
             <button onClick={() => setShowLogs(!showLogs)} className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-base font-bold ${showLogs ? 'bg-ocean-700 text-white shadow-inner' : 'hover:bg-ocean-800'}`} title={t('history', lang)}>
               <History size={22} /> <span className="hidden md:inline">{t('history', lang)}</span>
             </button>
           )}
           <div className="h-6 w-px bg-ocean-700 mx-1"></div>
           <button onClick={toggleLang} className="p-2 hover:bg-ocean-800 rounded-lg transition-colors flex items-center gap-2 text-base font-bold">
            <Globe size={20} /> <span className="uppercase">{lang}</span>
          </button>
          <button onClick={onLogout} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 text-base font-medium shadow-sm">
            <LogOut size={20} /> <span className="hidden md:inline">{t('logout', lang)}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden print:hidden relative">
        {viewMode === 'scan' && (
          <>
            <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-start transition-all duration-300 overflow-y-auto min-h-0 w-full">
              <div className="w-full max-w-2xl mx-auto mt-4 md:mt-8">
                <div className="mb-6 bg-white p-2 rounded-2xl shadow-md border border-gray-200 flex items-center gap-3 transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-ocean-200">
                  <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()} placeholder={t('manual_search_placeholder', lang)} className="flex-1 px-4 py-3 outline-none bg-transparent text-xl font-mono font-medium min-w-0" disabled={scanning} />
                  {(manualInput || result) && <button onClick={handleReset} className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 p-2.5 rounded-xl transition-colors shrink-0" title={t('reset_search', lang)}><X size={24} /></button>}
                  <button onClick={() => handleManualSearch()} disabled={scanning || !manualInput} className="bg-ocean-100 hover:bg-ocean-200 text-ocean-700 p-3 rounded-xl transition-colors shrink-0"><Search size={28} /></button>
                </div>
                {renderResultCard()}
                <button onClick={handleScan} disabled={scanning} className={`mt-6 w-full py-4 rounded-2xl text-xl font-bold shadow-lg transition-all transform active:scale-95 flex justify-center items-center gap-4 ${scanning ? 'bg-ocean-800 text-white animate-pulse' : 'bg-ocean-600 hover:bg-ocean-500 text-white hover:shadow-xl hover:-translate-y-1'}`}>
                  <Wifi size={28} className={scanning ? 'animate-spin' : ''} />
                  <span>{scanning ? t('scan_simulating', lang) : t('scan_btn', lang)}</span>
                </button>
              </div>
            </div>
            <div className={`bg-white shadow-2xl border-l border-r border-gray-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0 ${showLogs ? 'w-80 md:w-96 opacity-100' : 'w-0 opacity-0'}`}>
              <div className="w-80 md:w-96 h-full"> {renderSidebar()} </div>
            </div>
          </>
        )}

        {viewMode === 'fishers' && user.role === 'CSNS_OPERATOR' && (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
             {statusMessage && <div className={`p-4 mb-4 rounded-lg shadow-sm text-center font-bold ${isError ? 'bg-red-50 text-red-600' : 'bg-green-100 text-green-700'}`}>{statusMessage}</div>}
             <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
               <div className="xl:col-span-4 2xl:col-span-3">
                 <div className={`bg-white rounded-xl shadow-md p-6 border-t-4 ${isEditingFisher ? 'border-yellow-500' : 'border-purple-500'}`}>
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2">{isEditingFisher ? <Pencil className="text-yellow-600" size={24} /> : <Plus className="bg-purple-100 text-purple-600 rounded p-1" size={28} />}{isEditingFisher ? t('edit', lang) : t('add_fisher', lang)}</div>
                      {isEditingFisher && <button onClick={resetFisherForm}><X size={20} className="text-gray-400 hover:text-red-500" /></button>}
                    </h3>
                    <form onSubmit={handleFisherSubmit} className="space-y-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('fisher_id', lang)}</label><input type="text" required disabled={isEditingFisher} value={fisherForm.fisher_id} onChange={e => setFisherForm({...fisherForm, fisher_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('name', lang)}</label><input type="text" required value={fisherForm.name} onChange={e => setFisherForm({...fisherForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('boat', lang)}</label><input type="text" required value={fisherForm.boat} onChange={e => setFisherForm({...fisherForm, boat: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('card_uid_label', lang)}</label><div className="relative"><CreditCard className={`absolute top-2.5 text-gray-400 ${lang === 'ar' ? 'left-3' : 'right-3'}`} size={18} /><input type="text" required placeholder="e.g. 04:a1:b2:c3" value={fisherForm.card_uid} onChange={e => setFisherForm({...fisherForm, card_uid: e.target.value})} className={`w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm ${lang === 'ar' ? 'pl-10 pr-3' : 'pr-10 pl-3'}`} /></div></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('insurance_expiry', lang)}</label><input type="date" required value={fisherForm.insurance_expiry} onChange={e => setFisherForm({...fisherForm, insurance_expiry: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                      <button type="submit" className={`w-full font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 text-white mt-2 ${isEditingFisher ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-purple-600 hover:bg-purple-700'}`}>{isEditingFisher ? t('update_btn', lang) : t('save_btn', lang)}</button>
                    </form>
                 </div>
               </div>
               <div className="xl:col-span-8 2xl:col-span-9 flex flex-col min-h-0">
                 <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">{t('fishers_list', lang)}</h3><span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">{fishersList.length}</span></div>
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-sm rtl:text-right ltr:text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 shadow-sm"><tr><th className="px-4 py-3">{t('fisher_id', lang)}</th><th className="px-4 py-3">{t('name', lang)}</th><th className="px-4 py-3 hidden md:table-cell">{t('boat', lang)}</th><th className="px-4 py-3 hidden md:table-cell">{t('card_uid_label', lang)}</th><th className="px-4 py-3">{t('insurance_expiry', lang)}</th><th className="px-4 py-3 text-center">{t('actions', lang)}</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                           {fishersList.map(fisher => (
                              <tr key={fisher.fisher_id} className="hover:bg-purple-50 transition-colors">
                                 <td className="px-4 py-3 font-mono font-bold text-gray-700">{fisher.fisher_id}</td>
                                 <td className="px-4 py-3">{fisher.name}</td>
                                 <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{fisher.boat}</td>
                                 <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{fisher.card_uid}</td>
                                 <td className="px-4 py-3 font-mono text-xs"><span className={`px-2 py-1 rounded-full ${fisher.insurance_expiry < new Date().toISOString().split('T')[0] ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{fisher.insurance_expiry}</span></td>
                                 <td className="px-4 py-3 text-center flex gap-2 justify-center"><button onClick={() => editFisher(fisher)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={() => deleteFisher(fisher.fisher_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></td>
                              </tr>
                           ))}
                        </tbody>
                      </table>
                    </div>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

      {showRenewalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-ocean-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-xl md:text-2xl flex items-center gap-2"><RefreshCw size={24} /> {t('renewal_title', lang)}</h3>
              <button onClick={() => setShowRenewalModal(false)} className="hover:bg-ocean-700 p-2 rounded transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 md:p-8">
              {renewalStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center p-6 bg-gray-50 rounded-3xl border border-gray-100"><FileText size={56} className="mx-auto text-ocean-500 mb-3" /><h4 className="font-bold text-gray-800 text-2xl">{t('auth_step_title', lang)}</h4><p className="text-gray-500 mt-2 text-lg">{t('auth_msg', lang)}</p></div>
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                     <div className="flex justify-between items-center"><span className="text-gray-500 text-lg font-medium">{t('name', lang)}:</span><span className="font-bold text-xl text-gray-800">{result?.data?.name}</span></div>
                     <div className="flex justify-between items-center"><span className="text-gray-500 text-lg font-medium">{t('fisher_id', lang)}:</span><span className="font-mono text-xl font-bold text-gray-700">{result?.data?.fisher_id}</span></div>
                     <div className="flex justify-between items-center pt-3 border-t border-blue-200 mt-2"><span className="text-gray-500 text-lg font-medium">{t('ssn_label', lang)}:</span><input type="text" value={ssnInput} onChange={(e) => setSsnInput(e.target.value)} className="w-1/2 px-4 py-2 text-right border border-blue-300 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none font-mono text-lg" placeholder="SSN..." /></div>
                  </div>
                  <button onClick={handleGenerateAuthorization} disabled={processingRenewal || !ssnInput.trim()} className="w-full bg-ocean-600 hover:bg-ocean-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-3 text-xl active:scale-95">{processingRenewal ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" /> : null}{t('generate_auth', lang)}</button>
                </div>
              )}
              {renewalStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                  <div className="text-center p-6 bg-gray-50 rounded-3xl border border-gray-100"><CreditCard size={56} className="mx-auto text-green-500 mb-3" /><h4 className="font-bold text-gray-800 text-2xl">{t('payment_step_title', lang)}</h4><div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-xl mt-3 text-sm flex items-center justify-center gap-2"><Wifi className="animate-pulse" size={18} />{t('keep_card', lang)}</div></div>
                  <div className="space-y-6"><div><label className="block text-lg font-medium text-gray-700 mb-2">{t('amount_da', lang)}</label><input type="number" value={renewalAmount} onChange={(e) => setRenewalAmount(e.target.value)} className="w-full px-6 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none text-3xl font-bold font-mono tracking-wide" placeholder="0.00" autoFocus /></div>
                     <div className="grid grid-cols-2 gap-6 text-base"><div className="bg-gray-50 p-4 rounded-2xl border"><span className="block text-gray-500 mb-1 text-sm uppercase">{t('date', lang)}</span><span className="font-mono font-bold text-gray-800 text-lg">{new Date().toLocaleDateString()}</span></div><div className="bg-gray-50 p-4 rounded-2xl border"><span className="block text-gray-500 mb-1 text-sm uppercase">{t('operator', lang)}</span><span className="font-bold text-gray-800 truncate text-lg">{user.name}</span></div></div>
                  </div>
                  <button onClick={handleProcessPayment} disabled={processingRenewal || !renewalAmount} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-3 text-xl active:scale-95">{processingRenewal ? (<><div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" /><span>{t('writing_card', lang)}</span></>) : (<span>{t('confirm_renew', lang)}</span>)}</button>
                </div>
              )}
              {renewalStep === 3 && renewalResult && (
                <div className="space-y-6 animate-in zoom-in duration-300 text-center">
                  <div className="text-green-600 mb-2 flex justify-center"><CheckCircle size={72} className="drop-shadow-lg" /></div>
                  <h3 className="text-3xl font-bold text-gray-800">{t('success_renew', lang)}</h3>
                  <div className="bg-white border-2 border-gray-800 p-6 rounded-lg text-right relative mx-auto max-w-sm shadow-inner text-sm">
                     <div className="text-center mb-4 border-b border-gray-300 pb-2"><p className="font-bold text-gray-900">{t('app_title', lang)}</p><p className="text-xs text-gray-600">{t('office_val', lang)}</p></div>
                     <div className="flex justify-between mb-1"><span className="text-gray-500">{t('transaction_id', lang)}:</span><span className="font-mono font-bold">{renewalResult.transaction_id}</span></div>
                     <div className="flex justify-between mb-1"><span className="text-gray-500">{t('transaction_date', lang)}:</span><span className="font-mono font-bold">{renewalResult.renewal_date}</span></div>
                     <div className="flex justify-between mb-1"><span className="text-gray-500">{t('amount_da', lang)}:</span><span className="font-bold">{renewalResult.amount.toFixed(2)}</span></div>
                     <div className="flex justify-between mb-4"><span className="text-gray-500">{t('new_expiry', lang)}:</span><span className="font-bold">{renewalResult.new_expiry_date}</span></div>
                     <div className="mt-6 border-t border-dashed border-gray-300 pt-4"><p className="text-xs text-gray-500 mb-8 text-center">{t('fisher_signature', lang)}</p><div className="border-b border-gray-400 w-1/2 mx-auto"></div></div>
                  </div>
                  <div className="flex gap-4 pt-4"><button onClick={() => setShowRenewalModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition-colors">{t('close', lang)}</button><button onClick={printReceipt} className="flex-[2] bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"><Printer size={20} />{t('print_receipt', lang)}</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {renewalResult && (
        <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999]">
           <div className="w-[210mm] mx-auto pt-[15mm] px-[20mm] bg-white text-black font-sans" dir="rtl">
              <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                 <div className="text-right"><h1 className="text-3xl font-extrabold text-black mb-2">{t('app_title', lang)}</h1><p className="text-lg font-bold text-gray-700">{t('office_val', lang)}</p></div>
                 <div className="text-left"><h2 className="text-2xl font-bold uppercase tracking-widest text-gray-900">FATURA / وصل</h2><p className="text-sm text-gray-600 mt-2 font-mono">#{renewalResult.transaction_id}</p><p className="text-sm text-gray-600 mt-1 font-mono">{renewalResult.renewal_date}</p></div>
              </div>
              <div className="flex justify-between mb-8">
                 <div className="w-[45%]"><h3 className="font-bold text-gray-500 text-sm uppercase mb-3 border-b border-gray-200 pb-1">{t('operator', lang)}</h3><p className="text-lg font-bold">{renewalResult.operator_name}</p><p className="text-gray-600">{new Date().toLocaleDateString()}</p></div>
                 <div className="w-[45%] text-left" dir="ltr"><h3 className="font-bold text-gray-500 text-sm uppercase mb-3 border-b border-gray-200 pb-1 text-right">{t('name', lang)}</h3><p className="text-lg font-bold text-right">{renewalResult.fisher_name}</p><p className="text-gray-600 text-right font-mono">{renewalResult.fisher_id}</p></div>
              </div>
              <table className="w-full mb-8 border-collapse">
                 <thead><tr className="bg-gray-100 text-gray-700 uppercase text-sm"><th className="py-3 px-4 text-right border-b border-gray-300">{t('reports', lang)} / Description</th><th className="py-3 px-4 text-left border-b border-gray-300 w-40">{t('amount_da', lang)}</th></tr></thead>
                 <tbody><tr><td className="py-4 px-4 border-b border-gray-200"><p className="font-bold text-lg">{t('renew_insurance', lang)}</p><p className="text-sm text-gray-600 mt-1">SSN: {renewalResult.social_security_number}</p><p className="text-sm text-gray-600">Validity: {renewalResult.renewal_date} ➔ {renewalResult.new_expiry_date}</p></td><td className="py-4 px-4 border-b border-gray-200 text-left font-mono text-xl font-bold align-top">{renewalResult.amount.toFixed(2)}</td></tr></tbody>
                 <tfoot><tr><td className="pt-4 text-right pr-4 font-bold text-xl">{t('total_quantity', lang) === 'إجمالي الكمية' ? 'المجموع' : 'Total'}</td><td className="pt-4 pl-4 text-left font-mono text-2xl font-black bg-gray-50 rounded-lg">{renewalResult.amount.toFixed(2)} DA</td></tr></tfoot>
              </table>
              <div className="mt-16 flex justify-between items-end">
                 <div className="text-center w-40"><div className="h-24 border border-dashed border-gray-300 mb-2 rounded bg-gray-50 flex items-center justify-center text-gray-400 text-xs">Cachet</div><p className="text-sm font-bold text-gray-600">{t('office_name', lang)}</p></div>
                 <div className="text-center w-64"><div className="h-24 border-b border-gray-400 mb-2 w-full"></div><p className="text-sm font-bold text-gray-600">{t('fisher_signature', lang)}</p></div>
              </div>
              <div className="mt-12 text-center text-xs text-gray-400"><p>PortMaster DZ System - Generated on {new Date().toLocaleString()}</p></div>
           </div>
        </div>
      )}
    </div>
  );
};
