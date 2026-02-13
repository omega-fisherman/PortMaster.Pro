
export type Role = 'NFC_OPERATOR' | 'ADMIN' | 'CSNS_OPERATOR';
export type Language = 'ar' | 'fr';

export interface User {
  email: string;
  name: string;
  role: Role;
}

export interface Fisher {
  fisher_id: string;
  card_uid: string;
  name: string;
  boat: string;
  insurance_expiry: string;
}

export interface NFCLog {
  log_id: number;
  fisher_id: string;
  name_from_card: string;
  boat_from_card: string;
  insurance_expiry_from_card: string;
  match_status: 'موجود' | 'غير موجود';
  activation_status: 'مفعل' | 'غير مفعل' | 'غير موجود';
  timestamp: string;
  operator_email: string;
}

export interface CatchRecord {
  id: number;
  date: string;
  fish_type: string;
  fisher_name: string;
  boat: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'piece';
  created_by: string;
  timestamp: string;
}

export interface RenewalRecord {
  transaction_id: string;
  fisher_id: string;
  fisher_name: string;
  boat: string;
  social_security_number: string;
  amount: number;
  renewal_date: string;
  new_expiry_date: string;
  operator_name: string;
  authorization_pdf_path: string;
  receipt_pdf_path: string;
  timestamp: string;
}

export interface ReportRecord {
  report_id: string;
  month: string;
  generated_at: string;
  generated_by: string;
  data_snapshot: any;
  pdf_path: string;
}

export type ScanResult = {
  status: 'active' | 'expired' | 'not_found' | 'error';
  message: string;
  data?: Fisher;
};

