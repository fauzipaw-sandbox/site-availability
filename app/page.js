'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Komponen buat Bar Contributor di samping grafik (Mirip banget sama gambar lo)
const ContributorList = ({ title, data, dataKey }) => (
  <div className="w-56 bg-white p-3 border-l border-gray-100 flex flex-col">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-[11px] font-bold text-gray-700 flex items-center">
        <span className="text-pink-600 mr-2 text-lg leading-none">•</span> {title}
      </h4>
    </div>
    <div className="flex-1 overflow-y-auto">
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center text-[10px] mb-1.5">
          <span className="w-12 truncate text-gray-500">{item.site_id}</span>
          <div className="flex-1 h-3.5 bg-gray-100 mx-2 relative">
            <div 
              className="absolute top-0 right-0 h-full bg-orange-500" 
              style={{ width: `${100 - (item[dataKey] || 0)}%` }} // Panjang bar diukur dari loss (100 - avail)
            ></div>
          </div>
          <span className="w-8 text-right text-gray-700">{(item[dataKey] || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [worstINAP, setWorstINAP] = useState([]);
  const [worstPower, setWorstPower] = useState([]);
  const [worstTransport, setWorstTransport] = useState([]);

  useEffect(() => {
    async function fetchData() {
      // Tarik Master Data
      const { data: masterData } = await supabase.from('dashboard_master_view').select('*').order('period');
      if (masterData) setData(masterData);

      // Tarik Contributor INAP All
      const { data: inapData } = await supabase.from('inap_data').select('site_id, availability, ava_power, ava_transport').order('availability').limit(15);
      if (inapData) setWorstINAP(inapData);

      // Tarik Contributor Power
      const { data: powerData } = await supabase.from('inap_data').select('site_id, ava_power').order('ava_power').limit(15);
      if (powerData) setWorstPower(powerData);

      // Tarik Contributor Transport
      const { data: transportData } = await supabase.from('inap_data').select('site_id, ava_transport').order('ava_transport').limit(15);
      if (transportData) setWorstTransport(transportData);
    }
    fetchData();
  }, []);

  const categories = [...new Set(data.map(item => item.period))];

  // Helper bikin series grafik
  const buildSeries = (key, name) => ({
    name,
    data: categories.map(date => {
      const dayData = data.filter(d => d.period === date);
      if(!dayData.length) return null;
      return parseFloat((dayData.reduce((acc, curr) => acc + (curr[key] || 0), 0) / dayData.length).toFixed(2));
    })
  });

  const buildSeriesByGroup = (groupKey, dataKey, groupList) => {
    return groupList.map(groupVal => ({
      name: groupVal,
      data: categories.map(date => {
        const match = data.filter(d => d.period === date && d[groupKey] === groupVal);
        if(!match.length) return null;
        return parseFloat((match.reduce((acc, curr) => acc + (curr[dataKey] || 0), 0) / match.length).toFixed(2));
      })
    }));
  };

  // Setup Series
  const seriesTypeAll = [
    buildSeries('ava_power', 'Power'),
    buildSeries('ava_transport', 'Transport'),
    buildSeries('all_ne_avail', 'All NE'),
    buildSeries('ume_avail', 'Avail UME')
  ];

  const siteClasses = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
  const seriesSiteClassPower = buildSeriesByGroup('site_class', 'ava_power', siteClasses);
  const seriesSiteClassTransport = buildSeriesByGroup('site_class', 'ava_transport', siteClasses);
  
  const gridCategories = ['Bad Grid', 'Hybrid', 'Need Check', 'Off Grid', 'On Grid'];
  const seriesGrid = buildSeriesByGroup('grid_category_new', 'ava_power', gridCategories);

  // Styling Grafik Universal
  const baseChartOptions = {
    chart: { type: 'line', toolbar: { show: false }, animations: { enabled: false } },
    stroke: { width: 2, curve: 'straight' },
    xaxis: { categories: categories, type: 'datetime', labels: { style: { fontSize: '9px' } } },
    yaxis: { min: 94, max: 100, tickAmount: 3, labels: { style: { fontSize: '9px' } } },
    legend: { position: 'top', fontSize: '10px', markers: { radius: 12 } },
    grid: { show: false }
  };

  const chartColorsType = ['#008FFB', '#775DD0', '#FF4560', '#546E7A']; // Biru, Ungu, Orange, Ungu Tua
  const chartColorsClass = ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']; // Diamond=Pink, Bronze=Coklat

  return (
    <div className="p-2 bg-[#f3f4f6] min-h-screen font-sans">
      
      {/* FILTER BAR (UI Mockup ala gambar lo) */}
      <div className="bg-white p-2 mb-2 border-b flex items-center gap-2 overflow-x-auto text-[10px]">
        <div className="flex flex-col"><label className="text-gray-500 mb-1">Date</label><div className="flex"><input type="date" className="border px-1 py-0.5 rounded-l"/><input type="date" className="border-y border-r px-1 py-0.5 rounded-r"/></div></div>
        {['Flag NE ID', 'NOP', 'Year, Week', 'Site ID', 'Site Class', 'Kota/Kab', 'Kecamatan', 'Link Route', 'Grid'].map(filter => (
          <div key={filter} className="flex flex-col w-24"><label className="text-gray-500 mb-1">{filter}</label><select className="border px-1 py-1"><option>All</option></select></div>
        ))}
        <div className="ml-auto font-bold text-xs">Source : INAP & UME</div>
      </div>

      <div className="px-2">
        <Uploader />

        {/* ROW 1: Types */}
        <div className="flex gap-2 mb-2 h-[260px]">
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2">Availability by Type (All)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsType}} series={seriesTypeAll} type="line" height="100%" />
            </div>
            <ContributorList title="Contributor (7 Days)" data={worstINAP} dataKey="availability" />
          </div>
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2">Availability by Type (Exclude SPS)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsType}} series={seriesTypeAll} type="line" height="100%" />
            </div>
            <ContributorList title="Contributor (7 Days)" data={worstINAP} dataKey="availability" />
          </div>
        </div>

        {/* ROW 2: Site Class */}
        <div className="flex gap-2 mb-2 h-[260px]">
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2 z-10 -ml-4">Availability by Site Class (Power)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsClass}} series={seriesSiteClassPower} type="line" height="100%" />
            </div>
            <div className="w-10 bg-white border-l flex items-center justify-center -rotate-90 text-xs font-bold text-gray-500 tracking-widest">Power</div>
          </div>
          
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2 z-10 -ml-4">Availability by Site Class (Transport)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsClass}} series={seriesSiteClassTransport} type="line" height="100%" />
            </div>
            <div className="w-10 bg-white border-l flex items-center justify-center -rotate-90 text-xs font-bold text-gray-500 tracking-widest">Transport</div>
            <ContributorList title="Contributor (7 Days)" data={worstTransport} dataKey="ava_transport" />
          </div>
        </div>

        {/* ROW 3: Grid */}
        <div className="bg-white flex shadow-sm h-[260px] mb-4">
          <div className="flex-1 p-2 relative">
            <h3 className="text-xs font-bold text-center absolute w-full top-2 z-10">Availability by Grid Category</h3>
            <Chart options={{...baseChartOptions, yaxis: { min: 0, max: 100 }, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={seriesGrid} type="line" height="100%" />
          </div>
          <ContributorList title="Contributor (7 Days)" data={worstPower} dataKey="ava_power" />
        </div>

      </div>
    </div>
  );
}
