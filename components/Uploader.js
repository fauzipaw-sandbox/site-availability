'use client';
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

export default function Uploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      // Deteksi otomatis tipe file dari namanya
      const fileName = file.name.toUpperCase();
      const type = fileName.includes('INAP') ? 'INAP' : fileName.includes('UME') ? 'UME' : null;

      if (!type) {
        resolve(`File ${file.name} dilewati (Bukan INAP/UME)`);
        return;
      }

      let headerTracker = {}; 

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          headerTracker[header] = (headerTracker[header] || 0) + 1;
          return headerTracker[header] > 1 ? `${header}_${headerTracker[header]}` : header;
        },
        complete: async (results) => {
          const tableName = type === 'INAP' ? 'inap_data' : 'ume_data';
          const formattedData = results.data.map(row => {
            if (type === 'INAP') {
              return {
                period: row.period ? `${row.period.slice(0, 4)}-${row.period.slice(4, 6)}-${row.period.slice(6, 8)}` : null, 
                site_id: row.site_id,
                availability: parseFloat(row['availability (%)']) || 0,
                ava_power: parseFloat(row['ava_power (%)']) || 0,
                ava_transport: parseFloat(row['ava_transport (%)']) || 0,
              };
            } else {
              const avail1 = parseFloat(row['Cell Availability _TSEL']) || 0;
              const avail2 = parseFloat(row['Cell Availability _TSEL_2']) || 0;
              let parsedSiteId = "";
              const matchId = row['Managed Element']?.match(/\(([^)]+)\)/);
              if(matchId) parsedSiteId = matchId[1];

              return {
                period: row['Begin Time'] ? row['Begin Time'].split(' ')[0] : null, 
                site_id: parsedSiteId,
                cell_avail_1: avail1,
                cell_avail_2: avail2,
                avg_cell_avail: (avail1 + avail2) / 2
              };
            }
          }).filter(row => row.period !== null); // Buang baris kosong

          const { error } = await supabase.from(tableName).insert(formattedData);
          if (error) reject(error);
          else resolve(`Upload ${type} sukses!`);
        }
      });
    });
  };

  const handleFiles = async (files) => {
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      setStatus(`Memproses file ${i + 1} dari ${files.length}...`);
      try {
        await processFile(files[i]);
      } catch (err) {
        console.error(err);
        alert('Gagal upload: ' + err.message);
      }
    }
    setStatus('Semua data berhasil masuk database!');
    setTimeout(() => window.location.reload(), 1500);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="mb-4">
      <div 
        className={`w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <input 
          type="file" 
          multiple 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={(e) => handleFiles(e.target.files)} 
        />
        {loading ? (
          <p className="text-blue-600 font-bold animate-pulse">{status}</p>
        ) : (
          <div>
            <p className="font-bold text-gray-600 text-sm">Drag & Drop file CSV INAP & UME di sini</p>
            <p className="text-xs text-gray-400 mt-1">Bisa blok banyak file sekaligus. Sistem otomatis mendeteksi dari nama file.</p>
          </div>
        )}
      </div>
    </div>
  );
}
