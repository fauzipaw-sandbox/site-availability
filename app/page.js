'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

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
          <span className="w-12 truncate text-gray-500" title={item.site_id}>{item.site_id}</span>
          <div className="flex-1 h-3.5 bg-gray-100 mx-2 relative">
            <div 
              className="absolute top-0 right-0 h-full bg-orange-500" 
              style={{ width: `${Math.max(0, 100 - (item[dataKey] || 0))}%` }} 
            ></div>
          </div>
          <span className="w-8 text-right text-gray-700">{(item[dataKey] || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const [masterData, setMasterData] = useState([]);
  
  // STATE UNTUK FILTER
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', flag_ne_id: 'All', nop: 'All', 
    site_id: 'All', site_class: 'All', kota_kab: 'All', 
    kecamatan: 'All', link_route: 'All', grid_category_new: 'All'
  });

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('dashboard_master_view').select('*').order('period');
      if (data) setMasterData(data);
    }
    fetchData();
  }, []);

  // LOGIKA FILTER: Data berubah otomatis setiap kali dropdown diganti
  const filteredData = useMemo(() => {
    return masterData.filter(d => {
      let isValid = true;
      if (filters.startDate && d.period < filters.startDate) isValid = false;
      if (filters.endDate && d.period > filters.endDate) isValid = false;
      
      const filterKeys = ['flag_ne_id', 'nop', 'site_id', 'site_class', 'kota_kab', 'kecamatan', 'link_route', 'grid_category_new'];
      filterKeys.forEach(key => {
        if (filters[key] !== 'All' && d[key] !== filters[key]) isValid = false;
      });
      return isValid;
    });
  }, [masterData, filters]);

  // Handle Perubahan Dropdown
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Helper untuk mendapatkan Opsi Dropdown Dinamis dari masterData
  const getOptions = (key) => {
    const uniqueValues = [...new Set(masterData.map(item => item[key]).filter(Boolean))];
    return ['All', ...uniqueValues.sort()];
  };

  // Kalkulasi Contributor (Worst) berdasarkan Filter Aktif
  const getWorstContributors = (dataKey, limit = 15) => {
    const siteAvg = {};
    filteredData.forEach(d => {
      if (!siteAvg[d.site_id]) siteAvg[d.site_id] = { sum: 0, count: 0 };
      siteAvg[d.site_id].sum += (d[dataKey] || 0);
      siteAvg[d.site_id].count += 1;
    });
    return Object.keys(siteAvg)
      .map(site_id => ({ site_id, [dataKey]: siteAvg[site_id].sum / siteAvg[site_id].count }))
      .sort((a, b) => a[dataKey] - b[dataKey])
      .slice(0, limit);
  };

  const worstINAP = getWorstContributors('inap_avail');
  const worstPower = getWorstContributors('ava_power');
  const worstTransport = getWorstContributors('ava_transport');

  // Helper bikin series grafik
  const categories = [...new Set(filteredData.map(item => item.period))].sort();

  const buildSeries = (key, name) => ({
    name,
    data: categories.map(date => {
      const dayData = filteredData.filter(d => d.period === date);
      if(!dayData.length) return null;
      return parseFloat((dayData.reduce((acc, curr) => acc + (curr[key] || 0), 0) / dayData.length).toFixed(2));
    })
  });

  const buildSeriesByGroup = (groupKey, dataKey, groupList) => {
    return groupList.map(groupVal => ({
      name: groupVal,
      data: categories.map(date => {
        const match = filteredData.filter(d => d.period === date && d[groupKey] === groupVal);
        if(!match.length) return null;
        return parseFloat((match.reduce((acc, curr) => acc + (curr[dataKey] || 0), 0) / match.length).toFixed(2));
      })
    }));
  };

  const seriesTypeAll = [
    buildSeries('ava_power', 'Power'),
    buildSeries('ava_transport', 'Transport'),
    buildSeries('all_ne_avail', 'All NE'),
    buildSeries('ume_avail', 'Avail UME')
  ];

  const siteClasses = getOptions('site_class').filter(opt => opt !== 'All');
  const seriesSiteClassPower = buildSeriesByGroup('site_class', 'ava_power', siteClasses);
  const seriesSiteClassTransport = buildSeriesByGroup('site_class', 'ava_transport', siteClasses);
  
  const gridCategories = getOptions('grid_category_new').filter(opt => opt !== 'All');
  const seriesGrid = buildSeriesByGroup('grid_category_new', 'ava_power', gridCategories);

  // Styling Grafik: Tambah markers size 4 biar titiknya kelihatan tebal walau cuma 1 hari
  const baseChartOptions = {
    chart: { type: 'line', toolbar: { show: false }, animations: { enabled: false } },
    stroke: { width: 2, curve: 'straight' },
    markers: { size: 4, hover: { size: 6 } }, 
    xaxis: { categories: categories, type: 'category', labels: { style: { fontSize: '9px' } } },
    yaxis: { min: 94, max: 100, tickAmount: 3, labels: { style: { fontSize: '9px' } } },
    legend: { position: 'top', fontSize: '10px', markers: { radius: 12 } },
    grid: { show: false }
  };

  const chartColorsType = ['#008FFB', '#775DD0', '#FF4560', '#546E7A'];
  const chartColorsClass = ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548'];

  // List dropdown filter yang dirender
  const filterDropdowns = [
    { label: 'Flag NE ID', key: 'flag_ne_id' },
    { label: 'NOP', key: 'nop' },
    { label: 'Site ID', key: 'site_id' },
    { label: 'Site Class', key: 'site_class' },
    { label: 'Kota/Kab', key: 'kota_kab' },
    { label: 'Kecamatan', key: 'kecamatan' },
    { label: 'Link Route', key: 'link_route' },
    { label: 'Grid', key: 'grid_category_new' }
  ];

  return (
    <div className="p-2 bg-[#f3f4f6] min-h-screen font-sans">
      
      {/* FILTER BAR DINAMIS */}
      <div className="bg-white p-2 mb-2 border-b flex items-center gap-2 overflow-x-auto text-[10px]">
        <div className="flex flex-col">
          <label className="text-gray-500 mb-1">Date</label>
          <div className="flex">
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="border px-1 py-0.5 rounded-l"/>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="border-y border-r px-1 py-0.5 rounded-r"/>
          </div>
        </div>
        
        {filterDropdowns.map(filter => (
          <div key={filter.key} className="flex flex-col w-24">
            <label className="text-gray-500 mb-1 truncate" title={filter.label}>{filter.label}</label>
            <select 
              value={filters[filter.key]} 
              onChange={(e) => handleFilterChange(filter.key, e.target.value)} 
              className="border px-1 py-1"
            >
              {getOptions(filter.key).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        ))}
        <div className="ml-auto font-bold text-xs pr-4">Source : INAP & UME</div>
      </div>

      <div className="px-2">
        <Uploader />

        {/* GRAFIK & CONTRIBUTOR */}
        <div className="flex gap-2 mb-2 h-[260px]">
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2">Availability by Type (All)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsType}} series={seriesTypeAll} type="line" height="100%" />
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
          <div className="flex-1 bg-white flex shadow-sm">
            <div className="flex-1 p-2 relative">
              <h3 className="text-xs font-bold text-center absolute w-full top-2">Availability by Type (Exclude SPS)</h3>
              <Chart options={{...baseChartOptions, colors: chartColorsType}} series={seriesTypeAll} type="line" height="100%" />
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
        </div>

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
            <ContributorList title="Contributor (Worst Transport)" data={worstTransport} dataKey="ava_transport" />
          </div>
        </div>

        <div className="bg-white flex shadow-sm h-[260px] mb-4">
          <div className="flex-1 p-2 relative">
            <h3 className="text-xs font-bold text-center absolute w-full top-2 z-10">Availability by Grid Category</h3>
            <Chart options={{...baseChartOptions, yaxis: { min: 0, max: 100 }, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={seriesGrid} type="line" height="100%" />
          </div>
          <ContributorList title="Contributor (Worst Power)" data={worstPower} dataKey="ava_power" />
        </div>

      </div>
    </div>
  );
}
