
import { Fisher, NFCLog, CatchRecord, User, ScanResult, RenewalRecord } from '../types';
import apiClient from './api';

/**
 * WEB BACKEND - HTTP API Client
 * Communicates with a backend server via REST API
 * Falls back to mock data if server is unavailable
 */

// --- MOCK DATA FOR OFFLINE/DEMO MODE ---
const MOCK_USERS: User[] = [
  { email: 'admin@port.com', name: 'مسؤول الحسابات', role: 'ADMIN' },
  { email: 'nfc@port.com', name: 'موظف الأمن', role: 'NFC_OPERATOR' },
  { email: 'csns@port.com', name: 'موظف التأمين', role: 'CSNS_OPERATOR' }
];

let mockFishers: Fisher[] = [
  { fisher_id: 'F1001', card_uid: '04:a1:b2:c3', name: 'محمد أمين', boat: 'لؤلؤة البحر', insurance_expiry: '2025-12-31' },
  { fisher_id: 'F1002', card_uid: '04:d4:e5:f6', name: 'ياسر', boat: 'الخيرات', insurance_expiry: '2023-01-01' }
];

let mockCatches: CatchRecord[] = [
  { id: 1, date: new Date().toISOString().split('T')[0], fish_type: 'Sardine', fisher_name: 'محمد أمين', boat: 'لؤلؤة البحر', quantity: 50, unit: 'kg', created_by: 'admin@port.com', timestamp: new Date().toISOString() }
];

let mockLogs: NFCLog[] = [];
let mockRenewals: RenewalRecord[] = [];

class WebBackend {
  
  // --- AUTH ---
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
      }
      return { success: true, user: response.data.user };
    } catch (error: any) {
      console.warn('API login failed, trying mock mode:', error.message);
      
      // Fallback to mock mode
      await new Promise(r => setTimeout(r, 800));
      const user = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (user && password === '123456') {
        localStorage.setItem('auth_token', 'mock_token_' + Date.now());
        return { success: true, user };
      }
      return { success: false, message: 'بيانات الاعتماد غير صحيحة' };
    }
  }

  // --- FISHERS ---
  async getAllFishers(): Promise<Fisher[]> {
    try {
      const response = await apiClient.get('/fishers');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch fishers:', error);
      return [...mockFishers];
    }
  }

  async addFisher(fisher: Fisher): Promise<boolean> {
    try {
      await apiClient.post('/fishers', fisher);
      return true;
    } catch (error) {
      console.warn('Failed to add fisher:', error);
      mockFishers.push(fisher);
      return true;
    }
  }

  async updateFisher(fisher: Fisher): Promise<boolean> {
    try {
      await apiClient.put(`/fishers/${fisher.fisher_id}`, fisher);
      return true;
    } catch (error) {
      console.warn('Failed to update fisher:', error);
      mockFishers = mockFishers.map(f => f.fisher_id === fisher.fisher_id ? fisher : f);
      return true;
    }
  }

  async deleteFisher(fisherId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/fishers/${fisherId}`);
      return true;
    } catch (error) {
      console.warn('Failed to delete fisher:', error);
      mockFishers = mockFishers.filter(f => f.fisher_id !== fisherId);
      return true;
    }
  }

  // --- NFC SCANNING ---
  async scanNFC(operatorEmail: string): Promise<ScanResult> {
    try {
      const response = await apiClient.post('/nfc/scan', { operatorEmail });
      return response.data;
    } catch (error) {
      console.warn('NFC scan API failed, using mock mode:', error);
      
      // Web Mock: Simulate a scan after 1.5s
      await new Promise(r => setTimeout(r, 1500));
      let scannedUID: string;
      const random = Math.random();
      if (random > 0.7) scannedUID = '04:new:card:uid';
      else if (mockFishers.length > 0) scannedUID = mockFishers[0].card_uid;
      else scannedUID = '04:test:uid';

      const allFishers = await this.getAllFishers();
      const fisher = allFishers.find(f => f.card_uid === scannedUID);
      return this.processScanLogic(fisher, scannedUID, operatorEmail);
    }
  }

  async manualSearch(query: string, operatorEmail: string): Promise<ScanResult> {
    if (!query) return { status: 'error', message: 'Empty query' };
    
    const allFishers = await this.getAllFishers();
    const fisher = allFishers.find(f => 
      f.fisher_id.toLowerCase().includes(query.toLowerCase()) || 
      f.name.toLowerCase().includes(query.toLowerCase())
    );

    return this.processScanLogic(fisher, 'MANUAL', operatorEmail);
  }

  private async processScanLogic(fisher: Fisher | undefined, uid: string, operatorEmail: string): Promise<ScanResult> {
    const today = new Date().toISOString().split('T')[0];
    let result: ScanResult;
    let matchStatus: 'موجود' | 'غير موجود' = fisher ? 'موجود' : 'غير موجود';
    let activationStatus: 'مفعل' | 'غير مفعل' | 'غير موجود';

    if (!fisher) {
      activationStatus = 'غير موجود';
      result = { 
        status: 'not_found', 
        message: 'غير موجود', 
        data: { fisher_id: 'UNKNOWN', card_uid: uid, name: 'غير مسجل', boat: '-', insurance_expiry: '' } 
      };
    } else {
      if (fisher.insurance_expiry >= today) {
        activationStatus = 'مفعل';
        result = { status: 'active', message: 'مفعل', data: fisher };
      } else {
        activationStatus = 'غير مفعل';
        result = { status: 'expired', message: 'غير مفعل', data: fisher };
      }
    }

    const log: NFCLog = {
      log_id: Date.now(),
      fisher_id: fisher ? fisher.fisher_id : 'UNKNOWN',
      name_from_card: fisher ? fisher.name : 'Unknown Card',
      boat_from_card: fisher ? fisher.boat : '-',
      insurance_expiry_from_card: fisher ? fisher.insurance_expiry : '-',
      match_status: matchStatus,
      activation_status: activationStatus,
      timestamp: new Date().toISOString(),
      operator_email: operatorEmail
    };

    try {
      await apiClient.post('/nfc/logs', log);
    } catch (error) {
      console.warn('Failed to log scan:', error);
      mockLogs.unshift(log);
    }

    return result;
  }

  async getNFCLogs(): Promise<NFCLog[]> {
    try {
      const response = await apiClient.get('/nfc/logs');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch logs:', error);
      return [...mockLogs];
    }
  }

  // --- CATCHES ---
  async getCatches(): Promise<CatchRecord[]> {
    try {
      const response = await apiClient.get('/catches');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch catches:', error);
      return [...mockCatches];
    }
  }

  async saveCatch(record: Omit<CatchRecord, 'id' | 'timestamp'>): Promise<boolean> {
    const newRecord = {
      ...record,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };

    try {
      await apiClient.post('/catches', newRecord);
      return true;
    } catch (error) {
      console.warn('Failed to save catch:', error);
      mockCatches.unshift(newRecord as CatchRecord);
      return true;
    }
  }

  async updateCatch(record: CatchRecord): Promise<boolean> {
    try {
      await apiClient.put(`/catches/${record.id}`, record);
      return true;
    } catch (error) {
      console.warn('Failed to update catch:', error);
      mockCatches = mockCatches.map(c => c.id === record.id ? record : c);
      return true;
    }
  }

  async getMonthlySummary(monthStr: string): Promise<Array<{ fishType: string, unit: string, total: number }>> {
    const catches = await this.getCatches();
    const summaryMap = new Map<string, number>();
    
    catches.forEach(c => {
      if (c.date.startsWith(monthStr)) {
        const key = `${c.fish_type}|${c.unit}`;
        summaryMap.set(key, (summaryMap.get(key) || 0) + c.quantity);
      }
    });

    const results: Array<{ fishType: string, unit: string, total: number }> = [];
    summaryMap.forEach((total, key) => {
      const [fishType, unit] = key.split('|');
      results.push({ fishType, unit, total });
    });
    return results.sort((a, b) => a.fishType.localeCompare(b.fishType));
  }

  async getFishTypes(): Promise<string[]> {
    const catches = await this.getCatches();
    // Updated defaults based on user request (deduplicated)
    const defaults = [
      'Sardine', 
      'Latcha', 
      'Anchoïs', 
      'Merlon', 
      'Roggig', 
      'Thon rouge',
      'Merlu',
      'Vivaneau rouge',
      'Sole',
      'Poulpe',
      'Calamar',
      'Seiche',
      'Grosses crevettes',
      'Merlan bleu'
    ];
    const existing = Array.from(new Set(catches.map(c => c.fish_type)));
    return Array.from(new Set([...defaults, ...existing]));
  }

  // --- RENEWALS ---
  async getRenewals(): Promise<RenewalRecord[]> {
    try {
      const response = await apiClient.get('/renewals');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch renewals:', error);
      return [...mockRenewals];
    }
  }

  async generateAuthorization(fisherId: string, operatorEmail: string): Promise<string> {
    try {
      const response = await apiClient.post('/renewals/generate-auth', { fisherId, operatorEmail });
      return response.data.authCode;
    } catch (error) {
      console.warn('Failed to generate authorization:', error);
      await new Promise(r => setTimeout(r, 800));
      return "AUTH_GENERATED";
    }
  }

  async renewInsurance(fisherId: string, amount: number, operatorEmail: string, ssn: string): Promise<RenewalRecord | null> {
    try {
      const response = await apiClient.post('/renewals', { fisherId, amount, operatorEmail, ssn });
      return response.data;
    } catch (error) {
      console.warn('Failed to renew insurance via API:', error);
      
      // Fallback mock
      const allFishers = await this.getAllFishers();
      const fisher = allFishers.find(f => f.fisher_id === fisherId);
      if (!fisher) return null;

      const today = new Date();
      const nextYear = new Date(today.setFullYear(today.getFullYear() + 1));
      const newExpiryISO = nextYear.toISOString().split('T')[0];

      fisher.insurance_expiry = newExpiryISO;
      await this.updateFisher(fisher);

      const transactionId = `TRX-${Date.now()}`;
      const renewal: RenewalRecord = {
        transaction_id: transactionId,
        fisher_id: fisher.fisher_id,
        fisher_name: fisher.name,
        boat: fisher.boat,
        social_security_number: ssn,
        amount: amount,
        renewal_date: new Date().toISOString().split('T')[0],
        new_expiry_date: newExpiryISO,
        operator_name: operatorEmail,
        authorization_pdf_path: `auth_${transactionId}.pdf`,
        receipt_pdf_path: `rec_${transactionId}.pdf`,
        timestamp: new Date().toISOString()
      };

      mockRenewals.unshift(renewal);
      return renewal;
    }
  }
  // --- FILE SAVING ---
  async saveReportFile(filename: string, blob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', blob, filename);
      const response = await apiClient.post('/reports/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.filePath;
    } catch (error) {
      console.warn('Failed to upload file via API, using browser download:', error);
      // Fallback: Browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return "تم التحميل في المتصفح";
    }
  }
}

export const backend = new WebBackend();
