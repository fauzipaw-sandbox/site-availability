'use client';
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';

export default function Uploader() {
  const [loadingINAP, setLoadingINAP] = useState(false);
  const [loadingUME, setLoadingUME] = useState(false);
  const [statusINAP, setStatusINAP] = useState('');
  const [statusUME, setStatusUME] = useState('');
  
  const inapInputRef = useRef(null);
  const umeInputRef = useRef(null);

  // --- FUNGSI SAKTI: Kirim Data Dicicil & Tangkap Error DB ---
  const insertInChunks = async (tableName, data, setStatusFunc) => {
    const CHUNK_SIZE = 1000;
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      setStatusFunc(`Mengirim ke DB: ${i * CHUNK_SIZE} dari ${data.length} baris...`);
      
      const { error } = await supabase.from(tableName).insert(chunk);
      if (error) {
        console.error("SUPABASE ERROR DETAIL:", error);
        // Lempar pesan error spesifik dari database biar kita tau salahnya!
        throw new Error(error.message || error.details || JSON.stringify(error));
      }
    }
  };

  // --- PROSES INAP (HANYA CSV) ---
  const processINAP = (file) => {
    setLoadingINAP(true);
    setStatusINAP('Membaca file CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setStatusINAP('Merangkum data INAP...');
          const formattedData = results.data.map((row, index) => {
            // Kita coba deteksi kalau ada data yang ngaco
            try {
              return {
                period: row.period ? `${String(row.period).slice(0, 4)}-${String(row.period).slice(4, 6)}-${String(row.period).slice(6, 8)}` : null, 
                site_id: row.site_id,
                availability: parseFloat(row['availability (%)']) || 0,
                ava_power: parseFloat(row['ava_power (%)']) || 0,
                ava_transport: parseFloat(row['ava_transport (%)']) || 0,
              };
            } catch (e) {
              throw new Error(`Gagal membaca baris ke-${index + 1}. Pastikan format header sesuai.`);
            }
          }).filter(row => row.period !== null && row.site_id);

          if (formattedData.length === 0) throw new Error("Data kosong! Pastikan header CSV beneran ada: period, site_id, availability (%), dll.");

          await insertInChunks('inap_data', formattedData, setStatusINAP);
          
          setStatusINAP('✅ Sukses Upload INAP!');
          alert("Data INAP Berhasil masuk Database!");
          window.location.reload();
        } catch (err) {
          console.error("ERROR INAP:", err);
          alert(`GAGAL UPLOAD INAP!\nAlasan: ${err.message}`);
          setStatusINAP('');
          setLoadingINAP(false);
        }
      },
      error: (err) => {
        alert(`GAGAL PARSING CSV!\nAlasan: ${err.message}`);
        setLoadingINAP(false);
      }
    });
  };

  // --- PROSES UME (HANYA XLSX) ---
  const processUME = (file) => {
    setLoadingUME(true);
    setStatusUME('Membaca file Excel...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        setStatusUME('Merangkum data UME...');
        const formattedData = jsonData.map((row, index) => {
          const avail1 = parseFloat(row['Cell Availability _TSEL']) || 0;
          const avail2 = parseFloat(row['Cell Availability _TSEL_1']) || parseFloat(row['Cell Availability _TSEL_2']) || 0; 
          
          let parsedSiteId = "";
          // Ekstrak Site ID lebih tangguh (jaga-jaga kalau nama kolomnya beda)
          const rawIdString = String(row['Managed Element'] || row['ManagedElement'] || row['SubnetWork Name'] || '');
          const matchId = rawIdString.match(/\(([^)]+)\)/);
          if(matchId) parsedSiteId = matchId[1];

          return {
            period: row['Begin Time'] ? String(row['Begin Time']).split(' ')[0] : null, 
            site_id: parsedSiteId,
            cell_avail_1: avail1,
            cell_avail_2: avail2,
            avg_cell_avail: (avail1 + avail2) / 2
          };
        }).filter(row => row.period !== null && row.site_id !== "");

        if (formattedData.length === 0) throw new Error("Data kosong! Pastikan kolom 'Begin Time' dan 'Managed Element' ada di file Excel lo.");

        await insertInChunks('ume_data', formattedData, setStatusUME);
        
        setStatusUME('✅ Sukses Upload UME!');
        alert("Data UME Berhasil masuk Database!");
        window.location.reload();

      } catch (err) {
        console.error("ERROR UME:", err);
        alert(`GAGAL UPLOAD UME!\nAlasan: ${err.message}`);
        setStatusUME('');
        setLoadingUME(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex gap-4 mb-4">
      {/* KOTAK INAP */}
      <div 
        className="flex-1 border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg p-6 text-center cursor-pointer transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if(e.dataTransfer.files[0]) processINAP(e.dataTransfer.files[0]); }}
        onClick={() => inapInputRef.current.click()}
      >
        <input type="file" accept=".csv" className="hidden" ref={inapInputRef} onChange={(e) => { if(e.target.files[0]) processINAP(e.target.files[0]); }} />
        {loadingINAP ? (
          <p className="text-blue-700 font-bold animate-pulse text-sm">{statusINAP}</p>
        ) : (
          <div>
            <p className="font-bold text-blue-800">Upload Data INAP</p>
            <p className="text-xs text-blue-600 mt-1">Drag & Drop file .CSV di sini</p>
          </div>
        )}
      </div>

      {/* KOTAK UME */}
      <div 
        className="flex-1 border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 rounded-lg p-6 text-center cursor-pointer transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if(e.dataTransfer.files[0]) processUME(e.dataTransfer.files[0]); }}
        onClick={() => umeInputRef.current.click()}
      >
        <input type="file" accept=".xlsx" className="hidden" ref={umeInputRef} onChange={(e) => { if(e.target.files[0]) processUME(e.target.files[0]); }} />
        {loadingUME ? (
          <p className="text-green-700 font-bold animate-pulse text-sm">{statusUME}</p>
        ) : (
          <div>
            <p className="font-bold text-green-800">Upload Data UME</p>
            <p className="text-xs text-green-600 mt-1">Drag & Drop file .XLSX di sini</p>
          </div>
        )}
      </div>
    </div>
  );
}
