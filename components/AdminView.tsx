
import React, { useState, useEffect, useRef } from 'react';
import { User, CatchRecord, Language } from '../types';
import { backend } from '../services/backend';
import { t } from '../utils/translations';
import { LogOut, Save, Plus, BarChart3, Fish, Calendar, Ship, Globe, Pencil, X, FileText, ChevronRight, ChevronLeft, Loader2, FileSpreadsheet, Download } from 'lucide-react';
// Import html2pdf directly from npm
import html2pdf from 'html2pdf.js';

interface AdminViewProps {
  user: User;
  onLogout: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

type ViewMode = 'daily' | 'reports';

interface SummaryItem {
  fishType: string;
  unit: string;
  total: number;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout, lang, setLang }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [fishTypes, setFishTypes] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlySummary, setMonthlySummary] = useState<SummaryItem[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFish, setSelectedFish] = useState('');
  const [newFishType, setNewFishType] = useState('');
  const [fisherName, setFisherName] = useState('');
  const [boat, setBoat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'kg' | 'ton' | 'piece'>('kg');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (viewMode === 'reports') {
      loadSummary();
    }
  }, [viewMode, reportMonth, catches]);

  const loadSummary = async () => {
    const summary = await backend.getMonthlySummary(reportMonth);
    setMonthlySummary(summary);
  };

  const refreshData = async () => {
    setCatches(await backend.getCatches());
    setFishTypes(await backend.getFishTypes());
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'fr' : 'ar');
  };

  const changeMonth = (delta: number) => {
    try {
      const parts = reportMonth.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const newDate = new Date(year, month + delta, 1);
      const newYear = newDate.getFullYear();
      const newMonth = (newDate.getMonth() + 1).toString().padStart(2, '0');
      setReportMonth(`${newYear}-${newMonth}`);
    } catch (e) { console.error(e); }
  };

  const resetForm = () => {
    setEditingId(null);
    setFisherName('');
    setBoat('');
    setQuantity('');
    setNewFishType('');
    setSelectedFish('');
    setDate(new Date().toISOString().split('T')[0]);
    setUnit('kg');
  };

  const handleEdit = (record: CatchRecord) => {
    setEditingId(record.id);
    setDate(record.date);
    setSelectedFish(record.fish_type);
    setFisherName(record.fisher_name);
    setBoat(record.boat);
    setQuantity(record.quantity.toString());
    setUnit(record.unit);
    setViewMode('daily');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    resetForm();
    setStatusMessage('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    
    if (!selectedFish && !newFishType) {
      setIsError(true);
      setStatusMessage(t('save_error', lang));
      return;
    }

    const typeToSave = newFishType || selectedFish;

    try {
      if (editingId) {
        await backend.updateCatch({
          id: editingId,
          date,
          fish_type: typeToSave,
          fisher_name: fisherName,
          boat,
          quantity: parseFloat(quantity),
          unit,
          created_by: user.email,
          timestamp: new Date().toISOString()
        });
        setStatusMessage(t('update_success', lang));
      } else {
        await backend.saveCatch({
          date,
          fish_type: typeToSave,
          fisher_name: fisherName,
          boat,
          quantity: parseFloat(quantity),
          unit,
          created_by: user.email
        });
        setStatusMessage(t('save_success', lang));
      }

      setIsError(false);
      resetForm();
      refreshData();
      setTimeout(() => setStatusMessage(''), 3000);

    } catch (err) {
      setIsError(true);
      setStatusMessage(t('save_error', lang));
    }
  };

  const getUnitLabel = (u: string) => {
    if (u === 'kg') return t('unit_kg', lang);
    if (u === 'ton') return t('unit_ton', lang);
    if (u === 'piece') return t('unit_piece', lang);
    return u;
  };

  const handleExportExcel = async () => {
    setIsSavingReport(true);
    setStatusMessage("جاري إعداد ملف Excel...");
    try {
      const data = await backend.getMonthlySummary(reportMonth);
      let totalKg = 0, totalTon = 0, totalPiece = 0;
      data.forEach(item => {
        if(item.unit === 'kg') totalKg += item.total;
        if(item.unit === 'ton') totalTon += item.total;
        if(item.unit === 'piece') totalPiece += item.total;
      });

      const xlsContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"/></head>
        <body dir="rtl">
          <table border="1">
            <tr><td colspan="3" style="background:#00838f;color:white;font-weight:bold;text-align:center">${t('app_title', lang)} - ${t('monthly_report', lang)}</td></tr>
            <tr><td colspan="3" style="background:#00acc1;color:white;text-align:center">${reportMonth}</td></tr>
            <tr><th>${t('fish_type', lang)}</th><th>${t('total_quantity', lang)}</th><th>${t('unit', lang)}</th></tr>
            ${data.map(item => `<tr><td>${item.fishType}</td><td>${item.total.toFixed(2)}</td><td>${getUnitLabel(item.unit)}</td></tr>`).join('')}
            <tr><td>Total</td><td colspan="2">${totalKg.toFixed(2)} kg | ${totalTon.toFixed(2)} ton | ${totalPiece} pc</td></tr>
          </table>
        </body></html>`;
      
      const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' });
      // Call Backend to save natively
      const savedPath = await backend.saveReportFile(`Report_${reportMonth}.xls`, blob);
      
      if (savedPath) {
        setStatusMessage(`تم الحفظ في: ${savedPath}`);
      } else {
        setStatusMessage("تم إلغاء الحفظ");
      }
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (e) {
      console.error(e);
      setIsError(true);
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleExportPDF = async () => {
    setIsSavingReport(true);
    setStatusMessage(t('saving_report', lang));
    setIsGeneratingPdf(true);

    try {
      // Small delay for render
      await new Promise(resolve => setTimeout(resolve, 500));
      const element = reportRef.current;
      if (!element) throw new Error("PDF Template not found");

      const opt = {
        margin: 0,
        filename: `PortMaster_Report_${reportMonth}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Generate PDF as Blob/Buffer instead of automatic download
      const pdfWorker = html2pdf().set(opt).from(element);
      const pdfBlob = await pdfWorker.output('blob');
      
      // Send to Backend Server to save or download
      const savedPath = await backend.saveReportFile(`PortMaster_Report_${reportMonth}.pdf`, pdfBlob);
      
      if (savedPath) {
        setStatusMessage(`${t('save_success', lang)}: ${savedPath}`);
      } else {
        setStatusMessage("تم إلغاء العملية");
      }

    } catch (e) {
      console.error(e);
      setIsError(true);
      setStatusMessage(t('save_error', lang));
    } finally {
      setIsGeneratingPdf(false);
      setIsSavingReport(false);
      setTimeout(() => setStatusMessage(''), 4000);
    }
  };

  const filteredCatches = catches.filter(c => c.date === filterDate);
  
  // (Render logic matches previous implementation, just using updated handlers)
  // ... [Rest of the render code is effectively the same, but implicit in the replacement]
  return (
    <div className="flex h-screen bg-gray-100 print:h-auto print:overflow-visible relative z-0">
      <aside className="w-64 bg-ocean-900 text-white flex flex-col shadow-xl hidden md:flex print:hidden shrink-0 z-10">
        <div className="p-6 border-b border-ocean-800">
          <div className="flex items-center gap-3 mb-2">
            <Ship size={24} className="text-ocean-300" />
            <h1 className="font-bold text-xl">{t('admin_title', lang)}</h1>
          </div>
          <p className="text-xs text-ocean-300">{user.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setViewMode('daily')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${viewMode === 'daily' ? 'bg-ocean-800 text-white' : 'text-ocean-100 hover:bg-ocean-800/50'}`}>
            <Fish size={20} /> <span>{t('save_record', lang)}</span>
          </button>
          <button onClick={() => setViewMode('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${viewMode === 'reports' ? 'bg-ocean-800 text-white' : 'text-ocean-100 hover:bg-ocean-800/50'}`}>
            <BarChart3 size={20} /> <span>{t('reports', lang)}</span>
          </button>
        </nav>
        <div className="p-4 border-t border-ocean-800 space-y-2 shrink-0">
          <button onClick={toggleLang} className="w-full flex items-center gap-2 px-4 py-2 text-ocean-200 hover:text-white hover:bg-ocean-800 rounded-lg transition-colors text-sm">
            <Globe size={16} /> <span className="uppercase">{lang}</span>
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 text-red-300 hover:text-white hover:bg-red-900/50 rounded-lg transition-colors text-sm">
            <LogOut size={16} /> <span>{t('logout', lang)}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:h-auto z-10">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10 print:hidden shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {viewMode === 'daily' && t('daily_view', lang)}
            {viewMode === 'reports' && t('monthly_report', lang)}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible print:p-0">
           {statusMessage && viewMode !== 'reports' && (
              <div className={`p-4 mb-4 rounded-lg shadow-sm text-center font-bold print:hidden ${isError ? 'bg-red-50 text-red-600' : 'bg-green-100 text-green-700'}`}>
                {statusMessage}
              </div>
           )}

          {viewMode === 'daily' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-[500px]">
              <div className="xl:col-span-4 2xl:col-span-3 print:hidden">
                <div className={`bg-white rounded-xl shadow-md p-6 border-t-4 ${editingId ? 'border-yellow-500' : 'border-ocean-500'}`}>
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingId ? <Pencil className="text-yellow-600" size={24} /> : <Plus className="bg-ocean-100 text-ocean-600 rounded p-1" size={28} />}
                      {editingId ? t('edit', lang) : t('add_record', lang)}
                    </div>
                    {editingId && <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                  </h3>
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('date', lang)}</label>
                      <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={`w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none px-3`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('fish_type', lang)}</label>
                      <select value={selectedFish} onChange={e => { setSelectedFish(e.target.value); setNewFishType(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none mb-2">
                        <option value="">-- {t('select_fish', lang)} --</option>
                        {fishTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="text" placeholder={t('or_new_type', lang)} value={newFishType} onChange={e => { setNewFishType(e.target.value); setSelectedFish(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none text-sm bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('name', lang)}</label>
                      <input type="text" required value={fisherName} onChange={e => setFisherName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('boat', lang)}</label>
                      <input type="text" required value={boat} onChange={e => setBoat(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity', lang)}</label>
                        <input type="number" required min="0.1" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none" />
                      </div>
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('unit', lang)}</label>
                        <select value={unit} onChange={e => setUnit(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 outline-none">
                          <option value="kg">{t('unit_kg', lang)}</option>
                          <option value="ton">{t('unit_ton', lang)}</option>
                          <option value="piece">{t('unit_piece', lang)}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {editingId && <button type="button" onClick={handleCancel} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 rounded-lg shadow-sm transition-all">{t('cancel', lang)}</button>}
                      <button type="submit" className={`flex-[2] font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-white ${editingId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-ocean-600 hover:bg-ocean-700'}`}>
                        <Save size={20} /> <span>{editingId ? t('update_btn', lang) : t('save_btn', lang)}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="xl:col-span-8 2xl:col-span-9 flex flex-col min-h-0 print:col-span-12">
                <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[400px] print:h-auto print:shadow-none print:overflow-visible">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-3 justify-between items-center shrink-0 print:hidden">
                    <h3 className="font-bold text-gray-700">{t('recent_records', lang)}</h3>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200">
                      <Calendar size={16} className="text-gray-400" />
                      <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                  <div className="overflow-auto flex-1 print:overflow-visible">
                    <table className="w-full text-sm rtl:text-right ltr:text-left">
                      <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10 shadow-sm print:static print:shadow-none print:bg-gray-200 print:text-black">
                        <tr>
                          <th className="px-4 py-3 border-b">{t('date', lang)}</th>
                          <th className="px-4 py-3 border-b">{t('fish_type', lang)}</th>
                          <th className="px-4 py-3 border-b">{t('name', lang)}</th>
                          <th className="px-4 py-3 border-b">{t('boat', lang)}</th>
                          <th className="px-4 py-3 border-b">{t('quantity', lang)}</th>
                          <th className="px-4 py-3 border-b text-center print:hidden">{t('actions', lang)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                        {filteredCatches.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="flex flex-col items-center text-gray-400 gap-2"><Ship size={48} className="opacity-20" /><p>{t('no_data', lang)}</p></div></td></tr>
                        ) : (
                          filteredCatches.map(row => (
                            <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${editingId === row.id ? 'bg-yellow-50' : ''} print:hover:bg-transparent`}>
                              <td className="px-4 py-3 font-mono text-gray-500 print:text-black">{row.date}</td>
                              <td className="px-4 py-3 font-bold text-ocean-700 print:text-black">{row.fish_type}</td>
                              <td className="px-4 py-3 print:text-black">{row.fisher_name}</td>
                              <td className="px-4 py-3 text-gray-600 print:text-black">{row.boat}</td>
                              <td className="px-4 py-3 font-bold print:text-black">{row.quantity} <span className="text-xs font-normal text-gray-500 print:text-black">{getUnitLabel(row.unit)}</span></td>
                              <td className="px-4 py-3 text-center print:hidden">
                                <button onClick={() => handleEdit(row)} className="p-1.5 text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded transition-colors" title={t('edit', lang)}><Pencil size={16} /></button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'reports' && (
             <div className="max-w-6xl mx-auto space-y-6">
               <div className="bg-white rounded-xl shadow-md p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 font-bold uppercase mb-1">{t('select_month', lang)}</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeMonth(-1)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600">{lang === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
                        <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-ocean-500 font-mono" />
                        <button onClick={() => changeMonth(1)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600">{lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportExcel} disabled={isSavingReport} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:bg-gray-400">
                      {isSavingReport ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20} />} <span className="font-bold">Excel</span>
                    </button>
                    <button onClick={handleExportPDF} disabled={isSavingReport} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:bg-gray-400">
                      {isSavingReport ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />} <span className="font-bold">{t('print_pdf', lang)}</span>
                    </button>
                  </div>
               </div>

               <div className="bg-white rounded-xl shadow-md overflow-hidden">
                 <div className="p-6 border-b border-gray-100 bg-gray-50 text-center">
                    <h3 className="text-xl font-bold text-gray-800">{t('monthly_report', lang)}</h3>
                    <p className="text-gray-500 mt-1" dir="ltr">{reportMonth}</p>
                 </div>
                 {statusMessage && <div className={`p-4 text-center border-b ${isError ? 'bg-red-50 text-red-700' : 'bg-ocean-50 text-ocean-700'}`}>{statusMessage}</div>}
                 <div className="p-6">
                   {monthlySummary.length === 0 ? (
                      <div className="text-center py-12 text-gray-400"><FileText size={48} className="mx-auto mb-2 opacity-20" /><p>{t('no_data', lang)}</p></div>
                   ) : (
                     <table className="w-full text-sm">
                       <thead className="bg-gray-100 text-gray-700">
                         <tr><th className="px-6 py-4 text-start">{t('fish_type', lang)}</th><th className="px-6 py-4 text-end">{t('total_quantity', lang)}</th><th className="px-6 py-4 text-end">{t('unit', lang)}</th></tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                         {monthlySummary.map((item, index) => (
                           <tr key={index} className="hover:bg-gray-50">
                             <td className="px-6 py-4 font-medium text-gray-800">{item.fishType}</td>
                             <td className="px-6 py-4 text-end font-bold text-ocean-700 font-mono">{item.total.toFixed(1)}</td>
                             <td className="px-6 py-4 text-end text-gray-500">{getUnitLabel(item.unit)}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                 </div>
               </div>
               
               {/* Hidden PDF Template */}
               <div className={isGeneratingPdf ? "absolute top-[-10000px] left-0" : "hidden"}>
                 <div ref={reportRef} style={{ width: '210mm', height: 'auto', padding: '10mm', backgroundColor: 'white', color: 'black', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' }} dir="rtl">
                    <div style={{ borderBottom: '2px solid #0ea5e9', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c4a6e', margin: 0 }}>{t('app_title', lang)}</h1>
                         <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>{t('office_val', lang)}</p>
                       </div>
                       <div style={{ textAlign: 'left' }}>
                          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0ea5e9', margin: 0 }}>{t('monthly_report', lang)}</h2>
                          <div style={{ fontSize: '12px', color: '#334155', marginTop: '5px' }}><div>{reportMonth} : {t('report_month', lang)}</div><div dir="ltr">{new Date().toLocaleDateString()} : {t('issue_date', lang)}</div></div>
                       </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                       <tr>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 'bold', width: '25%' }}>{t('operator', lang)}</td><td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{user.name}</td>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 'bold', width: '25%' }}>{t('issue_date', lang)}</td><td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{new Date().toLocaleDateString()}</td>
                       </tr>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                       <thead>
                          <tr style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
                             <th style={{ padding: '10px', border: '1px solid #0284c7', textAlign: 'start' }}>{t('fish_type', lang)}</th>
                             <th style={{ padding: '10px', border: '1px solid #0284c7', textAlign: 'center' }}>{t('total_quantity', lang)}</th>
                             <th style={{ padding: '10px', border: '1px solid #0284c7', textAlign: 'center' }}>{t('unit', lang)}</th>
                          </tr>
                       </thead>
                       <tbody>
                          {monthlySummary.map((item, index) => (
                             <tr key={index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f0f9ff' }}>
                                <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{item.fishType}</td>
                                <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px' }}>{item.total.toFixed(2)}</td>
                                <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{getUnitLabel(item.unit)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
                       <div style={{ textAlign: 'center', width: '200px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '40px', textDecoration: 'underline' }}>{t('responsible_accountant', lang)}</p>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto', fontSize: '10px', paddingTop: '5px' }}>Signature</div>
                       </div>
                    </div>
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};
