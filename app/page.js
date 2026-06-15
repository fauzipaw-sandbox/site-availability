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
    <div className="flex-1 overflow-y-auto pr-1">
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center text-[10px] mb-1.5">
          <span className="w-12 truncate text-gray-500" title={item.site_id}>{item.site_id}</span>
          <div className="flex-1 h-3 bg-gray-100 mx-2 relative rounded-sm overflow-hidden">
            <div 
              className="absolute top-0 right-0 h-full bg-orange-500 rounded-sm" 
              style={{ width: `${Math.max(0, 100 - (item[dataKey] || 0))}%` }} 
            ></div>
          </div>
          <span className="w-8 text-right text-gray-700 font-medium">{(item[dataKey] || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const [masterData, setMasterData] = useState([]);
  
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

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const getOptions = (key) => {
    const uniqueValues = [...new Set(masterData.map(item => item[key]).filter(Boolean))];
    return ['All', ...uniqueValues.sort()];
  };

  const getWorstContributors = (dataKey, limit = 15) => {
    const siteAvg = {};
    filteredData.forEach(d => {
      if (d[dataKey] === null || d[dataKey] === undefined) return;
      if (!siteAvg[d.site_id]) siteAvg[d.site_id] = { sum: 0, count: 0 };
      siteAvg[d.site_id].sum += d[dataKey];
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

  // PERBAIKAN GRAFIK: Mapping pakai { x: timestamp, y: value } biar garis nggak putus!
  const categories = [...new Set(filteredData.map(item => item.period))].sort();

  const buildSeries = (key, name) => ({
    name,
    data: categories.map(date => {
      const dayData = filteredData.filter(d => d.period === date && typeof d[key] === 'number');
      if(!dayData.length) return null;
      return {
        x: new Date(date).getTime(),
        y: parseFloat((dayData.reduce((acc, curr) => acc + curr[key], 0) / dayData.length).toFixed(2))
      };
    }).filter(item => item !== null) // Hapus gap kosong
  });

  const buildSeriesByGroup = (groupKey, dataKey, groupList) => {
    return groupList.map(groupVal => ({
      name: groupVal,
      data: categories.map(date => {
        const match = filteredData.filter(d => d.period === date && d[groupKey] === groupVal && typeof d[dataKey] === 'number');
        if(!match.length) return null;
        return {
          x: new Date(date).getTime(),
          y: parseFloat((match.reduce((acc, curr) => acc + curr[dataKey], 0) / match.length).toFixed(2))
        };
      }).filter(item => item !== null)
    }));
  };

  const seriesTypeAll = [
    buildSeries('ava_power', 'Power'), buildSeries('ava_transport', 'Transport'),
    buildSeries('all_ne_avail', 'All NE'), buildSeries('ume_avail', 'Avail UME')
  ];

  const siteClasses = getOptions('site_class').filter(opt => opt !== 'All');
  const seriesSiteClassPower = buildSeriesByGroup('site_class', 'ava_power', siteClasses);
  const seriesSiteClassTransport = buildSeriesByGroup('site_class', 'ava_transport', siteClasses);
  
  const gridCategories = getOptions('grid_category_new').filter(opt => opt !== 'All');
  const seriesGrid = buildSeriesByGroup('grid_category_new', 'ava_power', gridCategories);

  const baseChartOptions = {
    chart: { type: 'line', toolbar: { show: true, tools: { download: false } }, zoom: { enabled: true } },
    stroke: { width: 2.5, curve: 'straight' },
    markers: { size: 3, hover: { size: 6 } }, // Titik diperjelas
    xaxis: { type: 'datetime', labels: { style: { fontSize: '9px' }, datetimeUTC: false } },
    yaxis: { min: 94, max: 100, tickAmount: 4, labels: { style: { fontSize: '9px' } } },
    legend: { position: 'top', fontSize: '11px', markers: { radius: 12 }, itemMargin: { horizontal: 10, vertical: 5 } },
    grid: { show: true, strokeDashArray: 4, borderColor: '#f1f1f1' }
  };

  const filterDropdowns = [
    { label: 'Flag NE ID', key: 'flag_ne_id' }, { label: 'NOP', key: 'nop' },
    { label: 'Site ID', key: 'site_id' }, { label: 'Site Class', key: 'site_class' },
    { label: 'Kota/Kab', key: 'kota_kab' }, { label: 'Kecamatan', key: 'kecamatan' },
    { label: 'Link Route', key: 'link_route' }, { label: 'Grid', key: 'grid_category_new' }
  ];

  return (
    <div className="p-2 bg-[#f3f4f6] min-h-screen font-sans">
      <div className="bg-white p-2 mb-2 border-b flex items-center gap-2 overflow-x-auto text-[10px]">
        <div className="flex flex-col">
          <label className="text-gray-500 mb-1 font-semibold">Date</label>
          <div className="flex">
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="border px-1 py-0.5 rounded-l outline-none focus:border-blue-400"/>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="border-y border-r px-1 py-0.5 rounded-r outline-none focus:border-blue-400"/>
          </div>
        </div>
        {filterDropdowns.map(filter => (
          <div key={filter.key} className="flex flex-col w-24">
            <label className="text-gray-500 mb-1 truncate font-semibold" title={filter.label}>{filter.label}</label>
            <select value={filters[filter.key]} onChange={(e) => handleFilterChange(filter.key, e.target.value)} className="border px-1 py-1 rounded outline-none focus:border-blue-400">
              {getOptions(filter.key).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="px-2">
        <Uploader />

        <div className="flex gap-2 mb-2 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (All)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (Exclude SPS)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
        </div>

        <div className="flex gap-2 mb-2 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative overflow-hidden">
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Power)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassPower} type="line" height="100%" /></div>
            </div>
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">POWER</span>
            </div>
          </div>
          
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative overflow-hidden">
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Transport)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassTransport} type="line" height="100%" /></div>
            </div>
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">TRANSPORT</span>
            </div>
            <ContributorList title="Contributor (Worst Transport)" data={worstTransport} dataKey="ava_transport" />
          </div>
        </div>

        <div className="bg-white flex shadow-sm h-[280px] mb-4 rounded border border-gray-100">
          <div className="flex-1 p-2 flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Grid Category</h3>
            <div className="flex-1"><Chart options={{...baseChartOptions, yaxis: { min: 0, max: 100 }, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={seriesGrid} type="line" height="100%" /></div>
          </div>
          <ContributorList title="Contributor (Worst Power)" data={worstPower} dataKey="ava_power" />
        </div>

      </div>
    </div>
  );
}
