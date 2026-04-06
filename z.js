masalah 1 : konser musik di gedung (pemantulan dan serap bunyi)

masalah 2 : radar kapal selam (sonar dan ultrasonik)

masalah 3 : dawai gitar dan alat musik tiup (resonansi)

masalah 4 : efek doppler (ambulans dijalan raya)

masalah 5 : gelombang air laut (energi dan mekanik)


const ADMIN_EMAIL = "ammardalimunthers@gmail.com";

function doGet(e) {
  const action = e.parameter.action;
  const username = e.parameter.username ? e.parameter.username.toLowerCase().trim() : "";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("database");

  if (action === "get_data") {
    const values = sheet.getDataRange().getValues();
    const userRow = values.find(row => row[2] && row[2].toString().toLowerCase() === username);
    
    if (userRow) {
      // --- TAMBAHAN: Ambil data Pre-Test ---
      const preSheet = ss.getSheetByName("pre-test");
      let preData = { score: 0, att: 0, ct: [0,0,0,0] };
      if (preSheet) {
        const preVal = preSheet.getDataRange().getValues();
        const row = preVal.find(r => r[1] && r[1].toString().toLowerCase() === username);
        if (row) preData = { score: row[2], att: row[7], ct: [row[3], row[4], row[5], row[6]] };
      }

      // --- TAMBAHAN: Ambil data Post-Test ---
      const postSheet = ss.getSheetByName("post-test");
      let postData = { score: 0, att: 0, ct: [0,0,0,0] };
      if (postSheet) {
        const postVal = postSheet.getDataRange().getValues();
        const row = postVal.find(r => r[1] && r[1].toString().toLowerCase() === username);
        if (row) postData = { score: row[2], att: row[7], ct: [row[3], row[4], row[5], row[6]] };
      }

      return res("success", "Data ditemukan", {
        data: {
          nama: userRow[1],
          username: userRow[2],
          sekolah: userRow[4] || "",
          hp: userRow[5] || "",
          foto_url: userRow[6] || "",
          // Kirim data nilai agar Profil HTML bisa menampilkan grafik
          score_pre: preData.score,
          attempt_pre: preData.att,
          ct_pre: preData.ct,
          score_post: postData.score,
          attempt_post: postData.att,
          ct_post: postData.ct
        }
      });
    }
    return res("error", "User tidak ditemukan");
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch(err) {
      data = e.parameter; 
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("database");
    if (!sheet) return res("error", "Sheet 'database' tidak ditemukan!");

    const username = data.username ? data.username.toLowerCase().trim() : "";
    const action = data.action; 
    const values = sheet.getDataRange().getValues();

    // --- 1. REGISTRASI ---
    if (action === "register") {
      const isExist = values.some(row => row[2] && row[2].toString().toLowerCase() === username);
      if (isExist) return res("error", "Username sudah digunakan!");
      
      sheet.appendRow([new Date(), data.nama, username, data.password, "", "", ""]); 
      kirimNotifikasiEmail("Pendaftaran Baru", `Siswa Baru Terdaftar:\nNama: ${data.nama}\nUsername: ${username}`);
      return res("success", "Registrasi berhasil!");
    }

    // --- 2. LOGIN ---
    if (action === "login") {
      let userRow = values.find(row => row[2] && row[2].toString().toLowerCase() === username && row[3].toString() === data.password);
      if (userRow) {
        const isComplete = userRow[4] && userRow[5] && userRow[6];
        return res("success", "Login Berhasil", { 
          needsProfile: !isComplete, 
          nama: userRow[1], 
          username: username,
          sekolah: userRow[4] || "",
          hp: userRow[5] || "",
          foto_url: userRow[6] || ""
        });
      }
      return res("error", "Username atau Password salah!");
    }

    // --- 3. UPDATE PROFIL ---
    if (action === "update_profile" || action === "update_profil") {
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === username) { 
          rowIndex = i + 1; 
          break; 
        }
      }

      if (rowIndex !== -1) {
        const sekolah = data.sekolah || "";
        const hp = data.hp || data.nomor_hp || "";
        const foto = data.foto_url || "";

        sheet.getRange(rowIndex, 5).setValue(sekolah); 
        sheet.getRange(rowIndex, 6).setValue(hp);      
        sheet.getRange(rowIndex, 7).setValue(foto);    
        
        kirimNotifikasiEmail("Update Profil", `Siswa Update Profil:\nUsername: ${username}\nSekolah: ${sekolah}\nNo HP: ${hp}`);
        return res("success", "Profil diperbarui!");
      }
      return res("error", "User tidak ditemukan!");
    }

    // --- 4. SUBMIT UJIAN (OPSI 1: UPDATE & ACCUMULATE ATTEMPTS) ---
    if (action === "submit_pretest" || action === "submit_posttest") {
      const sheetName = action === "submit_pretest" ? "pre-test" : "post-test";
      const sheetTest = ss.getSheetByName(sheetName);
      if (!sheetTest) return res("error", "Sheet '" + sheetName + "' tidak ditemukan!");
      
      const testValues = sheetTest.getDataRange().getValues();
      let rowIndex = -1;

      // Cari username di kolom B (index 1)
      for (let i = 0; i < testValues.length; i++) {
        if (testValues[i][1] && testValues[i][1].toString().toLowerCase() === username) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        // JIKA ADA: Ambil percobaan lama dari Kolom H (index 7), lalu +1
        let percobaanLama = testValues[rowIndex-1][7] || 0;
        let percobaanBaru = parseInt(percobaanLama) + 1;

        const updatedRow = [
          new Date(),             // A: Timestamp baru
          username,               // B: Username
          data.nilai_fisika,      // C: Nilai
          data.dekomposisi,       // D: Pilar CT
          data.pola,              // E: Pilar CT
          data.abstraksi,         // F: Pilar CT
          data.algoritma,         // G: Pilar CT
          percobaanBaru           // H: Jumlah Percobaan (Akumulasi)
        ];

        sheetTest.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
        kirimNotifikasiEmail("Update Ujian", `Siswa ${username} memperbarui ${sheetName}.\nNilai: ${data.nilai_fisika}\nPercobaan ke: ${percobaanBaru}`);
      } else {
        // JIKA TIDAK ADA: Buat baris baru, percobaan dimulai dari 1
        const newRow = [new Date(), username, data.nilai_fisika, data.dekomposisi, data.pola, data.abstraksi, data.algoritma, 1];
        sheetTest.appendRow(newRow);
        kirimNotifikasiEmail("Ujian Baru", `Siswa ${username} menyelesaikan ${sheetName} pertama kali.\nNilai: ${data.nilai_fisika}`);
      }
      
      return res("success", "Data berhasil diperbarui!");
    }

  } catch (error) {
    return res("error", "Server Error: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

function kirimNotifikasiEmail(subjek, pesan) {
  try {
    GmailApp.sendEmail(ADMIN_EMAIL, "[PhiQu-R] " + subjek, pesan);
  } catch (e) { 
    console.log("Gagal kirim email: " + e.toString()); 
  }
}

function res(status, msg, extra = {}) {
  const output = { status: status, result: status, message: msg, ...extra };
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}