/**
 * =========================================================================
 * PAPIH GAMING - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Backend Otomatisasi Turnamen: QRIS DANA ZONA OUTDOOR + MacroDroid
 * =========================================================================
 */

// Inisialisasi Sheet Otomatis jika belum ada
function initSheets(ss) {
  let sheetSesi = ss.getSheetByName("SESI");
  if (!sheetSesi) {
    sheetSesi = ss.insertSheet("SESI");
    sheetSesi.appendRow(["ID", "Jam", "Label", "Biaya", "Link Grup WhatsApp", "Max Slot"]);
    sheetSesi.appendRow(["SESI_13_00", "13.00", "Sesi 1 - 13:00 WIB", 5000, "https://chat.whatsapp.com/test-sesi-1300", 18]);
    sheetSesi.appendRow(["SESI_15_00", "15.00", "Sesi 2 - 15:00 WIB", 5000, "https://chat.whatsapp.com/test-sesi-1500", 18]);
    sheetSesi.appendRow(["SESI_17_00", "17.00", "Sesi 3 - 17:00 WIB", 5000, "https://chat.whatsapp.com/test-sesi-1700", 18]);
    sheetSesi.appendRow(["SESI_19_30", "19.30", "Sesi 4 - 19:30 WIB", 5000, "https://chat.whatsapp.com/test-sesi-1930", 18]);
    sheetSesi.appendRow(["SESI_21_30", "21.30", "Sesi 5 - 21:30 WIB", 5000, "https://chat.whatsapp.com/test-sesi-2130", 18]);
  }

  let sheetReg = ss.getSheetByName("PENDAFTAR");
  if (!sheetReg) {
    sheetReg = ss.insertSheet("PENDAFTAR");
    sheetReg.appendRow(["RegID", "Waktu", "Nama Tim", "Nick Kapten", "No WA", "Sesi Jam", "Total Bayar", "Kode Unik", "Status", "Waktu Lunas", "SessionID"]);
  }

  let sheetNotif = ss.getSheetByName("NOTIF_LOG");
  if (!sheetNotif) {
    sheetNotif = ss.insertSheet("NOTIF_LOG");
    sheetNotif.appendRow(["Waktu", "Teks Notifikasi"]);
  }
}

/**
 * Handle GET Request
 * Digunakan untuk:
 * 1. Webhook Notifikasi MacroDroid HP (?action=notif&text=...)
 * 2. Cek Status Pembayaran Tim (?action=checkStatus&regId=...)
 * 3. Ambil Daftar Sesi (?action=getSessions)
 * 4. Ambil Data Admin (?action=getAdminData)
 */
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const action = p.action || "ping";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    let res = { status: "ok" };

    // A. WEBHOOK NOTIFIKASI DARI MACRODROID HP
    if (action === "notif") {
      const text = p.text || "";
      res = handleNotif(ss, text);
    }
    // B. CEK STATUS PEMBAYARAN OLEH USER
    else if (action === "checkStatus") {
      res = handleCheckStatus(ss, p.regId);
    }
    // C. AMBIL DAFTAR SESI UNTUK FORM PENDAFTARAN
    else if (action === "getSessions") {
      res = { sessions: getSessionsList(ss) };
    }
    // D. AMBIL DATA UNTUK ADMIN PANEL
    else if (action === "getAdminData") {
      res = getAdminData(ss);
    }
    // E. REGISTRASI VIA GET (FALLBACK ANTI-CORS / REDIRECT)
    else if (action === "register") {
      res = handleRegister(ss, p);
    } else {
      res = { status: "ONLINE", app: "PAPIH GAMING BACKEND", time: new Date() };
    }

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle POST Request
 * Digunakan untuk Pendaftaran Tim Baru & Simpan Sesi Admin
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = e.parameter || {}; }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    let res = { success: false };

    // 1. PENDAFTARAN TIM BARU
    if (action === "register") {
      res = handleRegister(ss, payload);
    }
    // 2. SIMPAN SESI & LINK GRUP OLEH ADMIN
    else if (action === "saveSessions") {
      res = handleSaveSessions(ss, payload.sessions);
    }
    // 3. APPROVE MANUAL
    else if (action === "manualApprove") {
      res = handleManualApprove(ss, payload.regId);
    }
    // 4. HAPUS PENDAFTARAN
    else if (action === "deleteReg") {
      res = handleDeleteReg(ss, payload.regId);
    }
    // 5. WEBHOOK NOTIFIKASI VIA POST
    else if (action === "notif") {
      res = handleNotif(ss, payload.text || "");
    }

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// LOGIKA 1: PROSES NOTIFIKASI DANA DARI MACRODROID
function handleNotif(ss, text) {
  const sheetNotif = ss.getSheetByName("NOTIF_LOG");
  const timeNow = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
  sheetNotif.appendRow([timeNow, text]);

  // Ekstrak angka nominal (Rp 5.012 -> 5012)
  const clean = text.replace(/\./g, '');
  const matches = clean.match(/\b\d{4,6}\b/g) || [];

  const sheetReg = ss.getSheetByName("PENDAFTAR");
  const data = sheetReg.getDataRange().getValues();

  let matched = false;

  for (let m = 0; m < matches.length; m++) {
    const nominal = parseInt(matches[m]);
    for (let i = 1; i < data.length; i++) {
      const regTotal = parseInt(data[i][6]);
      const status = data[i][8];

      if (status === "PENDING" && regTotal === nominal) {
        // Tandai LUNAS di Sheet
        sheetReg.getRange(i + 1, 9).setValue("LUNAS");
        sheetReg.getRange(i + 1, 10).setValue(timeNow);
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  return { status: "success", matched: matched };
}

// LOGIKA 2: CEK STATUS PEMBAYARAN TIM
function handleCheckStatus(ss, regId) {
  const sheetReg = ss.getSheetByName("PENDAFTAR");
  const data = sheetReg.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === regId) {
      const status = data[i][8];
      const sessionId = data[i][10];

      if (status === "LUNAS") {
        // Ambil link grup WhatsApp sesi terkait
        const sheetSesi = ss.getSheetByName("SESI");
        const sesiData = sheetSesi.getDataRange().getValues();
        let waGroup = "https://chat.whatsapp.com/test-room";

        for (let j = 1; j < sesiData.length; j++) {
          if (sesiData[j][0] === sessionId) {
            waGroup = sesiData[j][4];
            break;
          }
        }

        return {
          status: "LUNAS",
          teamName: data[i][2],
          sessionJam: data[i][5],
          waGroup: waGroup
        };
      } else {
        return { status: "PENDING" };
      }
    }
  }

  return { status: "NOT_FOUND" };
}

// LOGIKA 3: DAFTAR TIM BARU
function handleRegister(ss, p) {
  const sheetReg = ss.getSheetByName("PENDAFTAR");
  const data = sheetReg.getDataRange().getValues();

  // Dapatkan kode unik yang belum terpakai (11 - 99)
  const pendingCodes = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === "PENDING") {
      pendingCodes.push(parseInt(data[i][7]));
    }
  }

  let kode = Math.floor(Math.random() * 89) + 11;
  while (pendingCodes.indexOf(kode) !== -1) {
    kode = Math.floor(Math.random() * 89) + 11;
  }

  const baseFee = parseInt(p.baseFee) || 5000;
  const totalNominal = baseFee + kode;
  const regId = "REG-" + Utilities.formatDate(new Date(), "GMT+7", "yyMMddHHmmss") + "-" + Math.floor(Math.random() * 900 + 100);
  const timeNow = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  // Cari jam sesi
  const sessions = getSessionsList(ss);
  const sel = sessions.find(s => s.id === p.sessionId) || sessions[0];

  sheetReg.appendRow([
    regId,
    timeNow,
    p.teamName,
    p.captainNick,
    p.captainWa,
    sel.jam,
    totalNominal,
    kode,
    "PENDING",
    "",
    sel.id
  ]);

  return {
    success: true,
    regId: regId,
    teamName: p.teamName,
    baseFee: baseFee,
    kodeUnik: kode,
    totalNominal: totalNominal,
    sessionJam: sel.jam
  };
}

// LOGIKA 4: DAFTAR SESI
function getSessionsList(ss) {
  const sheet = ss.getSheetByName("SESI");
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    list.push({
      id: data[i][0],
      jam: data[i][1],
      label: data[i][2],
      fee: parseInt(data[i][3]) || 5000,
      waGroup: data[i][4],
      maxSlot: parseInt(data[i][5]) || 18
    });
  }
  return list;
}

// LOGIKA 5: ADMIN DATA
function getAdminData(ss) {
  const sessions = getSessionsList(ss);
  const sheetReg = ss.getSheetByName("PENDAFTAR");
  const data = sheetReg.getDataRange().getValues();

  const registrations = [];
  for (let i = 1; i < data.length; i++) {
    registrations.push({
      regId: data[i][0],
      time: data[i][1],
      teamName: data[i][2],
      captainNick: data[i][3],
      captainWa: data[i][4],
      sessionJam: data[i][5],
      totalNominal: parseInt(data[i][6]),
      kodeUnik: data[i][7],
      status: data[i][8],
      paidAt: data[i][9],
      sessionId: data[i][10]
    });
  }

  const sheetNotif = ss.getSheetByName("NOTIF_LOG");
  const notifData = sheetNotif.getDataRange().getValues();
  const notifLogs = [];
  for (let i = Math.max(1, notifData.length - 20); i < notifData.length; i++) {
    notifLogs.push({
      time: notifData[i][0],
      text: notifData[i][1]
    });
  }

  return {
    sessions: sessions,
    registrations: registrations,
    notifLogs: notifLogs
  };
}

// LOGIKA 6: SIMPAN SESI & LINK GRUP
function handleSaveSessions(ss, sessions) {
  const sheet = ss.getSheetByName("SESI");
  sheet.clearContents();
  sheet.appendRow(["ID", "Jam", "Label", "Biaya", "Link Grup WhatsApp", "Max Slot"]);

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    sheet.appendRow([s.id, s.jam, s.label, s.fee, s.waGroup, s.maxSlot || 18]);
  }

  return { success: true };
}

// LOGIKA 7: APPROVE MANUAL
function handleManualApprove(ss, regId) {
  const sheet = ss.getSheetByName("PENDAFTAR");
  const data = sheet.getDataRange().getValues();
  const timeNow = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === regId) {
      sheet.getRange(i + 1, 9).setValue("LUNAS");
      sheet.getRange(i + 1, 10).setValue(timeNow);
      return { success: true };
    }
  }
  return { success: false };
}

// LOGIKA 8: HAPUS REGISTRASI
function handleDeleteReg(ss, regId) {
  const sheet = ss.getSheetByName("PENDAFTAR");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === regId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}
