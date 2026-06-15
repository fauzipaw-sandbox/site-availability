'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const SearchableSelect = ({ label, options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => String(opt).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col w-32 relative" ref={wrapperRef}>
      <label className="text-gray-500 mb-1 truncate font-semibold text-[10px]" title={label}>{label}</label>
      <div 
        className="border px-2 py-1.5 rounded outline-none focus:border-blue-400 bg-white cursor-pointer flex justify-between items-center text-[10px] shadow-sm hover:border-blue-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate flex-1">{value}</span>
        {value !== 'All' ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onChange('All'); }} 
            className="text-red-400 hover:text-red-600 font-bold ml-1 px-1"
            title="Clear filter"
          >✕</button>
        ) : (
          <span className="text-gray-400 text-[8px] ml-1">▼</span>
        )}
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-48 mt-1 bg-white border border-gray-200 rounded shadow-xl z-50">
          <div className="p-1.5 border-b bg-gray-50 rounded-t">
            <input 
              type="text" 
              className="w-full px-2 py-1 text-[10px] outline-none border rounded" 
              placeholder={`Cari ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <li 
                key={opt} 
                className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] border-b border-gray-50 last:border-0"
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
              >
                {opt}
              </li>
            )) : (
              <li className="px-3 py-2 text-[10px] text-gray-400 italic">Tidak ditemukan</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const ContributorList = ({ title, data, dataKey }) => (
  <div className="w-60 bg-white p-3 border-l border-gray-100 flex flex-col z-10 relative">
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
              style={{ width: `${Math.max(0, 100 - (Number(item[dataKey]) || 0))}%` }} 
            ></div>
          </div>
          <span className="w-8 text-right text-gray-700 font-medium">{(Number(item[dataKey]) || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const [masterData, setMasterData] = useState([]);
  
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', nop: 'All', 
    site_id: 'All', site_class: 'All', kota_kab: 'All', 
    kecamatan: 'All', link_route: 'All', grid_category_new: 'All'
  });

  const normalizeDate = (rawDate) => {
    if (!rawDate) return null;
    if (!isNaN(rawDate) && Number(rawDate) > 40000) {
      const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return rawDate;
  };

  useEffect(() => {
    async function fetchData() {
      // Tarik sejuta baris biar aman dari potongan data
      const { data } = await supabase.from('dashboard_master_view').select('*').limit(1000000);
      if (data && data.length > 0) {
        const cleanedData = data.map(d => ({ ...d, period: normalizeDate(d.period) })).filter(d => d.period);
        setMasterData(cleanedData);
        
        const periods = [...new Set(cleanedData.map(d => d.period))].sort();
        if (periods.length > 0) {
          const latestDateStr = periods[periods.length - 1];
          const latestDateObj = new Date(latestDateStr);
          
          // Mundurin 30 hari ke belakang buat default view
          latestDateObj.setDate(latestDateObj.getDate() - 30);
          const thirtyDaysAgoStr = latestDateObj.toISOString().split('T')[0];
          
          // Jaga-jaga kalau data aslinya umurnya kurang dari 30 hari
          const finalStartDate = thirtyDaysAgoStr < periods[0] ? periods[0] : thirtyDaysAgoStr;

          setFilters(prev => ({ ...prev, startDate: finalStartDate, endDate: latestDateStr }));
        }
      }
    }
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const filterStart = filters.startDate ? new Date(filters.startDate).getTime() : 0;
    const filterEnd = filters.endDate ? new Date(filters.endDate).getTime() : Infinity;

    return masterData.filter(d => {
      let isValid = true;
      const dTime = new Date(d.period).getTime();
      
      if (filterStart && dTime < filterStart) isValid = false;
      if (filterEnd && dTime > filterEnd) isValid = false;
      
      const filterKeys = ['nop', 'site_id', 'site_class', 'kota_kab', 'kecamatan', 'link_route', 'grid_category_new'];
      filterKeys.forEach(key => {
        if (filters[key] !== 'All' && d[key] !== filters[key]) isValid = false;
      });
      return isValid;
    });
  }, [masterData, filters]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  // Options nge-bypass tanggal, jadi dropdown nampilin full opsi se-database
  const getCascadingOptions = (targetKey) => {
    const relevantData = masterData.filter(d => {
      for (const k in filters) {
        if (k === 'startDate' || k === 'endDate' || k === targetKey) continue;
        if (filters[k] !== 'All' && d[k] !== filters[k]) return false;
      }
      return true;
    });
    const uniqueValues = [...new Set(relevantData.map(item => item[targetKey]).filter(Boolean))];
    return ['All', ...uniqueValues.sort()];
  };

  const getWorstContributors = (dataKey, limit = 15) => {
    const siteAvg = {};
    filteredData.forEach(d => {
      if (d[dataKey] == null) return; 
      if (!siteAvg[d.site_id]) siteAvg[d.site_id] = { sum: 0, count: 0 };
      siteAvg[d.site_id].sum += Number(d[dataKey]);
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

  const categories = [...new Set(filteredData.map(item => item.period))].sort();

  const buildSeries = (key, name) => ({
    name,
    data: categories.map(date => {
      const dayData = filteredData.filter(d => d.period === date && d[key] != null);
      if(!dayData.length) return null;
      return {
        x: new Date(date).getTime(),
        y: parseFloat((dayData.reduce((acc, curr) => acc + Number(curr[key]), 0) / dayData.length).toFixed(2))
      };
    }).filter(item => item !== null).sort((a, b) => a.x - b.x)
  });

  const buildSeriesByGroup = (groupKey, dataKey, groupList) => {
    return groupList.map(groupVal => ({
      name: groupVal,
      data: categories.map(date => {
        const match = filteredData.filter(d => d.period === date && d[groupKey] === groupVal && d[dataKey] != null);
        if(!match.length) return null;
        return {
          x: new Date(date).getTime(),
          y: parseFloat((match.reduce((acc, curr) => acc + Number(curr[dataKey]), 0) / match.length).toFixed(2))
        };
      }).filter(item => item !== null).sort((a, b) => a.x - b.x)
    }));
  };

  const seriesTypeAll = [
    buildSeries('ava_power', 'Power'), buildSeries('ava_transport', 'Transport'),
    buildSeries('all_ne_avail', 'All NE'), buildSeries('ume_avail', 'Avail UME')
  ];

  const siteClasses = getCascadingOptions('site_class').filter(opt => opt !== 'All');
  const seriesSiteClassPower = buildSeriesByGroup('site_class', 'ava_power', siteClasses);
  const seriesSiteClassTransport = buildSeriesByGroup('site_class', 'ava_transport', siteClasses);
  
  const gridCategories = getCascadingOptions('grid_category_new').filter(opt => opt !== 'All');
  const seriesGrid = buildSeriesByGroup('grid_category_new', 'ava_power', gridCategories);

  const baseChartOptions = {
    chart: { type: 'line', toolbar: { show: true, tools: { download: true, zoom: true, pan: true } }, zoom: { enabled: true, type: 'x' } },
    stroke: { width: 2.5, curve: 'straight' },
    markers: { size: 3, hover: { size: 6 } }, 
    xaxis: { type: 'datetime', labels: { style: { fontSize: '9px' }, datetimeUTC: false } },
    yaxis: { min: 94, max: 100, tickAmount: 4, labels: { style: { fontSize: '9px' } } },
    legend: { position: 'top', fontSize: '11px', markers: { radius: 12 }, itemMargin: { horizontal: 10, vertical: 5 } },
    grid: { show: true, strokeDashArray: 4, borderColor: '#f1f1f1' }
  };

  const filterDropdowns = [
    { label: 'NOP', key: 'nop' }, { label: 'Site ID', key: 'site_id' }, 
    { label: 'Site Class', key: 'site_class' }, { label: 'Kota/Kab', key: 'kota_kab' }, 
    { label: 'Kecamatan', key: 'kecamatan' }, { label: 'Link Route', key: 'link_route' }, 
    { label: 'Grid', key: 'grid_category_new' }
  ];

  return (
    <div className="p-2 bg-[#f3f4f6] min-h-screen font-sans pb-10">
      
      <div className="bg-white p-3 mb-3 border-b flex items-center gap-3 overflow-x-visible text-[10px] shadow-sm rounded-b-lg flex-wrap z-50 relative">
        <div className="flex flex-col">
          <label className="text-gray-500 mb-1 font-semibold">Date Range</label>
          <div className="flex items-center">
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="border px-2 py-1.5 rounded-l outline-none focus:border-blue-400 text-[10px]"/>
            <span className="bg-gray-100 border-y px-2 py-1.5 text-gray-400">to</span>
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="border-y border-r px-2 py-1.5 rounded-r outline-none focus:border-blue-400 text-[10px]"/>
          </div>
        </div>
        
        {filterDropdowns.map(filter => (
          <SearchableSelect 
            key={filter.key} 
            label={filter.label} 
            options={getCascadingOptions(filter.key)} 
            value={filters[filter.key]} 
            onChange={(val) => handleFilterChange(filter.key, val)} 
          />
        ))}
      </div>

      <div className="px-2 relative z-0">
        <Uploader />

        <div className="flex gap-3 mb-3 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 transition-all hover:shadow-md">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (All)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 transition-all hover:shadow-md">
            <div className="flex-1 p-2 flex flex-col min-w-0">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Type (Exclude SPS)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#008FFB', '#775DD0', '#FF4560', '#546E7A']}} series={seriesTypeAll} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Selected Filter)" data={worstINAP} dataKey="inap_avail" />
          </div>
        </div>

        <div className="flex gap-3 mb-3 h-[280px]">
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative flex-row transition-all hover:shadow-md">
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center z-10 rounded-l">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">POWER</span>
            </div>
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Power)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassPower} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Worst Power)" data={worstPower} dataKey="ava_power" />
          </div>
          
          <div className="flex-1 bg-white flex shadow-sm rounded border border-gray-100 relative flex-row transition-all hover:shadow-md">
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-50 border-r flex items-center justify-center z-10 rounded-l">
              <span className="-rotate-90 text-[10px] font-bold text-gray-400 tracking-widest whitespace-nowrap">TRANSPORT</span>
            </div>
            <div className="flex-1 p-2 flex flex-col min-w-0 pl-8">
              <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Site Class (Transport)</h3>
              <div className="flex-1"><Chart options={{...baseChartOptions, colors: ['#E91E63', '#008FFB', '#FEB019', '#9E9E9E', '#795548']}} series={seriesSiteClassTransport} type="line" height="100%" /></div>
            </div>
            <ContributorList title="Contributor (Worst Transport)" data={worstTransport} dataKey="ava_transport" />
          </div>
        </div>

        <div className="bg-white flex shadow-sm h-[280px] mb-4 rounded border border-gray-100 transition-all hover:shadow-md">
          <div className="flex-1 p-2 flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-center text-gray-700 mb-1 mt-1">Availability by Grid Category</h3>
            <div className="flex-1"><Chart options={{...baseChartOptions, yaxis: { min: 0, max: 100 }, colors: ['#03A9F4', '#3F51B5', '#FF9800', '#9C27B0', '#E91E63']}} series={seriesGrid} type="line" height="100%" /></div>
          </div>
        </div>

      </div>
    </div>
  );
}
