// ==============================================================
// KONFIGURASI BIGQUERY — sesuaikan dengan project GCP kamu
// ==============================================================
var BQ_PROJECT_ID = 'bi-sales-cinema';   // ganti dengan Project ID asli
var BQ_DATASET_ID = 'bi_sales';
var BQ_TABLE_ID = 'sales_transactions';
var BQ_FULL_TABLE = '`' + BQ_PROJECT_ID + '.' + BQ_DATASET_ID + '.' + BQ_TABLE_ID + '`';

// Mapping kode PERIODE internal -> tanggal asli.
// PENTING: update dict ini kalau ada bulan baru sebelum menjalankan processUploadedExcel()
// (sama seperti PERIOD_MAP di script Python migrate_sheet_to_bigquery.py)
var PERIOD_MAP = {
  '01-01-26': '2026-01-01', // Januari
  '02-01-26': '2026-02-01', // Februari
  '03-01-26': '2026-03-01', // Maret
  '04-01-26': '2026-04-01', // April
  '05-01-26': '2026-05-01'  // Mei
};

// ==============================================================
// HELPER: jalankan query BigQuery, otomatis handle pagination
// ==============================================================
function runBQQuery(sql, params) {
  var request = {
    query: sql,
    useLegacySql: false
  };
  if (params) {
    request.queryParameters = params;
  }

  var queryResults = BigQuery.Jobs.query(request, BQ_PROJECT_ID);
  var jobId = queryResults.jobReference.jobId;
  var allRows = queryResults.rows || [];

  // Kalau hasil lebih dari 1 halaman, terus ambil sampai habis
  while (queryResults.pageToken) {
    queryResults = BigQuery.Jobs.getQueryResults(BQ_PROJECT_ID, jobId, {
      pageToken: queryResults.pageToken
    });
    allRows = allRows.concat(queryResults.rows || []);
  }

  return allRows;
}

function bqCell(row, idx) {
  return (row.f && row.f[idx] && row.f[idx].v !== null) ? row.f[idx].v : '';
}

// ==============================================================
// 2A. AMBIL DATA PERIODE TERBARU (sekarang dari BigQuery)
// ==============================================================
function getLatestPeriodData() {
  try {
    var headers = ['Code', 'Sub Category', 'LOB', 'Outlet', 'Region Mapping 1', 'Class',
                   'Location', 'Product Name', 'Grouping Product', 'Category', 'Qty',
                   'Amount', 'PERIODE', 'AREA', 'RM', 'admision'];

    var sql =
      'SELECT code, sub_category, lob, outlet, region_mapping_1, class, location, ' +
      '       product_name, grouping_product, category, qty, amount, ' +
      '       CAST(periode AS STRING) AS periode, area, rm, admision ' +
      'FROM ' + BQ_FULL_TABLE + ' ' +
      'WHERE periode = (SELECT MAX(periode) FROM ' + BQ_FULL_TABLE + ') ' +
      '  AND qty != 0';

    var rows = runBQQuery(sql);
    var latestData = [headers];
    var latestPeriod = '';

    rows.forEach(function (row) {
      var rowArr = [];
      for (var i = 0; i < headers.length; i++) rowArr.push(bqCell(row, i));
      latestData.push(rowArr);
      var p = bqCell(row, 12); // kolom periode
      if (p) latestPeriod = p.substring(0, 7); // format YYYY-MM
    });

    return JSON.stringify({ headers: headers, latestData: latestData, latestPeriod: latestPeriod });
  } catch (error) {
    return JSON.stringify({ error: error.toString() });
  }
}
// ==============================================================
// 1. FUNGSI UNTUK MENAMPILKAN HALAMAN WEB (UI)
// ==============================================================
function doGet() {
  catatLog("Akses Web App", "Membuka halaman BI Sales Dashboard XXI");
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('BI Sales Dashboard XXI')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==============================================================
// 2A. BOOSTER TRAP: AMBIL DATA PERIODE TERAKHIR DULU (PRIORITAS TINGGI)
// ==============================================================
function getLatestPeriodData() {
  try {
    var headers = ['Code', 'Sub Category', 'LOB', 'Outlet', 'Region Mapping 1', 'Class',
                   'Location', 'Product Name', 'Grouping Product', 'Category', 'Qty',
                   'Amount', 'PERIODE', 'AREA', 'RM', 'admision'];

    var sql =
      'SELECT code, sub_category, lob, outlet, region_mapping_1, class, location, ' +
      '       product_name, grouping_product, category, qty, amount, ' +
      '       CAST(periode AS STRING) AS periode, area, rm, admision ' +
      'FROM ' + BQ_FULL_TABLE + ' ' +
      'WHERE periode = (SELECT MAX(periode) FROM ' + BQ_FULL_TABLE + ') ' +
      '  AND qty != 0';

    var rows = runBQQuery(sql);
    var latestData = [headers];
    var latestPeriod = '';

    rows.forEach(function (row) {
      var rowArr = [];
      for (var i = 0; i < headers.length; i++) rowArr.push(bqCell(row, i));
      latestData.push(rowArr);
      var p = bqCell(row, 12); // kolom periode
      if (p) latestPeriod = p.substring(0, 7); // format YYYY-MM
    });

    return JSON.stringify({ headers: headers, latestData: latestData, latestPeriod: latestPeriod });
  } catch (error) {
    return JSON.stringify({ error: error.toString() });
  }
}


// ==============================================================
// 2B. AMBIL SEMUA DATA (sekarang dari BigQuery, dengan pagination)
// ==============================================================
function getSalesData() {
  try {
    var headers = ['Code', 'Sub Category', 'LOB', 'Outlet', 'Region Mapping 1', 'Class',
                   'Location', 'Product Name', 'Grouping Product', 'Category', 'Qty',
                   'Amount', 'PERIODE', 'AREA', 'RM', 'admision'];

    var sql =
      'SELECT code, sub_category, lob, outlet, region_mapping_1, class, location, ' +
      '       product_name, grouping_product, category, qty, amount, ' +
      '       CAST(periode AS STRING) AS periode, area, rm, admision ' +
      'FROM ' + BQ_FULL_TABLE + ' ' +
      'WHERE qty != 0';

    var rows = runBQQuery(sql);
    var cleanData = [headers];

    rows.forEach(function (row) {
      var rowArr = [];
      for (var i = 0; i < headers.length; i++) rowArr.push(bqCell(row, i));
      cleanData.push(rowArr);
    });

    return JSON.stringify(cleanData);
  } catch (error) {
    return JSON.stringify([['Error'], ['Pesan Error: ' + error.toString()]]);
  }
}


// ==============================================================
// 3. FUNGSI CEK LOGIN
// ==============================================================
function checkLogin(username, password) {
  if (username === undefined || password === undefined) {
    return { success: false, error: "Sistem: Parameter kosong. Silakan login melalui tampilan Web/UI." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");

  if (!sheet) {
    return { success: false, error: "Sistem error: Sheet 'Users' tidak ditemukan!" };
  }

  var data = sheet.getDataRange().getValues();
  var inputUser = String(username).trim();
  var inputPass = String(password).trim();

  for (var i = 1; i < data.length; i++) {
    if (!data[i][1] && !data[i][2]) continue;
    var dbUser = String(data[i][1]).trim();
    var dbPass = String(data[i][2]).trim();

    if (dbUser === inputUser && dbPass === inputPass) {
      var roleRaw = String(data[i][3]).trim().toUpperCase();
      var scopeName = String(data[i][4]).trim();
      var finalRole = roleRaw;

      if (roleRaw === 'ADMIN') finalRole = 'Admin';
      else if (roleRaw === 'RM') finalRole = 'RM';
      else if (roleRaw === 'AREA') finalRole = 'Area';
      else if (roleRaw === 'OUTLET') finalRole = 'Outlet';

      catatLog("Login Sukses", "Username: [" + inputUser + "] masuk sebagai Role: " + finalRole);
      return { success: true, role: finalRole, scope: scopeName };
    }
  }

  catatLog("Login Gagal", "Percobaan masuk gagal untuk Username: [" + inputUser + "]");
  return { success: false, error: "Username atau Password salah!" };
}

function processUploadedExcel(dataArray) {
  try {
    if (!dataArray || dataArray.length === 0) {
      throw new Error('Data array kosong. Pastikan file Excel tidak kosong.');
    }

    var headerIdx = 0;
    for (var i = 0; i < Math.min(5, dataArray.length); i++) {
      var rowString = dataArray[i].join(' ');
      if (rowString.indexOf('Amount') !== -1 || rowString.indexOf('Qty') !== -1 || rowString.indexOf('PERIODE') !== -1) {
        headerIdx = i;
        break;
      }
    }
    dataArray.splice(0, headerIdx + 1);

    if (dataArray.length === 0) {
      catatLog('Upload Gagal', 'File Excel yang diunggah hanya berisi header.');
      return 'File Excel yang diunggah hanya berisi header. Tidak ada data transaksi yang ditambahkan.';
    }

    // Susun rows untuk BigQuery streaming insert
    var rows = dataArray.map(function (row) {
      return {
        json: {
          code: String(row[0] || ''),
          sub_category: String(row[1] || ''),
          lob: String(row[2] || ''),
          outlet: String(row[3] || ''),
          region_mapping_1: String(row[4] || ''),
          class: String(row[5] || ''),
          location: String(row[6] || ''),
          product_name: String(row[7] || ''),
          grouping_product: String(row[8] || ''),
          category: String(row[9] || ''),
          qty: parseInt(String(row[10]).replace(/[^0-9-]/g, ''), 10) || 0,
          amount: parseFloat(String(row[11]).replace(/[^0-9.-]/g, '')) || 0,
          periode: convertPeriodeCode(row[12]),
          area: String(row[13] || ''),
          rm: String(row[14] || ''),
          admision: String(row[15] || '')
        }
      };
    });

    // BigQuery streaming insert punya limit ~10.000 baris/request -> kirim per batch
    var BATCH_SIZE = 5000;
    var totalInserted = 0;
    for (var b = 0; b < rows.length; b += BATCH_SIZE) {
      var batch = rows.slice(b, b + BATCH_SIZE);
      var response = BigQuery.Tabledata.insertAll(
        { rows: batch },
        BQ_PROJECT_ID, BQ_DATASET_ID, BQ_TABLE_ID
      );
      if (response.insertErrors && response.insertErrors.length > 0) {
        catatLog('Error Upload Data', JSON.stringify(response.insertErrors));
        throw new Error('Sebagian baris gagal insert: ' + JSON.stringify(response.insertErrors));
      }
      totalInserted += batch.length;
    }

    catatLog('Upload Data Excel', 'Berhasil insert ' + totalInserted + ' baris ke BigQuery.');
    return totalInserted + ' baris data Excel berhasil disisipkan ke BigQuery.';
  } catch (error) {
    catatLog('Error Upload Data', error.toString());
    throw new Error('Gagal menyimpan data ke BigQuery: ' + error.toString());
  }
}

// ==============================================================
// getDataSummaryForAI() -> sekarang full pakai SQL GROUP BY di BigQuery
// (menggantikan loop manual JS yang berisiko timeout/kepotong)
// ==============================================================
function bqGroupBy(column, limit, ascending) {
  var order = ascending ? 'ASC' : 'DESC';
  var sql =
    'SELECT COALESCE(NULLIF(' + column + ', ""), "Unknown") AS name, ' +
    '       SUM(qty) AS qty, SUM(amount) AS amount ' +
    'FROM ' + BQ_FULL_TABLE + ' ' +
    'WHERE qty != 0 ' +
    'GROUP BY name ' +
    'ORDER BY qty ' + order + ' ' +
    'LIMIT ' + limit;

  var rows = runBQQuery(sql);
  return rows.map(function (row) {
    return {
      name: bqCell(row, 0),
      qty: parseFloat(bqCell(row, 1)) || 0,
      amount: parseFloat(bqCell(row, 2)) || 0
    };
  });
}


// ==============================================================
// 5. GANTI PASSWORD
// ==============================================================
function changeUserPassword(username, oldPassword, newPassword) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
    if (!sheet) return { success: false, error: "Tab Sheet 'Users' tidak ditemukan." };

    var data = sheet.getDataRange().getValues();

    if (!username || username === "") {
      return { success: false, error: "Sesi habis. Silakan tutup, lalu Login ulang terlebih dahulu." };
    }

    var inputUser = username.toString().trim().toLowerCase();
    var inputOldPass = oldPassword.toString().trim();
    var inputNewPass = newPassword.toString().trim();

    for (var i = 1; i < data.length; i++) {
      var dbUser = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
      var dbPass = data[i][2] ? data[i][2].toString().trim() : "";

      if (dbUser === inputUser) {
        if (dbPass === inputOldPass) {
          sheet.getRange(i + 1, 3).setValue(inputNewPass);
          catatLog("Ubah Password", "Berhasil mengubah password untuk Username: [" + inputUser + "]");
          return { success: true };
        } else {
          catatLog("Gagal Ubah Password", "Password lama salah untuk Username: [" + inputUser + "]");
          return { success: false, error: "Password lama tidak sesuai!" };
        }
      }
    }

    catatLog("Gagal Ubah Password", "User tidak ditemukan di sistem: [" + inputUser + "]");
    return { success: false, error: "User [" + inputUser + "] tidak ditemukan di Sistem." };
  } catch (e) {
    catatLog("Error Ubah Password", e.toString());
    return { success: false, error: "Error Sistem: " + e.toString() };
  }
}

// ==============================================================
// 6. PENCATAT LOG AKTIVITAS (WIB)
// ==============================================================
function catatLog(aksi, keterangan) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLog = ss.getSheetByName("LogAktivitas");
    if (!sheetLog) return;

    var emailUser = Session.getActiveUser().getEmail();
    var waktuSaatIni = new Date();
    var waktuWIB = Utilities.formatDate(waktuSaatIni, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");

    if (emailUser === "") emailUser = "Anonymous / Web Browser";
    sheetLog.appendRow([waktuWIB, emailUser, aksi, keterangan]);
  } catch (error) {
    // Abaikan error
  }
}
// ==============================================================
// FUNGSI ASK AI - ANTHROPIC CLAUDE
// ==============================================================
function askClaudeWithFullData(userMessage) {
  try {
    var API_KEY = PropertiesService.getScriptProperties()
                  .getProperty('ANTHROPIC_API_KEY');

    if (!API_KEY) {
      return { success: false, error: "API Key tidak ditemukan." };
    }

    // Ambil summary data lengkap dari spreadsheet
    var summaryRaw = getDataSummaryForAI();
    var summary = JSON.parse(summaryRaw);

    if (summary.error) {
      return { success: false, error: "Gagal baca data: " + summary.error };
    }

    // Format konteks lengkap untuk AI
    var ctx = "=== DATA MASTER LENGKAP BI SALES XXI ===\n";
    ctx += "Total Transaksi: " + summary.totalRows.toLocaleString() + " baris\n";
    ctx += "Total Qty Keseluruhan: " + summary.totalQty.toLocaleString() + "\n";
    ctx += "Total Amount Keseluruhan: Rp " + summary.totalAmount.toLocaleString() + "\n";
    ctx += "Periode Tersedia: " + summary.periodeList.join(", ") + "\n\n";

    ctx += "--- TOP PERIODE (by Qty) ---\n";
    summary.topPeriode.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP RM (by Qty) ---\n";
    summary.topRM.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP AREA (by Qty) ---\n";
    summary.topArea.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP OUTLET (by Qty) ---\n";
    summary.topOutlet.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP LOCATION (by Qty) ---\n";
    summary.topLocation.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP CLASS (by Qty) ---\n";
    summary.topClass.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP LOB (by Qty) ---\n";
    summary.topLOB.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP 20 PRODUK (by Qty) ---\n";
    summary.topProduct.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- 10 PRODUK TERLEMAH (by Qty) ---\n";
    summary.bottomProduct.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP CATEGORY (by Qty) ---\n";
    summary.topCategory.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    ctx += "\n--- TOP SUB CATEGORY (by Qty) ---\n";
    summary.topSubCategory.forEach(function(d) {
      ctx += d.name + ": Qty=" + d.qty.toLocaleString() + "\n";
    });

    var systemPrompt = "Kamu adalah analis data senior untuk Cinema XXI Indonesia. " +
  "Kamu memiliki akses ke seluruh data master penjualan. " +
  "PENTING: Selalu selesaikan jawaban hingga tuntas, jangan potong di tengah. " +
  "Jika data terlalu banyak, prioritaskan insight paling penting saja. " +
  "Batasi jawaban maksimal 10 poin utama agar tidak terpotong. " +
  "Jawab dalam Bahasa Indonesia. Gunakan bullet points dan angka spesifik. " +
  "Berikut adalah data lengkap yang tersedia:\n\n" + ctx;

    var payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(
      "https://api.anthropic.com/v1/messages", options
    );

    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode !== 200) {
      return { success: false, error: "API Error " + responseCode + ": " + responseText };
    }

    var result = JSON.parse(responseText);
    if (result && result.content && result.content[0] && result.content[0].text) {
      return { success: true, reply: result.content[0].text };
    }

    return { success: false, error: "Format respons tidak dikenal." };

  } catch(e) {
    return { success: false, error: "Exception: " + e.toString() };
  }
}
function debugClaude() {
  var API_KEY = PropertiesService.getScriptProperties()
                .getProperty('ANTHROPIC_API_KEY');
  
  Logger.log("API Key ada: " + (API_KEY ? "YA - " + API_KEY.substring(0,20) + "..." : "TIDAK ADA"));
  
  var payload = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{ role: "user", content: "Halo, jawab dengan: OK" }]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
  Logger.log("Status: " + response.getResponseCode());
  Logger.log("Response: " + response.getContentText());
}
function getDataSummaryForAI() {
  try {
    // Totals
    var totalSql =
      'SELECT COUNT(*) AS total_rows, SUM(qty) AS total_qty, SUM(amount) AS total_amount ' +
      'FROM ' + BQ_FULL_TABLE + ' WHERE qty != 0';
    var totalRow = runBQQuery(totalSql)[0];

    // Daftar & top periode
    var periodeSql =
      'SELECT CAST(periode AS STRING) AS p FROM ' + BQ_FULL_TABLE + ' ' +
      'GROUP BY p ORDER BY p';
    var periodeRows = runBQQuery(periodeSql);
    var periodeList = periodeRows.map(function (r) { return bqCell(r, 0).substring(0, 7); });

    var summary = {
      totalRows: parseInt(bqCell(totalRow, 0), 10) || 0,
      totalQty: parseFloat(bqCell(totalRow, 1)) || 0,
      totalAmount: parseFloat(bqCell(totalRow, 2)) || 0,
      periodeList: periodeList,
      topPeriode: bqGroupBy('CAST(periode AS STRING)', 6, false),
      topRM: bqGroupBy('rm', 10, false),
      topArea: bqGroupBy('area', 10, false),
      topOutlet: bqGroupBy('outlet', 15, false),
      topLocation: bqGroupBy('location', 15, false),
      topClass: bqGroupBy('class', 10, false),
      topLOB: bqGroupBy('lob', 10, false),
      topProduct: bqGroupBy('product_name', 20, false),
      bottomProduct: bqGroupBy('product_name', 10, true),
      topCategory: bqGroupBy('category', 10, false),
      topSubCategory: bqGroupBy('sub_category', 10, false)
    };

    return JSON.stringify(summary);
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}
