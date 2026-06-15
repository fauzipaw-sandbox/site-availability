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

  // --- FUNGSI SAKTI: Kirim Data Dicicil (Chunking) ---
  const insertInChunks = async (tableName, data, setStatusFunc) => {
    const CHUNK_SIZE = 1000; // Dikirim per 1000 baris biar Supabase gak jebol
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      setStatusFunc(`Mengirim ke DB: ${i * CHUNK_SIZE} dari ${data.length} baris...`);
      
      const { error } = await supabase.from(tableName).insert(chunk);
      if (error) throw error;
    }
  };

  // --- PROSES INAP (HANYA CSV) ---
  const processINAP = (file) => {
    setLoadingINAP(true);
    setStatusINAP('Membaca file CSV (Tunggu sebentar)...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setStatusINAP('Merangum data INAP...');
          const formattedData = results.data.map(row => ({
            period: row.period ? `${String(row.period).slice(0, 4)}-${String(row.period).slice(4, 6)}-${String(row.period).slice(6, 8)}` : null, 
            site_id: row.site_id,
            availability: parseFloat(row['availability (%)']) || 0,
            ava_power: parseFloat(row['ava_power (%)']) || 0,
            ava_transport: parseFloat(row['ava_transport (%)']) || 0,
          })).filter(row => row.period !== null && row.site_id);

          if (formattedData.length === 0) throw new Error("Data kosong atau format kolom CSV tidak sesuai!");

          await insertInChunks('inap_data', formattedData, setStatusINAP);
          
          setStatusINAP('✅ Sukses Upload INAP!');
          setTimeout(() => { setLoadingINAP(false); window.location.reload(); }, 2000);
        } catch (err) {
          setStatusINAP(`❌ Error: ${err.message}`);
          setLoadingINAP(false);
        }
      },
      error: (err) => {
        setStatusINAP(`❌ Parsing Error: ${err.message}`);
        setLoadingINAP(false);
      }
    });
  };

  // --- PROSES UME (HANYA XLSX) ---
  const processUME = (file) => {
    setLoadingUME(true);
    setStatusUME('Membaca file Excel (Ini agak lama kalau filenya gede)...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        setStatusUME('Merangkum data UME...');
        const formattedData = jsonData.map(row => {
          const avail1 = parseFloat(row['Cell Availability _TSEL']) || 0;
          const avail2 = parseFloat(row['Cell Availability _TSEL_1']) || parseFloat(row['Cell Availability _TSEL_2']) || 0; 
          
          let parsedSiteId = "";
          const matchId = String(row['Managed Element'] || '').match(/\(([^)]+)\)/);
          if(matchId) parsedSiteId = matchId[1];

          return {
            period: row['Begin Time'] ? String(row['Begin Time']).split(' ')[0] : null, 
            site_id: parsedSiteId,
            cell_avail_1: avail1,
            cell_avail_2: avail2,
            avg_cell_avail: (avail1 + avail2) / 2
          };
        }).filter(row => row.period !== null && row.site_id !== "");

        if (formattedData.length === 0) throw new Error("Data kosong atau format kolom Excel tidak sesuai!");

        await insertInChunks('ume_data', formattedData, setStatusUME);
        
        setStatusUME('✅ Sukses Upload UME!');
        setTimeout(() => { setLoadingUME(false); window.location.reload(); }, 2000);

      } catch (err) {
        setStatusUME(`❌ Error: ${err.message}`);
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
