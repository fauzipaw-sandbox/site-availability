'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [worstContributors, setWorstContributors] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data: masterData } = await supabase.from('dashboard_master_view').select('*').order('period');
      if (masterData) setData(masterData);

      const { data: inapData } = await supabase.from('inap_data').select('site_id, availability, period').order('availability').limit(10);
      if (inapData) setWorstContributors(inapData);
    }
    fetchData();
  }, []);

  const calcAvg = (key) => {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return (sum / data.length).toFixed(2);
  };

  const categories = [...new Set(data.map(item => item.period))];
  const siteClasses = [...new Set(data.map(item => item.site_class).filter(Boolean))];
  
  const series = siteClasses.map(cls => ({
    name: cls,
    data: categories.map(date => {
      const match = data.find(d => d.period === date && d.site_class === cls);
      return match ? match.ava_power : null;
    })
  }));

  // Garis Agregat Spesifik
  series.push({
    name: 'Agregat Network',
    data: categories.map(date => {
      const dayData = data.filter(d => d.period === date);
      const avg = dayData.reduce((acc, curr) => acc + (curr.ava_power || 0), 0) / (dayData.length || 1);
      return parseFloat(avg.toFixed(2));
    })
  });

  const chartOptions = {
    chart: { type: 'line', zoom: { enabled: true, type: 'x' } },
    stroke: { width: [...Array(siteClasses.length).fill(2), 4], dashArray: [...Array(siteClasses.length).fill(0), 5] },
    xaxis: { categories: categories, type: 'datetime' },
    yaxis: { min: 0, max: 100 },
    legend: { position: 'bottom' },
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Network Operation Dashboard</h1>
      <Uploader />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 shadow rounded border-l-4 border-blue-500">
          <p className="text-sm font-bold text-gray-500">Avg Power (INAP)</p>
          <h2 className="text-3xl font-black">{calcAvg('ava_power')}%</h2>
        </div>
        <div className="bg-white p-6 shadow rounded border-l-4 border-purple-500">
          <p className="text-sm font-bold text-gray-500">Avg Transport</p>
          <h2 className="text-3xl font-black">{calcAvg('ava_transport')}%</h2>
        </div>
        <div className="bg-white p-6 shadow rounded border-l-4 border-yellow-500">
          <p className="text-sm font-bold text-gray-500">All NE</p>
          <h2 className="text-3xl font-black">{calcAvg('all_ne_avail')}%</h2>
        </div>
        <div className="bg-white p-6 shadow rounded border-l-4 border-green-500">
          <p className="text-sm font-bold text-gray-500">Avg Avail UME</p>
          <h2 className="text-3xl font-black">{calcAvg('ume_avail')}%</h2>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white p-6 shadow rounded">
          <h3 className="font-bold mb-4">Worst 10 INAP</h3>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100"><tr><th className="p-2">Site ID</th><th className="p-2">Date</th><th className="p-2">Avail</th></tr></thead>
            <tbody>
              {worstContributors.map((s, i) => (
                <tr key={i} className="border-b"><td className="p-2">{s.site_id}</td><td className="p-2">{s.period}</td><td className="p-2 text-red-600 font-bold">{s.availability}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col-span-2 bg-white p-6 shadow rounded">
          <h3 className="font-bold mb-2">Availability by Site Class</h3>
          {data.length > 0 ? <Chart options={chartOptions} series={series} type="line" height={350} /> : <p>Loading data...</p>}
        </div>
      </div>
    </div>
  );
}
