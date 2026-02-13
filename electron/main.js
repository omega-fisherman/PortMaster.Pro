
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Initialize Database
const dbPath = path.join(app.getPath('userData'), 'portmaster.db');
console.log('Database Path:', dbPath); // Log path for debugging
const db = new Database(dbPath);

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      role TEXT,
      password TEXT
    );
    CREATE TABLE IF NOT EXISTS fishers (
      fisher_id TEXT PRIMARY KEY,
      card_uid TEXT,
      name TEXT,
      boat TEXT,
      insurance_expiry TEXT
    );
    CREATE TABLE IF NOT EXISTS catches (
      id INTEGER PRIMARY KEY,
      date TEXT,
      fish_type TEXT,
      fisher_name TEXT,
      boat TEXT,
      quantity REAL,
      unit TEXT,
      created_by TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS nfc_logs (
      log_id INTEGER PRIMARY KEY,
      fisher_id TEXT,
      name_from_card TEXT,
      boat_from_card TEXT,
      insurance_expiry_from_card TEXT,
      match_status TEXT,
      activation_status TEXT,
      timestamp TEXT,
      operator_email TEXT
    );
    CREATE TABLE IF NOT EXISTS renewals (
      transaction_id TEXT PRIMARY KEY,
      fisher_id TEXT,
      fisher_name TEXT,
      boat TEXT,
      social_security_number TEXT,
      amount REAL,
      renewal_date TEXT,
      new_expiry_date TEXT,
      operator_name TEXT,
      authorization_pdf_path TEXT,
      receipt_pdf_path TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      month TEXT,
      generated_at TEXT,
      generated_by TEXT,
      data_snapshot TEXT,
      pdf_path TEXT
    );
  `);

  // --- ROBUST USER SEEDING (FORCED UPDATE) ---
  // We use INSERT OR REPLACE to ensure that even if the user exists, 
  // their password is reset to '123456' to solve login issues.
  const ensureUser = (email, name, role, password) => {
    try {
      db.prepare('INSERT OR REPLACE INTO users (email, name, role, password) VALUES (?, ?, ?, ?)').run(email, name, role, password);
      console.log(`User seeded/updated: ${email}`);
    } catch (e) {
      console.error(`Failed to seed user ${email}:`, e);
    }
  };

  ensureUser('nfc@port.com', 'موظف الأمن', 'NFC_OPERATOR', '123456');
  ensureUser('admin@port.com', 'مسؤول الحسابات', 'ADMIN', '123456');
  ensureUser('csns@port.com', 'موظف التأمين', 'CSNS_OPERATOR', '123456');
  
  // Seed Fishers if completely empty
  const fisherCheck = db.prepare('SELECT count(*) as count FROM fishers').get();
  if (fisherCheck.count === 0) {
    const insert = db.prepare('INSERT INTO fishers (fisher_id, card_uid, name, boat, insurance_expiry) VALUES (?, ?, ?, ?, ?)');
    insert.run('F1001', '04:a1:b2:c3', 'محمد أمين', 'لؤلؤة البحر', '2025-12-31');
    insert.run('F1002', '04:d4:e5:f6', 'ياسر', 'الخيرات', '2023-01-01');
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);
}

app.whenReady().then(() => {
  try {
    initDB();
  } catch (err) {
    console.error("Database init failed:", err);
  }
  createWindow();
  
  // --- IPC HANDLERS ---

  // Auth - Made Case Insensitive
  ipcMain.handle('login', (_, email, password) => {
    try {
      console.log(`Login attempt for: ${email}`);
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();
      
      const stmt = db.prepare('SELECT * FROM users WHERE lower(email) = ? AND password = ?');
      const user = stmt.get(cleanEmail, cleanPass);
      
      if (user) {
        console.log('Login successful');
        return { success: true, user };
      } else {
        console.log('Login failed: User not found or wrong password');
        return { success: false, message: 'Invalid credentials' };
      }
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Server error' };
    }
  });

  // Fishers CRUD
  ipcMain.handle('get-fishers', () => {
    return db.prepare('SELECT * FROM fishers').all();
  });

  ipcMain.handle('save-fisher', (_, fisher) => {
    try {
      const stmt = db.prepare('INSERT INTO fishers (fisher_id, card_uid, name, boat, insurance_expiry) VALUES (?, ?, ?, ?, ?)');
      stmt.run(fisher.fisher_id, fisher.card_uid, fisher.name, fisher.boat, fisher.insurance_expiry);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  });

  ipcMain.handle('update-fisher', (_, fisher) => {
    try {
      const stmt = db.prepare('UPDATE fishers SET name=?, boat=?, card_uid=?, insurance_expiry=? WHERE fisher_id=?');
      stmt.run(fisher.name, fisher.boat, fisher.card_uid, fisher.insurance_expiry, fisher.fisher_id);
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('delete-fisher', (_, id) => {
    try {
      db.prepare('DELETE FROM fishers WHERE fisher_id=?').run(id);
      return true;
    } catch (e) { return false; }
  });

  // Catches
  ipcMain.handle('get-catches', () => {
    return db.prepare('SELECT * FROM catches ORDER BY timestamp DESC').all();
  });

  ipcMain.handle('save-catch', (_, record) => {
    const stmt = db.prepare('INSERT INTO catches (date, fish_type, fisher_name, boat, quantity, unit, created_by, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(record.date, record.fish_type, record.fisher_name, record.boat, record.quantity, record.unit, record.created_by, record.timestamp);
    return true;
  });
  
  ipcMain.handle('update-catch', (_, record) => {
    const stmt = db.prepare('UPDATE catches SET date=?, fish_type=?, fisher_name=?, boat=?, quantity=?, unit=? WHERE id=?');
    stmt.run(record.date, record.fish_type, record.fisher_name, record.boat, record.quantity, record.unit, record.id);
    return true;
  });

  // Logs
  ipcMain.handle('get-logs', () => {
    return db.prepare('SELECT * FROM nfc_logs ORDER BY timestamp DESC LIMIT 100').all();
  });

  ipcMain.handle('log-scan', (_, log) => {
    const stmt = db.prepare('INSERT INTO nfc_logs (log_id, fisher_id, name_from_card, boat_from_card, insurance_expiry_from_card, match_status, activation_status, timestamp, operator_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(log.log_id, log.fisher_id, log.name_from_card, log.boat_from_card, log.insurance_expiry_from_card, log.match_status, log.activation_status, log.timestamp, log.operator_email);
    return true;
  });

  // Renewals
  ipcMain.handle('get-renewals', () => {
    return db.prepare('SELECT * FROM renewals ORDER BY timestamp DESC').all();
  });

  ipcMain.handle('save-renewal', (_, record) => {
    const stmt = db.prepare('INSERT INTO renewals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(record.transaction_id, record.fisher_id, record.fisher_name, record.boat, record.social_security_number, record.amount, record.renewal_date, record.new_expiry_date, record.operator_name, record.authorization_pdf_path, record.receipt_pdf_path, record.timestamp);
    return true;
  });

  // Hardware Mock
  ipcMain.handle('scan-nfc', async () => {
    // MOCK: Simulate card read delay
    await new Promise(r => setTimeout(r, 1000));
    // MOCK: Return one of the existing cards randomly or a fixed one for testing
    // In real prod, this reads from SerialPort/USB
    return '04:a1:b2:c3'; 
  });

  ipcMain.handle('write-nfc', async (_, uid, data) => {
    await new Promise(r => setTimeout(r, 1000));
    // MOCK: Simulate write success
    return true;
  });

  // File System
  ipcMain.handle('save-file', async (_, fileName, bufferData) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['pdf', 'xls'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, Buffer.from(bufferData));
      return filePath;
    }
    return null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
