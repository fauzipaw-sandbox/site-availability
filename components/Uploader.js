// components/Uploader.jsx
'use client'
import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

export default function Uploader() {
  const [loading, setLoading] = useState(false);

  const handleUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const tableName = type === 'INAP' ? 'inap_data' : 'ume_data';
        
        // Data cleaning & Handle 0% availability
        const formattedData = results.data.map(row => {
          if (type === 'INAP') {
            return {
              period: row.period, // Sesuaikan format tanggal
              site_id: row.site_id,
              ava_power: parseFloat(row['ava_power (%)']) || 0, // Set 0 jika kosong
              ava_transport: parseFloat(row['ava_transport (%)']) || 0,
              availability: parseFloat(row['availability (%)']) || 0
            };
          } else {
            return {
              period: row['Begin Time'].split(' ')[0],
              site_id: row['SubnetWork Name'].match(/\(([^)]+)\)/)[1], // Ekstrak site ID
              cell_avail_tsel: parseFloat(row['Cell Availability _TSEL']) || 0
            };
          }
        });

        const { error } = await supabase.from(tableName).insert(formattedData);
        setLoading(false);
        if (error) alert('Error upload: ' + error.message);
        else alert(`Upload ${type} sukses!`);
      }
    });
  };

  return (
    <div className="flex gap-4 p-4 bg-white shadow rounded">
      <div>
        <label>Upload Data INAP</label>
        <input type="file" accept=".csv" onChange={(e) => handleUpload(e, 'INAP')} />
      </div>
      <div>
        <label>Upload Data UME</label>
        <input type="file" accept=".csv" onChange={(e) => handleUpload(e, 'UME')} />
      </div>
      {loading && <p>Uploading to Supabase...</p>}
    </div>
  );
}
