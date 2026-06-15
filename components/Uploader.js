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

  // --- PROSES INAP (HANYA CSV) ---
  const processINAP = (file) => {
    setLoadingINAP(true);
    setStatusINAP('Membaca CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const formattedData = results.data.map(row => ({
            period: row.period ? `${row.period.slice(0, 4)}-${row.period.slice(4, 6)}-${row.period.slice(6, 8)}` : null, 
            site_id: row.site_id,
            availability: parseFloat(row['availability (%)']) || 0,
            ava_power: parseFloat(row['ava_power (%)']) || 0,
            ava_transport: parseFloat(row['ava_transport (%)']) || 0,
          })).filter(row => row.period !== null);

          setStatusINAP('Menyimpan ke database...');
          const { error } = await supabase.from('inap_data').insert(formattedData);
          
          if (error) throw error;
          setStatusINAP('✅ Sukses!');
          setTimeout(() => { setLoadingINAP(false); window.location.reload(); }, 1500);
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
    setStatusUME('Membaca Excel...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ambil sheet pertama
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert ke JSON. SheetJS otomatis handle kolom duplikat jadi _1, _2 dst.
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        setStatusUME('Memproses data...');
        const formattedData = jsonData.map(row => {
          // SheetJS ngasih nama kolom kembar jadi "NamaKolom_1"
          const avail1 = parseFloat(row['Cell Availability _TSEL']) || 0;
          const avail2 = parseFloat(row['Cell Availability _TSEL_1']) || parseFloat(row['Cell Availability _TSEL_2']) || 0; 
          
          let parsedSiteId = "";
          const matchId = row['Managed Element']?.match(/\(([^)]+)\)/);
          if(matchId) parsedSiteId = matchId[1];

          return {
            period: row['Begin Time'] ? String(row['Begin Time']).split(' ')[0] : null, 
            site_id: parsedSiteId,
            cell_avail_1: avail1,
            cell_avail_2: avail2,
            avg_cell_avail: (avail1 + avail2) / 2
          };
        }).filter(row => row.period !== null && row.site_id !== "");

        setStatusUME('Menyimpan ke database...');
        const { error } = await supabase.from('ume_data').insert(formattedData);
        
        if (error) throw error;
        setStatusUME('✅ Sukses!');
        setTimeout(() => { setLoadingUME(false); window.location.reload(); }, 1500);

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
          <p className="text-blue-700 font-bold animate-pulse">{statusINAP}</p>
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
          <p className="text-green-700 font-bold animate-pulse">{statusUME}</p>
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
