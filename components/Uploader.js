'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';

export default function Uploader() {
  const [loading, setLoading] = useState(false);

  const handleUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

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
              period: `${row.period.slice(0, 4)}-${row.period.slice(4, 6)}-${row.period.slice(6, 8)}`, 
              site_id: row.site_id,
              availability: parseFloat(row['availability (%)']) || 0,
              ava_power: parseFloat(row['ava_power (%)']) || 0,
              ava_transport: parseFloat(row['ava_transport (%)']) || 0,
            };
          } else {
            const avail1 = parseFloat(row['Cell Availability _TSEL']) || 0;
            const avail2 = parseFloat(row['Cell Availability _TSEL_2']) || 0;
            const avgAvail = (avail1 + avail2) / 2;

            let parsedSiteId = "";
            const matchId = row['Managed Element']?.match(/\(([^)]+)\)/);
            if(matchId) parsedSiteId = matchId[1];

            return {
              period: row['Begin Time'].split(' ')[0], 
              site_id: parsedSiteId,
              cell_avail_1: avail1,
              cell_avail_2: avail2,
              avg_cell_avail: avgAvail
            };
          }
        });

        const { error } = await supabase.from(tableName).insert(formattedData);
        setLoading(false);
        if (error) alert('Error: ' + error.message);
        else {
          alert(`Upload ${type} sukses!`);
          window.location.reload(); 
        }
      }
    });
  };

  return (
    <div className="flex gap-4 p-6 bg-white shadow rounded mb-6">
      <div>
        <p className="font-bold mb-2">Data INAP</p>
        <input type="file" accept=".csv" onChange={(e) => handleUpload(e, 'INAP')} className="text-sm" />
      </div>
      <div>
        <p className="font-bold mb-2">Data UME</p>
        <input type="file" accept=".csv" onChange={(e) => handleUpload(e, 'UME')} className="text-sm" />
      </div>
      {loading && <p className="text-blue-500 font-bold ml-4 mt-8">Uploading to DB...</p>}
    </div>
  );
}
